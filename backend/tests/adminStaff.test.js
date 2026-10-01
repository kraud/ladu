// Admin dashboard slice 8 — staff management (owner only).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { staffAccounts, auditLog, users } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const PASSWORD = 'correct-horse-battery';
const TEMP = 'temporary-pass-123';

const makeStaff = (role, overrides = {}) =>
    createStaff({ email: `${role}@example.com`, name: `${role} person`, password: PASSWORD, role, ...overrides });
const login = (email, password = PASSWORD) => request(app).post('/api/admin/auth/login').send({ email, password });
const tokenFor = async (role, overrides) => {
    const staff = await makeStaff(role, overrides);
    return { staff, token: (await login(staff.email)).body.token };
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const get = (path, token) => request(app).get(path).set(auth(token));
const post = (path, token, body) => request(app).post(path).set(auth(token)).send(body ?? {});
const row = async (id) => (await db.select().from(staffAccounts).where(eq(staffAccounts.id, id)))[0];
const auditActions = async () => (await db.select().from(auditLog).orderBy(auditLog.createdAt)).map((r) => r.action).filter((a) => a !== 'staff.login');
const newStaffBody = (overrides = {}) => ({ email: 'new@example.com', name: 'New Person', role: 'support', password: TEMP, ...overrides });

describe('access', () => {
    it('is closed to everyone but owners, on every route', async () => {
        const { staff: owner, token: ownerToken } = await tokenFor('owner');
        const target = await makeStaff('viewer', { email: 'target@example.com' });
        const routes = [
            ['get', '/api/admin/staff'],
            ['post', '/api/admin/staff', newStaffBody()],
            ['post', `/api/admin/staff/${target.id}/role`, { role: 'admin' }],
            ['post', `/api/admin/staff/${target.id}/disable`, { reason: 'x' }],
            ['post', `/api/admin/staff/${target.id}/enable`, {}],
            ['post', `/api/admin/staff/${target.id}/reset-password`, { password: TEMP }],
        ];

        for (const role of ['viewer', 'support', 'admin']) {
            const { token } = await tokenFor(role, { email: `${role}-actor@example.com` });
            for (const [method, path, body] of routes) {
                const res = method === 'get' ? await get(path, token) : await post(path, token, body);
                expect([role, method, path, res.status]).toEqual([role, method, path, 403]);
            }
        }
        expect((await get('/api/admin/staff', ownerToken)).status).toBe(200);
        expect(owner.id).toBeDefined();
        // Nothing was changed by the refused requests.
        expect(await auditActions()).toEqual([]);
        expect((await row(target.id)).role).toBe('viewer');
    });

    it('refuses no token and a learner token', async () => {
        const [learner] = await db.insert(users).values({ name: 'L', email: 'l@example.com', username: 'l', languages: ['English', 'Spanish'] }).returning();

        expect((await request(app).get('/api/admin/staff')).status).toBe(401);
        expect((await get('/api/admin/staff', global.signin(learner.id))).status).toBe(401);
    });
});

describe('GET /api/admin/staff', () => {
    it('lists every account oldest first, without any password data', async () => {
        const { token } = await tokenFor('owner');
        await makeStaff('viewer');
        const disabled = await makeStaff('support');
        await db.update(staffAccounts).set({ disabledAt: new Date() }).where(eq(staffAccounts.id, disabled.id));

        const res = await get('/api/admin/staff', token);

        expect(res.status).toBe(200);
        expect(res.body.items.map((s) => s.role)).toEqual(['owner', 'viewer', 'support']);
        expect(res.body.items.map((s) => s.status)).toEqual(['active', 'active', 'disabled']);
        expect(Object.keys(res.body.items[0]).sort()).toEqual(
            ['createdAt', 'email', 'id', 'lastLoginAt', 'mustChangePassword', 'name', 'passwordChangedAt', 'role', 'status'].sort(),
        );
        expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });
});

describe('POST /api/admin/staff (create)', () => {
    it('creates an account with a temporary password, and writes one audit row without it', async () => {
        const { token, staff: owner } = await tokenFor('owner');

        const res = await post('/api/admin/staff', token, newStaffBody({ email: '  New@Example.COM ', reason: 'new support hire' }));

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ email: 'new@example.com', name: 'New Person', role: 'support', status: 'active', mustChangePassword: true });
        const audit = (await db.select().from(auditLog)).filter((r) => r.action === 'staff.create');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: owner.id,
            targetType: 'staff',
            targetId: res.body.id,
            reason: 'new support hire',
            metadata: { email: 'new@example.com', name: 'New Person', role: 'support' },
        });
        expect(JSON.stringify(audit)).not.toContain(TEMP);
    });

    it('lets the new person sign in with the temporary password, and tells them to change it', async () => {
        const { token } = await tokenFor('owner');
        await post('/api/admin/staff', token, newStaffBody());

        const res = await login('new@example.com', TEMP);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ role: 'support', mustChangePassword: true });
    });

    it('can make an owner, because only owners can reach this route', async () => {
        const { token } = await tokenFor('owner');

        const res = await post('/api/admin/staff', token, newStaffBody({ role: 'owner' }));

        expect(res.body.role).toBe('owner');
    });

    it('refuses bad input with 400 and writes nothing', async () => {
        const { token } = await tokenFor('owner');
        const bad = [
            ['no body', undefined],
            ['no email', newStaffBody({ email: undefined })],
            ['email not text', newStaffBody({ email: 5 })],
            ['email without @', newStaffBody({ email: 'nope' })],
            ['blank name', newStaffBody({ name: '   ' })],
            ['name not text', newStaffBody({ name: ['x'] })],
            ['unknown role', newStaffBody({ role: 'root' })],
            ['inherited role name', newStaffBody({ role: 'constructor' })],
            ['no role', newStaffBody({ role: undefined })],
            ['short password', newStaffBody({ password: 'short' })],
            ['no password', newStaffBody({ password: undefined })],
            ['password not text', newStaffBody({ password: 12345678901234 })],
            ['password over 72 bytes', newStaffBody({ password: 'a'.repeat(73) })],
            ['password over 72 bytes (multi-byte)', newStaffBody({ password: 'é'.repeat(37) })],
            ['reason too long', newStaffBody({ reason: 'x'.repeat(501) })],
            ['reason not text', newStaffBody({ reason: 5 })],
        ];

        for (const [name, body] of bad) {
            const res = await post('/api/admin/staff', token, body);
            expect([name, res.status]).toEqual([name, 400]);
        }
        expect((await db.select().from(staffAccounts))).toHaveLength(1);
        expect(await auditActions()).toEqual([]);
    });

    it('accepts a password of exactly 72 bytes and exactly 12 characters', async () => {
        const { token } = await tokenFor('owner');

        expect((await post('/api/admin/staff', token, newStaffBody({ email: 'a@example.com', password: 'a'.repeat(72) }))).status).toBe(201);
        expect((await post('/api/admin/staff', token, newStaffBody({ email: 'b@example.com', password: 'b'.repeat(12) }))).status).toBe(201);
    });

    it('refuses a duplicate email, whatever its case, with 409 and no audit row', async () => {
        const { token } = await tokenFor('owner');
        await post('/api/admin/staff', token, newStaffBody());

        const res = await post('/api/admin/staff', token, newStaffBody({ email: 'NEW@example.com' }));

        expect([res.status, res.body.message]).toEqual([409, 'A staff account with this email already exists']);
        expect((await auditActions()).filter((a) => a === 'staff.create')).toHaveLength(1);
        expect(await db.select().from(staffAccounts)).toHaveLength(2);
    });
});

