// Admin dashboard slice 4 — read-only user list and detail.
// See .context/plans/admin-dashboard.md §3.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, translations, tags, friendships, practiceSessions, oauthIdentities, loginEvents, auditLog, staffAccounts } = require('../src/db/schema');
const { eq } = require('drizzle-orm');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const PASSWORD = 'correct-horse-battery';

const staffToken = async (role = 'viewer') => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: PASSWORD, role });
    const res = await request(app).post('/api/admin/auth/login').send({ email, password: PASSWORD });
    return res.body.token;
};
const get = (path, token) => request(app).get(path).set('Authorization', `Bearer ${token}`);

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.com`,
            username: `user${seq}`,
            password: 'bcrypt-hash-that-must-never-leak',
            languages: ['English', 'Spanish'],
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};

const days = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('access', () => {
    it('rejects a missing token, a learner token and a disabled staff member', async () => {
        const user = await makeUser();
        const token = await staffToken('viewer');

        expect((await request(app).get('/api/admin/users')).status).toBe(401);
        expect((await get('/api/admin/users', global.signin(user.id))).status).toBe(401);
        expect((await get(`/api/admin/users/${user.id}`, global.signin(user.id))).status).toBe(401);

        await db.update(staffAccounts).set({ disabledAt: new Date() });
        expect((await get('/api/admin/users', token)).status).toBe(401);
    });

    it('lets every role read', async () => {
        for (const role of ['viewer', 'support', 'admin', 'owner']) {
            expect((await get('/api/admin/users', await staffToken(role))).status).toBe(200);
        }
    });
});

describe('GET /api/admin/users', () => {
    it('returns the listed fields and never the password hash', async () => {
        const user = await makeUser({ lastLoginAt: days(1), lastLoginCountry: 'EE' });
        const token = await staffToken();

        const res = await get('/api/admin/users', token);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 25 });
        expect(res.body.items[0]).toMatchObject({
            email: user.email,
            status: 'active',
            verified: true,
            hasPassword: true,
            hasGoogle: false,
            lastLoginCountry: 'EE',
        });
        expect(JSON.stringify(res.body)).not.toMatch(/password"|bcrypt-hash/);
    });

    it('searches email, username and name, case-insensitively', async () => {
        await makeUser({ name: 'Kaja Tamm', email: 'kaja@example.com', username: 'kt' });
        await makeUser({ name: 'Other', email: 'other@example.com', username: 'tammsaare' });
        await makeUser({ name: 'Nobody', email: 'nobody@example.com', username: 'nobody' });
        const token = await staffToken();

        const byName = await get('/api/admin/users?search=KAJA', token);
        const byUsernameOrName = await get('/api/admin/users?search=tamm', token);
        const byEmailPart = await get('/api/admin/users?search=nobody@', token);

        expect(byName.body.items.map((u) => u.name)).toEqual(['Kaja Tamm']);
        expect(byUsernameOrName.body.total).toBe(2);
        expect(byEmailPart.body.items.map((u) => u.name)).toEqual(['Nobody']);
    });

    it('treats % and _ in a search as plain characters', async () => {
        await makeUser({ name: '100% sure', email: 'a@example.com', username: 'a' });
        await makeUser({ name: 'plain', email: 'b@example.com', username: 'b' });
        const token = await staffToken();

        expect((await get('/api/admin/users?search=' + encodeURIComponent('%'), token)).body.total).toBe(1);
        expect((await get('/api/admin/users?search=' + encodeURIComponent('_'), token)).body.total).toBe(0);
    });

    it('filters by status', async () => {
        await makeUser({ username: 'ok' });
        await makeUser({ username: 'banned', bannedAt: new Date() });
        await makeUser({ username: 'deleted', deletedAt: new Date() });
        await makeUser({ username: 'both', bannedAt: new Date(), deletedAt: new Date() });
        const token = await staffToken();
        const names = async (status) =>
            (await get(`/api/admin/users?status=${status}`, token)).body.items.map((u) => u.username).sort();

        expect(await names('active')).toEqual(['ok']);
        expect(await names('banned')).toEqual(['banned']);
        expect(await names('deleted')).toEqual(['both', 'deleted']);
        expect((await get('/api/admin/users', token)).body.total).toBe(4);
        expect((await get('/api/admin/users', token)).body.items.find((u) => u.username === 'both').status).toBe('deleted');
    });

    it('filters by verified, counting NULL as not verified', async () => {
        await makeUser({ username: 'yes', verified: true });
        await makeUser({ username: 'no', verified: false });
        await makeUser({ username: 'unset', verified: null });
        const token = await staffToken();

        const yes = await get('/api/admin/users?verified=true', token);
        const no = await get('/api/admin/users?verified=false', token);

        expect(yes.body.items.map((u) => u.username)).toEqual(['yes']);
        expect(no.body.items.map((u) => u.username).sort()).toEqual(['no', 'unset']);
    });

    it('filters by sign-in method and flags a Google link', async () => {
        const both = await makeUser({ username: 'both' });
        await makeUser({ username: 'pw' });
        const google = await makeUser({ username: 'google', password: null });
        for (const u of [both, google]) {
            await db.insert(oauthIdentities).values({ userId: u.id, provider: 'google', providerUserId: `sub-${u.id}`, emailAtLink: u.email });
        }
        const token = await staffToken();
        const names = async (method) => (await get(`/api/admin/users?method=${method}`, token)).body.items.map((u) => u.username).sort();

        expect(await names('password')).toEqual(['both', 'pw']);
        expect(await names('google')).toEqual(['both', 'google']);
        const all = (await get('/api/admin/users', token)).body.items;
        expect(all.find((u) => u.username === 'google')).toMatchObject({ hasPassword: false, hasGoogle: true });
    });

    it('sorts with never-logged-in users last in both directions', async () => {
        await makeUser({ username: 'old', lastLoginAt: days(10) });
        await makeUser({ username: 'new', lastLoginAt: days(1) });
        await makeUser({ username: 'never' });
        const token = await staffToken();
        const order = async (dir) =>
            (await get(`/api/admin/users?sort=lastLoginAt&order=${dir}`, token)).body.items.map((u) => u.username);

        expect(await order('desc')).toEqual(['new', 'old', 'never']);
        expect(await order('asc')).toEqual(['old', 'new', 'never']);
    });

    it('sorts by name, and defaults to newest registration first', async () => {
        await makeUser({ name: 'Bea', username: 'b', createdAt: days(3) });
        await makeUser({ name: 'Ann', username: 'a', createdAt: days(1) });
        await makeUser({ name: 'Cyd', username: 'c', createdAt: days(2) });
        const token = await staffToken();

        expect((await get('/api/admin/users', token)).body.items.map((u) => u.name)).toEqual(['Ann', 'Cyd', 'Bea']);
        expect((await get('/api/admin/users?sort=name&order=asc', token)).body.items.map((u) => u.name)).toEqual(['Ann', 'Bea', 'Cyd']);
    });

    it('paginates without repeating or skipping rows, even with equal sort values', async () => {
        for (let i = 0; i < 5; i += 1) await makeUser({ lastLoginAt: null });
        const token = await staffToken();

        const pages = [];
        for (const page of [1, 2, 3]) {
            pages.push(await get(`/api/admin/users?pageSize=2&page=${page}&sort=lastLoginAt`, token));
        }

        expect(pages.map((p) => p.body.items.length)).toEqual([2, 2, 1]);
        expect(pages[0].body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
        const ids = pages.flatMap((p) => p.body.items.map((u) => u.id));
        expect(new Set(ids).size).toBe(5);
    });

    it('returns an empty page past the end', async () => {
        await makeUser();
        const res = await get('/api/admin/users?page=9', await staffToken());

        expect(res.body).toMatchObject({ items: [], total: 1, page: 9 });
    });

    it('rejects invalid parameters with 400', async () => {
        const token = await staffToken();
        const bad = [
            'page=0',
            'page=abc',
            'page=1.5',
            'pageSize=0',
            'pageSize=101',
            'sort=password',
            'sort=id;drop',
            'order=sideways',
            'status=gone',
            'verified=maybe',
            'method=sms',
        ];

        for (const query of bad) {
            const res = await get(`/api/admin/users?${query}`, token);
            expect([query, res.status]).toEqual([query, 400]);
        }
    });

    it('ignores array-shaped parameters instead of crashing', async () => {
        await makeUser();
        const res = await get('/api/admin/users?search[]=a&status[]=banned', await staffToken());

        expect(res.status).toBe(400);
    });
});

describe('GET /api/admin/users/:id', () => {
    it('returns the profile, sign-in methods and no password hash', async () => {
        const user = await makeUser({ nativeLanguage: 'Estonian', theme: 'dark', lastSeenAt: days(1) });
        await db.insert(oauthIdentities).values({ userId: user.id, provider: 'google', providerUserId: 's1', emailAtLink: 'g@example.com' });

        const res = await get(`/api/admin/users/${user.id}`, await staffToken());

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            id: user.id,
            email: user.email,
            status: 'active',
            languages: ['English', 'Spanish'],
            nativeLanguage: 'Estonian',
            theme: 'dark',
            verified: true,
            hasPassword: true,
            identities: [{ provider: 'google', emailAtLink: 'g@example.com' }],
        });
        expect(JSON.stringify(res.body)).not.toMatch(/bcrypt-hash|"password"/);
    });

    it('counts words, translations, tags, accepted friends and saved sessions for this user only', async () => {
        const user = await makeUser();
        const other = await makeUser();
        const third = await makeUser();
        const [w1, w2] = await db.insert(words).values([
            { userId: user.id, partOfSpeech: 'Noun' },
            { userId: user.id, partOfSpeech: 'Verb' },
        ]).returning();
        const [otherWord] = await db.insert(words).values({ userId: other.id, partOfSpeech: 'Noun' }).returning();
        await db.insert(translations).values([
            { wordId: w1.id, language: 'English' },
            { wordId: w1.id, language: 'Spanish' },
            { wordId: w2.id, language: 'English' },
            { wordId: otherWord.id, language: 'English' },
        ]);
        await db.insert(tags).values([
            { authorId: user.id, label: 'a', visibility: 'Private' },
            { authorId: other.id, label: 'b', visibility: 'Private' },
        ]);
        await db.insert(friendships).values([
            { requesterId: user.id, addresseeId: other.id, status: 'accepted' },
            { requesterId: third.id, addresseeId: user.id, status: 'accepted' },
            { requesterId: user.id, addresseeId: third.id, status: 'pending' },
        ]);
        const session = { snapshot: {}, summary: {}, expiresAt: new Date(Date.now() + 1e7) };
        await db.insert(practiceSessions).values([{ userId: user.id, ...session }, { userId: other.id, ...session }]);

        const res = await get(`/api/admin/users/${user.id}`, await staffToken());

        expect(res.body.counts).toEqual({ words: 2, translations: 3, tags: 1, friends: 2, practiceSessions: 1 });
    });

    it('returns zero counts for a new account', async () => {
        const user = await makeUser();

        const res = await get(`/api/admin/users/${user.id}`, await staffToken());

        expect(res.body.counts).toEqual({ words: 0, translations: 0, tags: 0, friends: 0, practiceSessions: 0 });
        expect(res.body.recentLogins).toEqual([]);
    });

    it('returns the 20 newest logins, newest first', async () => {
        const user = await makeUser();
        await db.insert(loginEvents).values(
            Array.from({ length: 25 }, (_, i) => ({
                userId: user.id,
                method: i % 2 ? 'google' : 'password',
                country: i === 24 ? 'EE' : null,
                createdAt: new Date(Date.now() - (25 - i) * 60_000),
            })),
        );

        const res = await get(`/api/admin/users/${user.id}`, await staffToken());

        expect(res.body.recentLogins).toHaveLength(20);
        expect(res.body.recentLogins[0]).toMatchObject({ method: 'password', country: 'EE' });
        const times = res.body.recentLogins.map((l) => new Date(l.createdAt).getTime());
        expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('reports a ban reason, and who deleted the account', async () => {
        const staff = await createStaff({ email: 'del@example.com', name: 'Dee Leter', password: PASSWORD, role: 'admin' });
        const banned = await makeUser({ bannedAt: new Date(), banReason: 'spam' });
        const deleted = await makeUser({ deletedAt: new Date(), deletedByStaffId: staff.id });
        const token = await staffToken();

        const b = await get(`/api/admin/users/${banned.id}`, token);
        const d = await get(`/api/admin/users/${deleted.id}`, token);

        expect(b.body).toMatchObject({ status: 'banned', banReason: 'spam' });
        expect(d.body).toMatchObject({ status: 'deleted', deletedByStaffName: 'Dee Leter' });
    });

    describe('audit history', () => {
        const seedAudit = async (userId) => {
            const [staff] = await db.select().from(staffAccounts).limit(1);
            await db.insert(auditLog).values([
                { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: userId, reason: 'spam' },
                { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: 'someone-else' },
                { staffId: staff.id, action: 'staff.login', targetType: 'staff', targetId: userId },
            ]);
        };

        it('is null for roles without audit.read', async () => {
            const user = await makeUser();
            for (const role of ['viewer', 'support']) {
                const res = await get(`/api/admin/users/${user.id}`, await staffToken(role));
                expect([role, res.body.audit]).toEqual([role, null]);
            }
        });

        it('lists only this user\'s entries, with the staff name, for admin and owner', async () => {
            const user = await makeUser();
            const adminToken = await staffToken('admin');
            await seedAudit(user.id);

            for (const token of [adminToken, await staffToken('owner')]) {
                const res = await get(`/api/admin/users/${user.id}`, token);
                expect(res.body.audit).toHaveLength(1);
                expect(res.body.audit[0]).toMatchObject({ action: 'user.ban', reason: 'spam', staffName: 'admin person' });
            }
        });

        it('is an empty list, not null, when a permitted role has nothing to show', async () => {
            const user = await makeUser();

            const res = await get(`/api/admin/users/${user.id}`, await staffToken('admin'));

            expect(res.body.audit).toEqual([]);
        });
    });

    it('returns 404 for an unknown id and for text that is not a UUID', async () => {
        const token = await staffToken();

        expect((await get('/api/admin/users/00000000-0000-4000-8000-000000000000', token)).status).toBe(404);
        expect((await get('/api/admin/users/not-a-uuid', token)).status).toBe(404);
    });

    it('still shows a soft-deleted user', async () => {
        const user = await makeUser({ deletedAt: new Date() });

        const res = await get(`/api/admin/users/${user.id}`, await staffToken());

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('deleted');
    });
});
