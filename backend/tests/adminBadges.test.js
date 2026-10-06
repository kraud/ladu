// Account badges, slice 2 — grant and revoke in the admin API, and the badges
// on the admin user detail. See .context/plans/verified-badges.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, userBadges, auditLog, staffAccounts } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { permissionsFor } = require('../lib/adminPermissions');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';
const USER_PASSWORD = 'learner-password-1';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

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
            email: `badge-admin${seq}@example.com`,
            username: `badgeadmin${seq}`,
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
const grant = (id, token, body) => post(`/api/admin/users/${id}/badges`, token, body);
const revoke = (id, type, token, body) => post(`/api/admin/users/${id}/badges/${type}/revoke`, token, body);
const detail = (id, token) => request(app).get(`/api/admin/users/${id}`).set('Authorization', `Bearer ${token}`);

const badgeRows = (userId) => db.select().from(userBadges).where(eq(userBadges.userId, userId));
const badgeAudit = async () => (await db.select().from(auditLog).orderBy(auditLog.createdAt)).filter((r) => r.action.startsWith('badge.'));

describe('permission', () => {
    it('only the owner has badge.manage', () => {
        expect(permissionsFor('owner')).toContain('badge.manage');
        for (const role of ['admin', 'support', 'viewer']) expect(permissionsFor(role)).not.toContain('badge.manage');
    });

    it.each(['admin', 'support', 'viewer'])('%s gets 403 on grant and revoke, and nothing is written', async (role) => {
        const user = await makeUser();
        const token = await staffToken(role);

        expect((await grant(user.id, token, { type: 'official', reason: 'x' })).status).toBe(403);
        expect((await revoke(user.id, 'official', token, { reason: 'x' })).status).toBe(403);

        expect(await badgeRows(user.id)).toHaveLength(0);
        expect(await badgeAudit()).toHaveLength(0);
    });

    it('rejects no token and a learner token', async () => {
        const user = await makeUser();
        const learner = (await request(app).post('/api/users/login').send({ email: user.email, password: USER_PASSWORD })).body.token;
        const body = { type: 'official', reason: 'x' };

        expect((await request(app).post(`/api/admin/users/${user.id}/badges`).send(body)).status).toBe(401);
        expect((await grant(user.id, learner, body)).status).toBe(401);
        expect((await revoke(user.id, 'official', learner, { reason: 'x' })).status).toBe(401);
        expect(await badgeRows(user.id)).toHaveLength(0);
    });

    it('a learner cannot write a badge through the learner API', async () => {
        const user = await makeUser();
        const learner = (await request(app).post('/api/users/login').send({ email: user.email, password: USER_PASSWORD })).body.token;

        // The status does not matter here: no badge may appear, whatever the route answers.
        await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${learner}`)
            .send({ badges: ['official'], badge: 'official', type: 'official' });

        expect(await badgeRows(user.id)).toHaveLength(0);
    });
});

describe('grant', () => {
    it('grants, returns the detail and writes one audit row', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');

        const res = await grant(user.id, token, { type: 'official', reason: '  Ladu team account  ' });

        expect(res.status).toBe(200);
        const [staff] = await db.select().from(staffAccounts);
        expect(res.body.id).toBe(user.id);
        expect(res.body.badges).toEqual([
            { type: 'official', grantedAt: expect.any(String), grantedBy: { id: staff.id, name: 'owner person' } },
        ]);

        const rows = await badgeRows(user.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ type: 'official', grantedBy: staff.id, revokedAt: null });

        const audit = await badgeAudit();
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: staff.id,
            action: 'badge.grant',
            targetType: 'user',
            targetId: user.id,
            reason: 'Ladu team account',
            metadata: { email: user.email, username: user.username, badge: 'official' },
        });
    });

    it('needs a reason: missing, blank, not text, or too long', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');

        for (const reason of [undefined, '', '   ', 5, 'x'.repeat(501)]) {
            const res = await grant(user.id, token, { type: 'official', reason });
            expect([String(reason).slice(0, 5), res.status]).toEqual([String(reason).slice(0, 5), 400]);
        }
        expect((await grant(user.id, token)).status).toBe(400);
        expect(await badgeRows(user.id)).toHaveLength(0);
        expect(await badgeAudit()).toHaveLength(0);
    });

    it('refuses an unknown or missing type', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');

        for (const type of [undefined, '', 'teacher', 'Official', 5, ['official'], { a: 1 }]) {
            const res = await grant(user.id, token, { type, reason: 'x' });
            expect([JSON.stringify(type) ?? 'undefined', res.status]).toEqual([JSON.stringify(type) ?? 'undefined', 400]);
        }
        expect(await badgeRows(user.id)).toHaveLength(0);
        expect(await badgeAudit()).toHaveLength(0);
    });

    it('answers 404 for an unknown user and for an id that is not a UUID', async () => {
        const token = await staffToken('owner');

        expect((await grant(MISSING_ID, token, { type: 'official', reason: 'x' })).status).toBe(404);
        expect((await grant('not-a-uuid', token, { type: 'official', reason: 'x' })).status).toBe(404);
        expect(await badgeAudit()).toHaveLength(0);
    });

    it('answers 409 for a second grant of the same badge, with no second row and no second audit row', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');
        expect((await grant(user.id, token, { type: 'official', reason: 'first' })).status).toBe(200);

        const res = await grant(user.id, token, { type: 'official', reason: 'again' });

        expect(res.status).toBe(409);
        expect(await badgeRows(user.id)).toHaveLength(1);
        expect(await badgeAudit()).toHaveLength(1);
    });

    it('two grants at the same time: one wins, the other gets 409', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');

        const results = await Promise.all([
            grant(user.id, token, { type: 'official', reason: 'a' }),
            grant(user.id, token, { type: 'official', reason: 'b' }),
        ]);

        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(await badgeRows(user.id)).toHaveLength(1);
        expect(await badgeAudit()).toHaveLength(1);
    });

    it('does not touch another user', async () => {
        const [a, b] = [await makeUser(), await makeUser()];
        await grant(a.id, await staffToken('owner'), { type: 'official', reason: 'x' });

        expect(await badgeRows(b.id)).toHaveLength(0);
    });
});

describe('revoke', () => {
    it('sets revoked_at, keeps the row, returns the detail and writes one audit row', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');
        await grant(user.id, token, { type: 'official', reason: 'start' });

        const res = await revoke(user.id, 'official', token, { reason: ' left the team ' });

        expect(res.status).toBe(200);
        expect(res.body.badges).toEqual([]);

        const rows = await badgeRows(user.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].revokedAt).toBeInstanceOf(Date);

        const audit = (await badgeAudit()).filter((r) => r.action === 'badge.revoke');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            targetType: 'user',
            targetId: user.id,
            reason: 'left the team',
            metadata: { email: user.email, username: user.username, badge: 'official' },
        });
    });

    it('needs a reason: missing, blank, not text, or too long', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');
        await grant(user.id, token, { type: 'official', reason: 'start' });

        for (const body of [undefined, {}, { reason: '' }, { reason: '   ' }, { reason: 5 }, { reason: 'x'.repeat(501) }]) {
            const res = await revoke(user.id, 'official', token, body);
            expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 400]);
        }
        expect((await badgeRows(user.id))[0].revokedAt).toBeNull();
        expect((await badgeAudit()).filter((r) => r.action === 'badge.revoke')).toHaveLength(0);
    });

    it('refuses an unknown type in the path', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');

        expect((await revoke(user.id, 'teacher', token, { reason: 'x' })).status).toBe(400);
        expect((await revoke(user.id, 'Official', token, { reason: 'x' })).status).toBe(400);
    });

    it('answers 404 for an unknown user and for an id that is not a UUID', async () => {
        const token = await staffToken('owner');

        expect((await revoke(MISSING_ID, 'official', token, { reason: 'x' })).status).toBe(404);
        expect((await revoke('not-a-uuid', 'official', token, { reason: 'x' })).status).toBe(404);
    });

    it('answers 409 when the user has no such badge, and writes no audit row', async () => {
        const user = await makeUser();

        const res = await revoke(user.id, 'official', await staffToken('owner'), { reason: 'x' });

        expect(res.status).toBe(409);
        expect(await badgeAudit()).toHaveLength(0);
    });

    it('answers 409 for a second revoke', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');
        await grant(user.id, token, { type: 'official', reason: 'start' });
        expect((await revoke(user.id, 'official', token, { reason: 'one' })).status).toBe(200);

        expect((await revoke(user.id, 'official', token, { reason: 'two' })).status).toBe(409);
        expect((await badgeAudit()).filter((r) => r.action === 'badge.revoke')).toHaveLength(1);
    });

    it('allows a grant again after a revoke: two rows, one of them active', async () => {
        const user = await makeUser();
        const token = await staffToken('owner');
        await grant(user.id, token, { type: 'official', reason: 'one' });
        await revoke(user.id, 'official', token, { reason: 'two' });

        const res = await grant(user.id, token, { type: 'official', reason: 'three' });

        expect(res.status).toBe(200);
        expect(res.body.badges).toHaveLength(1);
        const rows = await badgeRows(user.id);
        expect(rows).toHaveLength(2);
        expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
        expect((await badgeAudit()).map((r) => r.action)).toEqual(['badge.grant', 'badge.revoke', 'badge.grant']);
    });
});

describe('admin user detail', () => {
    it('has an empty badge list by default', async () => {
        const user = await makeUser();

        const res = await detail(user.id, await staffToken('viewer'));

        expect(res.status).toBe(200);
        expect(res.body.badges).toEqual([]);
    });

    it('shows the active badge to every role that can read users, and not a revoked one', async () => {
        const [granted, revokedUser] = [await makeUser(), await makeUser()];
        const owner = await staffToken('owner');
        await grant(granted.id, owner, { type: 'official', reason: 'x' });
        await grant(revokedUser.id, owner, { type: 'official', reason: 'x' });
        await revoke(revokedUser.id, 'official', owner, { reason: 'y' });

        for (const role of ['viewer', 'support', 'admin', 'owner']) {
            const token = role === 'owner' ? owner : await staffToken(role);
            const res = await detail(granted.id, token);
            expect([role, res.body.badges.map((b) => b.type)]).toEqual([role, ['official']]);
        }
        expect((await detail(revokedUser.id, owner)).body.badges).toEqual([]);
    });

    it('still shows the badge of a banned account, so staff can revoke it', async () => {
        const user = await makeUser();
        const owner = await staffToken('owner');
        await grant(user.id, owner, { type: 'official', reason: 'x' });
        await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, user.id));

        const res = await detail(user.id, owner);

        expect(res.body.status).toBe('banned');
        expect(res.body.badges.map((b) => b.type)).toEqual(['official']);
        expect((await revoke(user.id, 'official', owner, { reason: 'banned' })).status).toBe(200);
    });

    it('shows the badge actions in the audit history, with the reason', async () => {
        const user = await makeUser();
        const owner = await staffToken('owner');
        await grant(user.id, owner, { type: 'official', reason: 'Ladu team account' });

        const res = await detail(user.id, owner);

        expect(res.body.audit).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'badge.grant',
                    reason: 'Ladu team account',
                    staffName: 'owner person',
                    metadata: expect.objectContaining({ badge: 'official' }),
                }),
            ]),
        );
    });
});