describe('a temporary password', () => {
    const setup = async () => {
        const { token: ownerToken } = await tokenFor('owner');
        await post('/api/admin/staff', ownerToken, newStaffBody({ role: 'admin' }));
        const res = await login('new@example.com', TEMP);
        return { ownerToken, token: res.body.token, id: res.body.id };
    };

    it('lets a person use only `me` until they change it; every other route answers 403 with a code', async () => {
        const { token } = await setup();

        const me = await get('/api/admin/auth/me', token);
        expect(me.status).toBe(200);
        expect(me.body.mustChangePassword).toBe(true);

        for (const path of ['/api/admin/users', '/api/admin/health', '/api/admin/audit', '/api/admin/staff']) {
            const res = await get(path, token);
            expect([path, res.status, res.body.code]).toEqual([path, 403, 'password_change_required']);
        }
        expect((await post('/api/admin/users/00000000-0000-4000-8000-000000000000/ban', token, { reason: 'x' })).status).toBe(403);
    });

    it('is answered before the permission rule, so the UI always learns about it first', async () => {
        const { token } = await setup();

        // An admin has no `staff.manage`; the answer is still the password rule, not a plain 403.
        expect((await get('/api/admin/staff', token)).body.code).toBe('password_change_required');
    });

    it('opens every route once the password is changed', async () => {
        const { token } = await setup();

        const changed = await post('/api/admin/auth/change-password', token, { currentPassword: TEMP, newPassword: 'my-own-new-password' });

        expect(changed.status).toBe(200);
        expect(changed.body.mustChangePassword).toBe(false);
        expect((await get('/api/admin/users', changed.body.token)).status).toBe(200);
    });
});

