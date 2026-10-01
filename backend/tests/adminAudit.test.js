// Admin dashboard slice 8 — the audit log viewer's API (read only, audit.read).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { auditLog, staffAccounts, users } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const PASSWORD = 'correct-horse-battery';
const tokenFor = async (role, name = `${role} person`) => {
    const staff = await createStaff({ email: `${role}@example.com`, name, password: PASSWORD, role });
    const res = await request(app).post('/api/admin/auth/login').send({ email: staff.email, password: PASSWORD });
    return { staff, token: res.body.token };
};
const get = (path, token) => request(app).get(path).set('Authorization', `Bearer ${token}`);
const minutesAgo = (n) => new Date(Date.now() - n * 60_000);
// Login rows are written by the test's own sign-in; wipe them so the data below is all there is.
const resetAudit = () => db.delete(auditLog);

const insert = (values) => db.insert(auditLog).values(values);

describe('access', () => {
    it('is closed to viewer and support, open to admin and owner', async () => {
        for (const [role, status] of [['viewer', 403], ['support', 403], ['admin', 200], ['owner', 200]]) {
            const { token } = await tokenFor(role);
            for (const path of ['/api/admin/audit', '/api/admin/audit/filters']) {
                const res = await get(path, token);
                expect([role, path, res.status]).toEqual([role, path, status]);
            }
        }
    });

    it('refuses no token and a learner token', async () => {
        const [learner] = await db.insert(users).values({ name: 'L', email: 'l@example.com', username: 'l', languages: ['English', 'Spanish'] }).returning();

        expect((await request(app).get('/api/admin/audit')).status).toBe(401);
        expect((await get('/api/admin/audit', global.signin(learner.id))).status).toBe(401);
    });
});

