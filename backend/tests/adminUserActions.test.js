// Admin dashboard slice 5 — ban, unban, force logout, delete, restore, purge now.
// See .context/plans/admin-dashboard.md §3.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, auditLog, staffAccounts } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';
const USER_PASSWORD = 'learner-password-1';

const staffToken = async (role) => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: STAFF_PASSWORD, role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: STAFF_PASSWORD })).body.token;
};

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.com`,
            username: `user${seq}`,
            password: await bcrypt.hash(USER_PASSWORD, 4),
            languages: ['English', 'Spanish'],
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};

const post = (path, token, body) => {
    const req = request(app).post(path).set('Authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body);
};
const act = (id, name, token, body) => post(`/api/admin/users/${id}/${name}`, token, body);

const learnerLogin = (user) => request(app).post('/api/users/login').send({ email: user.email, password: USER_PASSWORD });
const learnerMe = (token) => request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
const auditRows = () => db.select().from(auditLog).orderBy(auditLog.createdAt);
const getUser = async (id) => (await db.select().from(users).where(eq(users.id, id)))[0];

describe('permissions', () => {
    const cases = [
        // action, roles that may, roles that may not
        ['ban', ['support', 'admin', 'owner'], ['viewer'], { reason: 'spam' }],
        ['unban', ['support', 'admin', 'owner'], ['viewer'], {}],
        ['force-logout', ['support', 'admin', 'owner'], ['viewer'], {}],
        ['delete', ['admin', 'owner'], ['viewer', 'support'], { reason: 'r', confirmUsername: 'x' }],
        ['restore', ['admin', 'owner'], ['viewer', 'support'], {}],
        ['purge', ['owner'], ['viewer', 'support', 'admin'], { reason: 'r', confirmUsername: 'x' }],
    ];

    it.each(cases)('%s: roles without the permission get 403, and nothing is written', async (name, _allowed, denied, body) => {
        const user = await makeUser();
        for (const role of denied) {
            const res = await act(user.id, name, await staffToken(role), body);
            expect([role, res.status]).toEqual([role, 403]);
        }
        expect((await auditRows()).filter((r) => r.action !== 'staff.login')).toHaveLength(0);
        const row = await getUser(user.id);
        expect([row.bannedAt, row.deletedAt, row.tokenVersion]).toEqual([null, null, 0]);
    });

    it.each(cases)('%s: is reachable by the roles that have the permission (not 403)', async (name, allowed, _denied, body) => {
        const user = await makeUser();
        for (const role of allowed) {
            const res = await act(user.id, name, await staffToken(role), body);
            expect([role, res.status === 403]).toEqual([role, false]);
        }
    });

    it('rejects no token and a learner token', async () => {
        const user = await makeUser();
        const learner = (await learnerLogin(user)).body.token;

        expect((await request(app).post(`/api/admin/users/${user.id}/ban`).send({ reason: 'x' })).status).toBe(401);
        expect((await act(user.id, 'ban', learner, { reason: 'x' })).status).toBe(401);
        expect((await getUser(user.id)).bannedAt).toBeNull();
    });
});

describe('ban', () => {
    it('bans, stores the reason, returns the detail and writes one audit row', async () => {
        const user = await makeUser();
        const token = await staffToken('support');

        const res = await act(user.id, 'ban', token, { reason: '  spam links  ' });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: user.id, status: 'banned', banReason: 'spam links' });
        const row = await getUser(user.id);
        expect(row.bannedAt).toBeInstanceOf(Date);
        expect(row.banReason).toBe('spam links');
        const [staff] = await db.select().from(staffAccounts);
        const audit = (await auditRows()).filter((r) => r.action === 'user.ban');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: staff.id,
            targetType: 'user',
            targetId: user.id,
            reason: 'spam links',
            metadata: { email: user.email, username: user.username },
        });
    });

    it('needs a reason: missing, blank, not text, or too long', async () => {
        const user = await makeUser();
        const token = await staffToken('support');

        for (const body of [undefined, {}, { reason: '' }, { reason: '   ' }, { reason: 5 }, { reason: 'x'.repeat(501) }]) {
            const res = await act(user.id, 'ban', token, body);
            expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 400]);
        }
        expect((await getUser(user.id)).bannedAt).toBeNull();
        expect((await auditRows()).filter((r) => r.action === 'user.ban')).toHaveLength(0);
    });

    it('locks the user out at once: old token 401, login 403', async () => {
        const user = await makeUser();
        const learnerToken = (await learnerLogin(user)).body.token;
        expect((await learnerMe(learnerToken)).status).toBe(200);

        await act(user.id, 'ban', await staffToken('support'), { reason: 'spam' });

        expect((await learnerMe(learnerToken)).status).toBe(401);
        expect((await learnerLogin(user)).status).toBe(403);
    });

    it('refuses an account that is already banned or deleted, without a second audit row', async () => {
        const banned = await makeUser({ bannedAt: new Date() });
        const deleted = await makeUser({ deletedAt: new Date() });
        const token = await staffToken('support');

        const a = await act(banned.id, 'ban', token, { reason: 'again' });
        const b = await act(deleted.id, 'ban', token, { reason: 'gone' });

        expect(a.status).toBe(409);
        expect(a.body.message).toBe('This account is already banned');
        expect(b.status).toBe(409);
        expect((await auditRows()).filter((r) => r.action === 'user.ban')).toHaveLength(0);
    });

    it('lets exactly one of two simultaneous bans win', async () => {
        const user = await makeUser();
        const one = await staffToken('support');
        const two = await staffToken('admin');

        const results = await Promise.all([
            act(user.id, 'ban', one, { reason: 'first' }),
            act(user.id, 'ban', two, { reason: 'second' }),
        ]);

        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect((await auditRows()).filter((r) => r.action === 'user.ban')).toHaveLength(1);
    });
});

describe('unban', () => {
    it('clears the ban, allows an optional reason, and lets the user back in', async () => {
        const user = await makeUser({ bannedAt: new Date(), banReason: 'spam' });
        const token = await staffToken('support');

        const res = await act(user.id, 'unban', token);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'active', banReason: null });
        expect((await learnerLogin(user)).status).toBe(200);
        const audit = (await auditRows()).filter((r) => r.action === 'user.unban');
        expect(audit).toHaveLength(1);
        expect(audit[0].reason).toBeNull();

        await act(user.id, 'ban', token, { reason: 'again' });
        await act(user.id, 'unban', token, { reason: 'appeal accepted' });
        expect((await auditRows()).filter((r) => r.action === 'user.unban').at(-1).reason).toBe('appeal accepted');
    });

    it('refuses an account that is not banned, and a deleted one (restore first)', async () => {
        const active = await makeUser();
        const deleted = await makeUser({ bannedAt: new Date(), deletedAt: new Date() });
        const token = await staffToken('support');

        const a = await act(active.id, 'unban', token);
        const b = await act(deleted.id, 'unban', token);

        expect([a.status, a.body.message]).toEqual([409, 'This account is not banned']);
        expect([b.status, b.body.message]).toEqual([409, 'Restore this account first']);
        expect((await getUser(deleted.id)).bannedAt).not.toBeNull();
    });
});

describe('force logout', () => {
    it('raises token_version: old tokens fail, a new login works', async () => {
        const user = await makeUser();
        const oldToken = (await learnerLogin(user)).body.token;

        const res = await act(user.id, 'force-logout', await staffToken('support'));

        expect(res.status).toBe(200);
        expect((await getUser(user.id)).tokenVersion).toBe(1);
        expect((await learnerMe(oldToken)).status).toBe(401);
        const fresh = (await learnerLogin(user)).body.token;
        expect((await learnerMe(fresh)).status).toBe(200);
        expect((await auditRows()).filter((r) => r.action === 'user.force_logout')).toHaveLength(1);
    });

    it('counts up on every use, and refuses a deleted account', async () => {
        const user = await makeUser();
        const deleted = await makeUser({ deletedAt: new Date() });
        const token = await staffToken('support');

        await act(user.id, 'force-logout', token);
        await act(user.id, 'force-logout', token);

        expect((await getUser(user.id)).tokenVersion).toBe(2);
        expect((await act(deleted.id, 'force-logout', token)).status).toBe(409);
    });
});

describe('delete and restore', () => {
    it('deletes: needs reason and the typed username, marks who did it, keeps the row', async () => {
        const user = await makeUser({ username: 'Kaja' });
        const token = await staffToken('admin');
        const bad = [
            { reason: 'gdpr' },
            { reason: 'gdpr', confirmUsername: '' },
            { reason: 'gdpr', confirmUsername: 'kaja' }, // the match is exact
            { reason: 'gdpr', confirmUsername: ['Kaja'] },
            { confirmUsername: 'Kaja' },
        ];

        for (const body of bad) {
            const res = await act(user.id, 'delete', token, body);
            expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 400]);
        }
        expect((await getUser(user.id)).deletedAt).toBeNull();

        const res = await act(user.id, 'delete', token, { reason: 'gdpr request', confirmUsername: 'Kaja' });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'deleted', deletedByStaffName: 'admin person' });
        const row = await getUser(user.id);
        expect(row.deletedAt).toBeInstanceOf(Date);
        expect(row.deletedByStaffId).not.toBeNull();
        const audit = (await auditRows()).filter((r) => r.action === 'user.delete');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ reason: 'gdpr request', metadata: { email: user.email, username: 'Kaja' } });
    });

    it('a deleted account is gone for the user, and the email stays reserved', async () => {
        const user = await makeUser();
        const learnerToken = (await learnerLogin(user)).body.token;

        await act(user.id, 'delete', await staffToken('admin'), { reason: 'x', confirmUsername: user.username });

        expect((await learnerMe(learnerToken)).status).toBe(401);
        expect((await learnerLogin(user)).status).toBe(400);
        const register = await request(app)
            .post('/api/users')
            .send({ name: 'N', email: user.email, username: 'fresh', password: USER_PASSWORD, languages: ['English', 'Spanish'] });
        expect(register.status).toBe(400);
    });

    it('refuses to delete twice', async () => {
        const user = await makeUser({ deletedAt: new Date() });

        const res = await act(user.id, 'delete', await staffToken('admin'), { reason: 'x', confirmUsername: user.username });

        expect([res.status, res.body.message]).toEqual([409, 'This account is already deleted']);
    });

    it('restores the account unchanged: the old token works again, and a ban stays', async () => {
        const user = await makeUser();
        const learnerToken = (await learnerLogin(user)).body.token;
        const token = await staffToken('admin');
        await act(user.id, 'delete', token, { reason: 'x', confirmUsername: user.username });
        expect((await learnerMe(learnerToken)).status).toBe(401);

        const res = await act(user.id, 'restore', token, { reason: 'mistake' });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'active', deletedAt: null, deletedByStaffName: null });
        expect((await getUser(user.id)).deletedByStaffId).toBeNull();
        expect((await learnerMe(learnerToken)).status).toBe(200);
        expect((await auditRows()).filter((r) => r.action === 'user.restore')).toHaveLength(1);

        const banned = await makeUser({ bannedAt: new Date(), deletedAt: new Date() });
        expect((await act(banned.id, 'restore', token)).body.status).toBe('banned');
    });

    it('refuses to restore an account that is not deleted', async () => {
        const user = await makeUser();

        const res = await act(user.id, 'restore', await staffToken('admin'));

        expect([res.status, res.body.message]).toEqual([409, 'This account is not deleted']);
        expect((await auditRows()).filter((r) => r.action === 'user.restore')).toHaveLength(0);
    });
});

describe('purge now', () => {
    const purgeBody = (user) => ({ reason: 'gdpr erasure', confirmUsername: user.username });

    it('refuses an account that is not soft-deleted first', async () => {
        const user = await makeUser();

        const res = await act(user.id, 'purge', await staffToken('owner'), purgeBody(user));

        expect([res.status, res.body.message]).toEqual([409, 'Delete this account first']);
        expect(await getUser(user.id)).toBeDefined();
    });

    it('needs a reason and the typed username', async () => {
        const user = await makeUser({ deletedAt: new Date() });
        const token = await staffToken('owner');

        expect((await act(user.id, 'purge', token, { confirmUsername: user.username })).status).toBe(400);
        expect((await act(user.id, 'purge', token, { reason: 'x', confirmUsername: 'wrong' })).status).toBe(400);
        expect(await getUser(user.id)).toBeDefined();
    });

    it('deletes the account and its data, and keeps an audit row that names the account', async () => {
        const user = await makeUser({ deletedAt: new Date() });
        const other = await makeUser();
        const [mine] = await db.insert(words).values({ userId: user.id, partOfSpeech: 'Noun' }).returning();
        const [clone] = await db.insert(words).values({ userId: other.id, partOfSpeech: 'Noun', originalCreatorId: user.id }).returning();
        const token = await staffToken('owner');

        const res = await act(user.id, 'purge', token, purgeBody(user));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ purged: true });
        expect(await getUser(user.id)).toBeUndefined();
        expect(await db.select().from(words).where(eq(words.id, mine.id))).toHaveLength(0);
        // Another user's clone of the word stays, with its creator link cleared.
        expect((await db.select().from(words).where(eq(words.id, clone.id)))[0].originalCreatorId).toBeNull();

        const audit = (await auditRows()).filter((r) => r.action === 'user.purge');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            targetType: 'user',
            targetId: user.id,
            reason: 'gdpr erasure',
            metadata: { email: user.email, username: user.username },
        });
        expect(audit[0].staffId).not.toBeNull();
        expect((await act(user.id, 'purge', token, purgeBody(user))).status).toBe(404);
    });
});

describe('every action', () => {
    it('returns 404 for an unknown id and for text that is not a UUID', async () => {
        const token = await staffToken('owner');
        const body = { reason: 'x', confirmUsername: 'x' };

        for (const name of ['ban', 'unban', 'force-logout', 'delete', 'restore', 'purge']) {
            for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
                const res = await act(id, name, token, body);
                expect([name, id, res.status]).toEqual([name, id, 404]);
            }
        }
    });
});

describe('audit history in the user detail', () => {
    it('shows the actions for admin and owner, newest first, and "System" for a job row', async () => {
        const user = await makeUser();
        const support = await staffToken('support');
        const admin = await staffToken('admin');
        await act(user.id, 'ban', support, { reason: 'spam' });
        await act(user.id, 'unban', support);
        await db.insert(auditLog).values({ staffId: null, action: 'user.purge', targetType: 'user', targetId: user.id, reason: 'job', metadata: { actor: 'system' } });

        const res = await request(app).get(`/api/admin/users/${user.id}`).set('Authorization', `Bearer ${admin}`);

        expect(res.body.audit.map((a) => a.action)).toEqual(['user.purge', 'user.unban', 'user.ban']);
        expect(res.body.audit[0].staffName).toBe('System');
        expect(res.body.audit[2]).toMatchObject({ staffName: 'support person', reason: 'spam' });

        const asSupport = await request(app).get(`/api/admin/users/${user.id}`).set('Authorization', `Bearer ${support}`);
        expect(asSupport.body.audit).toBeNull();
    });
});