describe('role change', () => {
    it('changes the role at once, and writes the old and the new role to the audit log', async () => {
        const { token, staff: owner } = await tokenFor('owner');
        const { staff: target, token: targetToken } = await tokenFor('support');
        expect((await post(`/api/admin/users/00000000-0000-4000-8000-000000000000/ban`, targetToken, { reason: 'x' })).status).toBe(404); // allowed to try: has users.ban

        const res = await post(`/api/admin/staff/${target.id}/role`, token, { role: 'viewer', reason: 'moved to reading only' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('viewer');
        // The same token, a new role: refused where it was allowed a moment ago.
        expect((await post(`/api/admin/users/00000000-0000-4000-8000-000000000000/ban`, targetToken, { reason: 'x' })).status).toBe(403);
        const audit = (await db.select().from(auditLog)).filter((r) => r.action === 'staff.role_change');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            staffId: owner.id,
            targetId: target.id,
            reason: 'moved to reading only',
            metadata: { email: target.email, from: 'support', to: 'viewer' },
        });
    });

    it('promotes to owner, which then gives that person the staff routes', async () => {
        const { token } = await tokenFor('owner');
        const { staff: target, token: targetToken } = await tokenFor('admin');
        expect((await get('/api/admin/staff', targetToken)).status).toBe(403);

        await post(`/api/admin/staff/${target.id}/role`, token, { role: 'owner' });

        expect((await get('/api/admin/staff', targetToken)).status).toBe(200);
    });

    it('refuses: your own account, the role it already has, an unknown role, and an unknown account', async () => {
        const { token, staff: owner } = await tokenFor('owner');
        const { staff: target } = await tokenFor('support');

        const own = await post(`/api/admin/staff/${owner.id}/role`, token, { role: 'viewer' });
        const same = await post(`/api/admin/staff/${target.id}/role`, token, { role: 'support' });
        const bad = await post(`/api/admin/staff/${target.id}/role`, token, { role: 'root' });
        const none = await post(`/api/admin/staff/${target.id}/role`, token, {});
        const missing = await post('/api/admin/staff/00000000-0000-4000-8000-000000000000/role', token, { role: 'viewer' });
        const notUuid = await post('/api/admin/staff/not-a-uuid/role', token, { role: 'viewer' });

        expect([own.status, own.body.message]).toEqual([409, 'You cannot do this to your own account']);
        expect([same.status, same.body.message]).toEqual([409, 'This account already has this role']);
        expect([bad.status, none.status, missing.status, notUuid.status]).toEqual([400, 400, 404, 404]);
        expect((await row(owner.id)).role).toBe('owner');
        expect((await row(target.id)).role).toBe('support');
        expect(await auditActions()).toEqual([]);
    });
});