describe('GET /api/admin/audit', () => {
    it('lists the rows newest first, with the staff name, the target and the reason', async () => {
        const { token, staff } = await tokenFor('admin', 'Alice Admin');
        await resetAudit();
        await insert([
            { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: 'u1', reason: 'spam', metadata: { email: 'a@x.test' }, createdAt: minutesAgo(30) },
            { staffId: staff.id, action: 'user.unban', targetType: 'user', targetId: 'u1', createdAt: minutesAgo(10) },
        ]);

        const res = await get('/api/admin/audit', token);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 25 });
        expect(res.body.items.map((i) => i.action)).toEqual(['user.unban', 'user.ban']);
        expect(res.body.items[1]).toMatchObject({
            staffId: staff.id,
            staffName: 'Alice Admin',
            targetType: 'user',
            targetId: 'u1',
            reason: 'spam',
            metadata: { email: 'a@x.test' },
        });
    });

    it('shows "System" for a row with no staff member, and the target name for a staff target', async () => {
        const { token, staff } = await tokenFor('owner', 'Olga Owner');
        const target = await createStaff({ email: 'target@example.com', name: 'Target Person', password: PASSWORD, role: 'viewer' });
        await resetAudit();
        await insert([
            { staffId: null, action: 'user.purge', targetType: 'user', targetId: 'gone', reason: 'job', metadata: { actor: 'system' }, createdAt: minutesAgo(5) },
            { staffId: staff.id, action: 'staff.disable', targetType: 'staff', targetId: target.id, createdAt: minutesAgo(10) },
            { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: target.id, createdAt: minutesAgo(20) },
        ]);

        const { items } = (await get('/api/admin/audit', token)).body;

        expect(items[0]).toMatchObject({ staffId: null, staffName: 'System', targetStaffName: null });
        expect(items[1]).toMatchObject({ staffName: 'Olga Owner', targetType: 'staff', targetStaffName: 'Target Person' });
        // Only a row about a staff member gets a staff name, even if the ids look alike.
        expect(items[2].targetStaffName).toBeNull();
    });

    it('filters by staff member, by "system", by action and by dates, alone and together', async () => {
        const { token, staff: a } = await tokenFor('admin', 'Alice');
        const { staff: b } = await tokenFor('owner', 'Bob');
        await resetAudit();
        await insert([
            { staffId: a.id, action: 'user.ban', targetType: 'user', targetId: '1', createdAt: new Date('2026-09-01T10:00:00Z') },
            { staffId: a.id, action: 'user.unban', targetType: 'user', targetId: '1', createdAt: new Date('2026-09-02T10:00:00Z') },
            { staffId: b.id, action: 'user.ban', targetType: 'user', targetId: '2', createdAt: new Date('2026-09-03T10:00:00Z') },
            { staffId: null, action: 'user.purge', targetType: 'user', targetId: '3', createdAt: new Date('2026-09-04T10:00:00Z') },
        ]);
        const ids = async (query) => (await get(`/api/admin/audit?${query}`, token)).body.items.map((i) => `${i.staffName}:${i.action}`);

        expect(await ids(`staff=${a.id}`)).toEqual(['Alice:user.unban', 'Alice:user.ban']);
        expect(await ids('staff=system')).toEqual(['System:user.purge']);
        expect(await ids('action=user.ban')).toEqual(['Bob:user.ban', 'Alice:user.ban']);
        expect(await ids(`staff=${a.id}&action=user.ban`)).toEqual(['Alice:user.ban']);
        // `from` is included, `to` is not.
        expect(await ids('from=2026-09-02T00:00:00Z&to=2026-09-04T00:00:00Z')).toEqual(['Bob:user.ban', 'Alice:user.unban']);
        expect(await ids('from=2026-09-03T10:00:00Z')).toEqual(['System:user.purge', 'Bob:user.ban']);
        expect(await ids('to=2026-09-02T10:00:00Z')).toEqual(['Alice:user.ban']);
        expect(await ids('action=nothing.here')).toEqual([]);
        expect((await get('/api/admin/audit?action=nothing.here', token)).body).toMatchObject({ items: [], total: 0 });
    });

    it('treats a blank filter as not set', async () => {
        const { token } = await tokenFor('admin');
        await resetAudit();
        await insert({ staffId: null, action: 'user.purge', targetType: 'user', targetId: '1' });

        const res = await get('/api/admin/audit?staff=&action=&from=&to=', token);

        expect(res.body.total).toBe(1);
    });

    it('pages without repeating or skipping rows, also when many rows share one time', async () => {
        const { token, staff } = await tokenFor('admin');
        await resetAudit();
        const same = new Date('2026-09-10T10:00:00Z');
        await insert(Array.from({ length: 7 }, (_, i) => ({ staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: String(i), createdAt: same })));

        const pages = [];
        for (const page of [1, 2, 3, 4]) pages.push(await get(`/api/admin/audit?pageSize=3&page=${page}`, token));

        expect(pages.map((p) => p.body.items.length)).toEqual([3, 3, 1, 0]);
        expect(pages[0].body).toMatchObject({ total: 7, page: 1, pageSize: 3 });
        const all = pages.flatMap((p) => p.body.items.map((i) => i.id));
        expect(new Set(all).size).toBe(7);
    });

    it('refuses bad parameters with 400', async () => {
        const { token } = await tokenFor('admin');
        const bad = [
            'page=0', 'page=abc', 'page=1.5', 'pageSize=0', 'pageSize=101',
            'staff=not-a-uuid', 'staff[]=x', 'action[]=x', `action=${'x'.repeat(65)}`,
            'from=yesterday', 'to=not-a-date', 'from[]=2026-09-01',
            'from=2026-09-02T00:00:00Z&to=2026-09-01T00:00:00Z', 'from=2026-09-02T00:00:00Z&to=2026-09-02T00:00:00Z',
        ];

        for (const query of bad) {
            const res = await get(`/api/admin/audit?${query}`, token);
            expect([query, res.status]).toEqual([query, 400]);
        }
    });
});

describe('GET /api/admin/audit/filters', () => {
    it('returns each action once, sorted, and every staff member by name', async () => {
        const { token, staff } = await tokenFor('admin', 'Zed');
        await createStaff({ email: 'amy@example.com', name: 'Amy', password: PASSWORD, role: 'viewer' });
        await resetAudit();
        await insert([
            { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: '1' },
            { staffId: staff.id, action: 'user.ban', targetType: 'user', targetId: '2' },
            { staffId: null, action: 'user.purge', targetType: 'user', targetId: '3' },
            { staffId: staff.id, action: 'staff.create', targetType: 'staff', targetId: '4' },
        ]);

        const res = await get('/api/admin/audit/filters', token);

        expect(res.body.actions).toEqual(['staff.create', 'user.ban', 'user.purge']);
        expect(res.body.staff.map((s) => s.name)).toEqual(['Amy', 'Zed']);
        expect(Object.keys(res.body.staff[0]).sort()).toEqual(['id', 'name']);
    });
});

describe('what the page can show', () => {
    it('does not put any password data into a row', async () => {
        const { token } = await tokenFor('admin');

        const text = JSON.stringify((await get('/api/admin/audit', token)).body);

        expect(text).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
        expect((await db.select().from(staffAccounts)).length).toBe(1);
    });
});