describe('disable and enable', () => {
    it('needs a reason, then ends the person\'s sessions at once and blocks their login', async () => {
        const { token } = await tokenFor('owner');
        const { staff: target, token: targetToken } = await tokenFor('support');
        expect((await get('/api/admin/auth/me', targetToken)).status).toBe(200);

        expect((await post(`/api/admin/staff/${target.id}/disable`, token, {})).status).toBe(400);
        expect((await post(`/api/admin/staff/${target.id}/disable`, token, { reason: '   ' })).status).toBe(400);
        const res = await post(`/api/admin/staff/${target.id}/disable`, token, { reason: 'left the team' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('disabled');
        expect((await get('/api/admin/auth/me', targetToken)).status).toBe(401);
        const refused = await login(target.email);
        expect([refused.status, refused.body.message]).toEqual([400, 'Invalid credentials']);
        const audit = (await db.select().from(auditLog)).filter((r) => r.action === 'staff.disable');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ reason: 'left the team', metadata: { email: target.email } });
    });

    it('enables again: the old password works, the old token does not', async () => {
        const { token } = await tokenFor('owner');
        const { staff: target, token: oldToken } = await tokenFor('support');
        await post(`/api/admin/staff/${target.id}/disable`, token, { reason: 'leave' });

        const res = await post(`/api/admin/staff/${target.id}/enable`, token, { reason: 'back from leave' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');
        expect((await login(target.email)).status).toBe(200);
        expect((await get('/api/admin/auth/me', oldToken)).status).toBe(401);
        expect((await auditActions()).filter((a) => a === 'staff.enable')).toHaveLength(1);
    });

    it('refuses: your own account, a second disable, and enabling an account that is not disabled', async () => {
        const { token, staff: owner } = await tokenFor('owner');
        const { staff: target } = await tokenFor('support');

        const own = await post(`/api/admin/staff/${owner.id}/disable`, token, { reason: 'x' });
        const notDisabled = await post(`/api/admin/staff/${target.id}/enable`, token, {});
        await post(`/api/admin/staff/${target.id}/disable`, token, { reason: 'x' });
        const twice = await post(`/api/admin/staff/${target.id}/disable`, token, { reason: 'x' });

        expect(own.status).toBe(409);
        expect([notDisabled.status, notDisabled.body.message]).toEqual([409, 'This account is not disabled']);
        expect([twice.status, twice.body.message]).toEqual([409, 'This account is already disabled']);
        expect((await auditActions()).filter((a) => a === 'staff.disable')).toHaveLength(1);
    });
});

describe('reset password', () => {
    it('sets a new temporary password: the old one and every open session stop, and the person must change it', async () => {
        const { token, staff: owner } = await tokenFor('owner');
        const { staff: target, token: oldToken } = await tokenFor('support');

        const res = await post(`/api/admin/staff/${target.id}/reset-password`, token, { password: 'brand-new-temp-pass', reason: 'forgot it' });

        expect(res.status).toBe(200);
        expect(res.body.mustChangePassword).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain('brand-new-temp-pass');
        expect((await get('/api/admin/auth/me', oldToken)).status).toBe(401);
        expect((await login(target.email, PASSWORD)).status).toBe(400);
        const fresh = await login(target.email, 'brand-new-temp-pass');
        expect([fresh.status, fresh.body.mustChangePassword]).toEqual([200, true]);
        const audit = (await db.select().from(auditLog)).filter((r) => r.action === 'staff.password_reset');
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ staffId: owner.id, targetId: target.id, reason: 'forgot it', metadata: { email: target.email } });
        expect(JSON.stringify(await db.select().from(auditLog))).not.toContain('brand-new-temp-pass');
    });

    it('refuses a weak password, your own account, and an unknown account', async () => {
        const { token, staff: owner } = await tokenFor('owner');
        const { staff: target } = await tokenFor('support');

        expect((await post(`/api/admin/staff/${target.id}/reset-password`, token, { password: 'short' })).status).toBe(400);
        expect((await post(`/api/admin/staff/${target.id}/reset-password`, token, {})).status).toBe(400);
        expect((await post(`/api/admin/staff/${target.id}/reset-password`, token, { password: 'a'.repeat(73) })).status).toBe(400);
        const own = await post(`/api/admin/staff/${owner.id}/reset-password`, token, { password: TEMP });
        expect([own.status, own.body.message]).toEqual([409, 'Use "Change password" for your own account']);
        expect((await post('/api/admin/staff/00000000-0000-4000-8000-000000000000/reset-password', token, { password: TEMP })).status).toBe(404);
        expect((await login(target.email)).status).toBe(200); // still the old password
        expect(await auditActions()).toEqual([]);
    });

    it('works on a disabled account, which stays disabled', async () => {
        const { token } = await tokenFor('owner');
        const { staff: target } = await tokenFor('support');
        await post(`/api/admin/staff/${target.id}/disable`, token, { reason: 'x' });

        const res = await post(`/api/admin/staff/${target.id}/reset-password`, token, { password: TEMP });

        expect([res.status, res.body.status]).toEqual([200, 'disabled']);
    });
});

describe('the owner lock', () => {
    // A statistical race test cannot prove a lock: the window is a few milliseconds. This one is
    // deterministic. Another database session holds a lock on owner C. A request that demotes B
    // must wait for it, because every action that can remove an owner first locks ALL active owners
    // (in a fixed order). Without that lock, the request would only need B, and would not wait.
    it('makes an action that can remove an owner wait for every active owner row', async () => {
        const { token: tokenA } = await tokenFor('owner', { email: 'a@example.com' });
        const b = await makeStaff('owner', { email: 'b@example.com' });
        const c = await makeStaff('owner', { email: 'c@example.com' });

        const holder = await pool.connect();
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM staff_accounts WHERE id = $1 FOR UPDATE', [c.id]);

            let finished = false;
            const pending = post(`/api/admin/staff/${b.id}/role`, tokenA, { role: 'viewer' }).then((res) => {
                finished = true;
                return res;
            });
            await new Promise((resolve) => setTimeout(resolve, 600));
            expect(finished).toBe(false); // still waiting for C's row

            await holder.query('COMMIT');
            const res = await pending;
            expect(res.status).toBe(200);
        } finally {
            await holder.query('ROLLBACK').catch(() => {});
            holder.release();
        }
    });

    it('does not make an action that can never remove an owner wait', async () => {
        const { token: tokenA } = await tokenFor('owner', { email: 'a@example.com' });
        const viewer = await makeStaff('viewer', { email: 'v@example.com' });
        const c = await makeStaff('owner', { email: 'c@example.com' });

        const holder = await pool.connect();
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM staff_accounts WHERE id = $1 FOR UPDATE', [c.id]);

            // A password reset touches only its target, so it must not wait for C.
            const res = await post(`/api/admin/staff/${viewer.id}/reset-password`, tokenA, { password: TEMP });

            expect(res.status).toBe(200);
        } finally {
            await holder.query('ROLLBACK').catch(() => {});
            holder.release();
        }
    });
});

describe('the last active owner', () => {
    it('cannot be demoted or disabled, also by someone whose token is out of date', async () => {
        // Two owners act on each other at the same moment. Without the lock, both checks see
        // "the other one is still an owner", both pass, and nobody is an owner any more.
        const { token: tokenA, staff: a } = await tokenFor('owner', { email: 'a@example.com' });
        const { token: tokenB, staff: b } = await tokenFor('owner', { email: 'b@example.com' });

        const results = await Promise.all([
            post(`/api/admin/staff/${b.id}/role`, tokenA, { role: 'viewer' }),
            post(`/api/admin/staff/${a.id}/role`, tokenB, { role: 'viewer' }),
        ]);

        // Exactly one wins. The other is refused in one of two correct ways, depending on timing:
        // 409 (it passed the permission check, then met the last-owner rule), or 403 (the winner had
        // already demoted it, so it was refused as "Forbidden" before it started). Never both 200.
        const statuses = results.map((r) => r.status).sort();
        expect(statuses[0]).toBe(200);
        expect([403, 409]).toContain(statuses[1]);
        const rows = await db.select().from(staffAccounts);
        expect(rows.filter((r) => r.role === 'owner' && !r.disabledAt)).toHaveLength(1);
        const loser = results.find((r) => r.status !== 200);
        if (loser.status === 409) expect(loser.body.message).toMatch(/last active owner/);
    });

    it('holds for disable too: two owners disabling each other leave one', async () => {
        const { token: tokenA, staff: a } = await tokenFor('owner', { email: 'a@example.com' });
        const { token: tokenB, staff: b } = await tokenFor('owner', { email: 'b@example.com' });

        const results = await Promise.all([
            post(`/api/admin/staff/${b.id}/disable`, tokenA, { reason: 'x' }),
            post(`/api/admin/staff/${a.id}/disable`, tokenB, { reason: 'x' }),
        ]);

        // The loser's token was ended by the winner, or it hit the last-owner rule: never both succeed.
        expect(results.map((r) => r.status).sort()).not.toEqual([200, 200]);
        const rows = await db.select().from(staffAccounts);
        expect(rows.filter((r) => r.role === 'owner' && !r.disabledAt).length).toBeGreaterThanOrEqual(1);
    });

    it('lets an owner be demoted when another active owner remains', async () => {
        const { token } = await tokenFor('owner', { email: 'a@example.com' });
        const { staff: b } = await tokenFor('owner', { email: 'b@example.com' });

        const res = await post(`/api/admin/staff/${b.id}/role`, token, { role: 'admin' });

        expect(res.status).toBe(200);
    });
});

describe('what the audit log never holds', () => {
    it('contains no password, no hash and no token after a full set of staff actions', async () => {
        const { token } = await tokenFor('owner');
        const created = await post('/api/admin/staff', token, newStaffBody({ password: 'secret-temp-password-1' }));
        const id = created.body.id;
        await post(`/api/admin/staff/${id}/role`, token, { role: 'admin' });
        await post(`/api/admin/staff/${id}/reset-password`, token, { password: 'secret-temp-password-2' });
        await post(`/api/admin/staff/${id}/disable`, token, { reason: 'x' });
        await post(`/api/admin/staff/${id}/enable`, token, {});

        const text = JSON.stringify(await db.select().from(auditLog));

        expect(text).not.toMatch(/secret-temp-password|\$2[aby]\$|eyJ/);
        expect((await auditActions())).toEqual(['staff.create', 'staff.role_change', 'staff.password_reset', 'staff.disable', 'staff.enable']);
    });
});

describe('tokens', () => {
    it('a token from before `tv` existed still works (counts as version 0)', async () => {
        const staff = await makeStaff('viewer');
        const legacy = jwt.sign({ id: staff.id }, process.env.ADMIN_JWT_SECRET, { audience: 'admin', expiresIn: '8h' });

        expect((await get('/api/admin/auth/me', legacy)).status).toBe(200);
    });

    it('login tokens carry the version', async () => {
        const staff = await makeStaff('viewer');
        await db.update(staffAccounts).set({ tokenVersion: 4 }).where(eq(staffAccounts.id, staff.id));

        const res = await login(staff.email);

        expect(jwt.decode(res.body.token).tv).toBe(4);
        expect((await get('/api/admin/auth/me', res.body.token)).status).toBe(200);
        expect((await get('/api/admin/auth/me', jwt.sign({ id: staff.id, tv: 3 }, process.env.ADMIN_JWT_SECRET, { audience: 'admin' }))).status).toBe(401);
    });
});

describe('the error body', () => {
    it('has no `code` for an ordinary error', async () => {
        const { token } = await tokenFor('owner');

        const res = await post('/api/admin/staff', token, newStaffBody({ role: 'root' }));

        expect(res.body).toEqual({ message: 'Invalid role' });
    });
});
