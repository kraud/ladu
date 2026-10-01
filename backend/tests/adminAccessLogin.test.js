// Access gates, PR 2: the owner's admin API for the login gate, the allowed accounts and the
// "sign everyone out" button. See .context/plans/access-gates.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, accessSettings, loginAllowedUsers, auditLog } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const STAFF_PASSWORD = 'correct-horse-battery';
const LEARNER_PASSWORD = 'learner-password-1';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const staffToken = async (role) => {
    const email = `${role}@example.com`;
    await createStaff({ email, name: `${role} person`, password: STAFF_PASSWORD, role });
    return (await request(app).post('/api/admin/auth/login').send({ email, password: STAFF_PASSWORD })).body.token;
};
const as = (token) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

let seq = 0;
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `User ${seq}`,
            email: `user${seq}@example.com`,
            username: `user${seq}`,
            password: await bcrypt.hash(LEARNER_PASSWORD, 4),
            languages: ['English', 'Spanish'],
            uiLanguage: 'English',
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};
const learnerLogin = (user) => request(app).post('/api/users/login').send({ email: user.email, password: LEARNER_PASSWORD });
const setSettings = (values) => db.update(accessSettings).set(values).where(eq(accessSettings.id, 1));
const settingsRow = async () => (await db.select().from(accessSettings))[0];
const audits = (action) => db.select().from(auditLog).where(eq(auditLog.action, action));
const allowedIds = async () => (await db.select().from(loginAllowedUsers)).map((r) => r.userId).sort();

describe('permission', () => {
    const calls = [
        ['put', '/api/admin/access/login'],
        ['post', '/api/admin/access/login-allowed'],
        ['post', '/api/admin/access/login-allowed/remove'],
        ['delete', `/api/admin/access/login-allowed/${UNKNOWN_ID}`],
        ['post', '/api/admin/access/sign-out-everyone'],
    ];

    it('is for the owner only, and changes nothing for a refused role', async () => {
        const user = await makeUser();
        for (const role of ['admin', 'support', 'viewer']) {
            const token = await staffToken(role);
            for (const [method, url] of calls) {
                const res = await as(token)(method, url).send({ mode: 'closed', userIds: [user.id], confirm: 'SIGN OUT EVERYONE', reason: 'x' });
                expect([role, url, res.status]).toEqual([role, url, 403]);
            }
        }
        expect((await settingsRow()).loginMode).toBe('open');
        expect(await allowedIds()).toEqual([]);
        expect((await db.select().from(users))[0].tokenVersion).toBe(0);
    });

    it('refuses no token and a learner token', async () => {
        for (const [method, url] of calls) expect((await request(app)[method](url)).status).toBe(401);
        const user = await makeUser();
        const { token } = (await learnerLogin(user)).body;
        for (const [method, url] of calls) {
            expect((await request(app)[method](url).set('Authorization', `Bearer ${token}`)).status).toBe(401);
        }
    });
});

describe('GET /api/admin/access: the allowed accounts', () => {
    it('lists name, email, status and who added each, with the count', async () => {
        const token = await staffToken('owner');
        const active = await makeUser({ name: 'Active One' });
        const banned = await makeUser({ name: 'Banned One', bannedAt: new Date() });
        await as(token)('post', '/api/admin/access/login-allowed').send({ userIds: [active.id, banned.id] });

        const res = await as(token)('get', '/api/admin/access');
        expect(res.status).toBe(200);
        expect(res.body.counts.loginAllowed).toBe(2);
        const byName = Object.fromEntries(res.body.loginAllowed.map((a) => [a.name, a]));
        expect(byName['Active One']).toMatchObject({ userId: active.id, email: active.email, status: 'active', addedBy: 'owner person' });
        expect(byName['Banned One'].status).toBe('banned');
        expect(byName['Active One'].addedAt).toBeTruthy();
        // Never a password hash or a token.
        expect(JSON.stringify(res.body)).not.toMatch(/password|token/i);
    });
});

describe('PUT /api/admin/access/login', () => {
    const put = (token, body) => as(token)('put', '/api/admin/access/login').send(body);

    it('changes the mode and the note, writes an audit row, and shows at once on the public endpoint', async () => {
        const token = await staffToken('owner');
        const res = await put(token, { mode: 'limited', note: '  Invite week  ', reason: 'incident' });
        expect(res.status).toBe(200);
        expect(res.body.login).toEqual({ mode: 'limited', note: 'Invite week' });

        const rows = await audits('access.login_mode');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ targetType: 'access', targetId: 'login', reason: 'incident' });
        expect(rows[0].metadata).toEqual({ from: 'open', to: 'limited', noteChanged: true });
        expect((await request(app).get('/api/access')).body.login).toEqual({ mode: 'limited', note: 'Invite week' });
    });

    it('keeps registration alone, and registration keeps login alone', async () => {
        const token = await staffToken('owner');
        await put(token, { mode: 'closed', note: 'Login note' });
        let row = await settingsRow();
        expect(row).toMatchObject({ loginMode: 'closed', loginNote: 'Login note', registrationMode: 'open', registrationNote: '' });

        await as(token)('put', '/api/admin/access/registration').send({ mode: 'limited', note: 'Reg note' });
        row = await settingsRow();
        expect(row).toMatchObject({ loginMode: 'closed', loginNote: 'Login note', registrationMode: 'limited', registrationNote: 'Reg note' });
        expect((await audits('access.registration_mode'))[0].metadata.from).toBe('open');
    });

    it('keeps the note when none is sent, and writes no audit row when nothing changes', async () => {
        const token = await staffToken('owner');
        await put(token, { mode: 'closed', note: 'Soon' });
        await put(token, { mode: 'limited' });
        expect((await settingsRow()).loginNote).toBe('Soon');
        expect((await put(token, { mode: 'limited' })).status).toBe(200);
        expect(await audits('access.login_mode')).toHaveLength(2);
    });

    it('refuses a bad mode, a long or non-text note, and a long reason, and changes nothing', async () => {
        const token = await staffToken('owner');
        expect((await put(token, { mode: 'maybe' })).status).toBe(400);
        expect((await put(token, {})).status).toBe(400);
        expect((await put(token, { mode: 'closed', note: 'x'.repeat(301) })).status).toBe(400);
        expect((await put(token, { mode: 'closed', note: 5 })).status).toBe(400);
        expect((await put(token, { mode: 'closed', reason: 'x'.repeat(501) })).status).toBe(400);
        expect((await settingsRow()).loginMode).toBe('open');
        expect(await audits('access.login_mode')).toHaveLength(0);
    });

    it('closes the door for a learner at once, and staff can still reopen it', async () => {
        const token = await staffToken('owner');
        const user = await makeUser();
        expect((await learnerLogin(user)).status).toBe(200);
        await put(token, { mode: 'closed' });
        expect((await learnerLogin(user)).body.code).toBe('login_closed');
        expect((await put(token, { mode: 'open' })).status).toBe(200);
        expect((await learnerLogin(user)).status).toBe(200);
    });
});

describe('POST /api/admin/access/login-allowed', () => {
    const post = (token, body) => as(token)('post', '/api/admin/access/login-allowed').send(body);

    it('adds by id and by email (any case), one audit row for each account, about that user', async () => {
        const token = await staffToken('owner');
        const a = await makeUser();
        const b = await makeUser({ email: 'Mixed.Case@Example.com' });
        const res = await post(token, { userIds: [a.id.toUpperCase()], emails: ['  mixed.case@example.COM '], reason: 'beta group' });
        expect(res.status).toBe(201);
        expect(res.body.added.map((u) => u.userId).sort()).toEqual([a.id, b.id].sort());
        expect(res.body.skipped).toEqual([]);
        expect(await allowedIds()).toEqual([a.id, b.id].sort());
        expect(res.body.counts.loginAllowed).toBe(2);

        const rows = await audits('access.login_allow');
        expect(rows).toHaveLength(2);
        expect(rows.every((r) => r.targetType === 'user' && r.reason === 'beta group' && r.staffId)).toBe(true);
        expect(rows.map((r) => r.targetId).sort()).toEqual([a.id, b.id].sort());
        expect(rows.find((r) => r.targetId === b.id).metadata).toEqual({ email: 'Mixed.Case@Example.com' });
    });

    it('reports each skipped entry with the reason, and adds the rest', async () => {
        const token = await staffToken('owner');
        const good = await makeUser();
        const dup = await makeUser();
        const gone = await makeUser({ deletedAt: new Date() });
        const listed = await makeUser();
        await db.insert(loginAllowedUsers).values({ userId: listed.id });

        const res = await post(token, {
            userIds: [good.id, 'not-an-id', UNKNOWN_ID, gone.id, listed.id, dup.id],
            emails: ['nobody@example.com', 'bad email', dup.email, ''],
        });
        expect(res.status).toBe(201);
        expect(res.body.added.map((u) => u.userId).sort()).toEqual([good.id, dup.id].sort());
        const bySkip = Object.fromEntries(res.body.skipped.map((s) => [s.value, s.reason]));
        expect(bySkip).toEqual({
            'not-an-id': 'invalid',
            [UNKNOWN_ID]: 'unknown',
            [gone.id]: 'deleted',
            [listed.email]: 'already_allowed',
            'nobody@example.com': 'unknown',
            'bad email': 'invalid',
            [dup.email.toLowerCase()]: 'duplicate_in_request',
        });
        expect(await allowedIds()).toEqual([good.id, dup.id, listed.id].sort());
    });

    it('answers 200 and writes no audit row when nothing was added', async () => {
        const token = await staffToken('owner');
        const res = await post(token, { userIds: [UNKNOWN_ID] });
        expect(res.status).toBe(200);
        expect(res.body.added).toEqual([]);
        expect(await audits('access.login_allow')).toHaveLength(0);
    });

    it('refuses an empty request, a body that is not a list of text, and too many, and changes nothing', async () => {
        const token = await staffToken('owner');
        expect((await post(token, {})).status).toBe(400);
        expect((await post(token, { userIds: [], emails: [] })).status).toBe(400);
        expect((await post(token, { userIds: 'x' })).status).toBe(400);
        expect((await post(token, { emails: [1] })).status).toBe(400);
        const many = Array.from({ length: 501 }, (_, i) => `u${i}@example.com`);
        expect((await post(token, { emails: many })).status).toBe(400);
        expect((await post(token, { userIds: many.slice(0, 300), emails: many.slice(0, 201) })).status).toBe(400);
        expect(await allowedIds()).toEqual([]);
    });

    it('lets the account sign in at once while login is limited (end to end)', async () => {
        const token = await staffToken('owner');
        const user = await makeUser();
        await as(token)('put', '/api/admin/access/login').send({ mode: 'limited' });
        expect((await learnerLogin(user)).body.code).toBe('login_not_allowed');
        await post(token, { emails: [user.email] });
        expect((await learnerLogin(user)).status).toBe(200);
    });

    it('lists an account once when two owners add it at the same time', async () => {
        const token = await staffToken('owner');
        const user = await makeUser();
        const results = await Promise.all([post(token, { userIds: [user.id] }), post(token, { userIds: [user.id] })]);
        expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
        expect(await allowedIds()).toEqual([user.id]);
        expect(await audits('access.login_allow')).toHaveLength(1);
    });
});

describe('removing accounts from the allowed list', () => {
    it('DELETE removes one account, writes an audit row, and closes the door for it', async () => {
        const token = await staffToken('owner');
        const user = await makeUser();
        await as(token)('put', '/api/admin/access/login').send({ mode: 'limited' });
        await as(token)('post', '/api/admin/access/login-allowed').send({ userIds: [user.id] });
        expect((await learnerLogin(user)).status).toBe(200);

        const res = await as(token)('delete', `/api/admin/access/login-allowed/${user.id}`).send({ reason: 'beta over' });
        expect(res.status).toBe(200);
        expect(res.body.counts.loginAllowed).toBe(0);
        expect((await learnerLogin(user)).body.code).toBe('login_not_allowed');

        const rows = await audits('access.login_disallow');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ targetType: 'user', targetId: user.id, reason: 'beta over' });
        expect(rows[0].metadata).toEqual({ email: user.email });
    });

    it('DELETE answers 404 for an account that is not on the list, and for text that is not an id', async () => {
        const token = await staffToken('owner');
        const user = await makeUser();
        expect((await as(token)('delete', `/api/admin/access/login-allowed/${user.id}`)).status).toBe(404);
        expect((await as(token)('delete', `/api/admin/access/login-allowed/${UNKNOWN_ID}`)).status).toBe(404);
        expect((await as(token)('delete', '/api/admin/access/login-allowed/nope')).status).toBe(404);
        expect(await audits('access.login_disallow')).toHaveLength(0);
    });

    it('removes many at once, skips what is not on the list, and writes one audit row for each', async () => {
        const token = await staffToken('owner');
        const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
        await as(token)('post', '/api/admin/access/login-allowed').send({ userIds: [a.id, b.id] });

        const res = await as(token)('post', '/api/admin/access/login-allowed/remove').send({ userIds: [a.id, b.id, c.id, 'nope'] });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ removed: 2, skipped: 2 });
        expect(await allowedIds()).toEqual([]);
        expect((await audits('access.login_disallow')).map((r) => r.targetId).sort()).toEqual([a.id, b.id].sort());
    });

    it('refuses an empty list and too many for the bulk remove', async () => {
        const token = await staffToken('owner');
        const post = (body) => as(token)('post', '/api/admin/access/login-allowed/remove').send(body);
        expect((await post({})).status).toBe(400);
        expect((await post({ userIds: [] })).status).toBe(400);
        expect((await post({ userIds: Array.from({ length: 501 }, () => UNKNOWN_ID) })).status).toBe(400);
    });
});

describe('POST /api/admin/access/sign-out-everyone', () => {
    const PHRASE = 'SIGN OUT EVERYONE';
    const press = (token, body) => as(token)('post', '/api/admin/access/sign-out-everyone').send(body);
    const tokenVersions = async () => (await db.select().from(users)).map((u) => u.tokenVersion);

    it('needs the typed phrase and a reason, and changes nothing without them', async () => {
        const token = await staffToken('owner');
        await makeUser();
        for (const body of [{}, { reason: 'x' }, { confirm: PHRASE }, { confirm: PHRASE, reason: '   ' }, { confirm: 'sign out everyone', reason: 'x' }, { confirm: 'SIGN OUT', reason: 'x' }]) {
            expect([JSON.stringify(body), (await press(token, body)).status]).toEqual([JSON.stringify(body), 400]);
        }
        expect(await tokenVersions()).toEqual([0]);
        expect(await audits('access.sign_out_everyone')).toHaveLength(0);
    });

    it('ends every learner session at the next request, and counts the accounts', async () => {
        const owner = await staffToken('owner');
        const people = [await makeUser(), await makeUser(), await makeUser({ bannedAt: new Date() }), await makeUser({ deletedAt: new Date() })];
        const sessions = [];
        for (const user of people.slice(0, 2)) sessions.push((await learnerLogin(user)).body.token);
        for (const t of sessions) expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${t}`)).status).toBe(200);

        const res = await press(owner, { confirm: PHRASE, reason: 'security incident' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ signedOut: 4 });
        expect(await tokenVersions()).toEqual([1, 1, 1, 1]);

        for (const t of sessions) expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);

        const rows = await audits('access.sign_out_everyone');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ targetType: 'access', targetId: 'sessions', reason: 'security incident' });
        expect(rows[0].metadata).toEqual({ count: 4 });
    });

    it('does not touch staff: the owner stays signed in', async () => {
        const owner = await staffToken('owner');
        await makeUser();
        await press(owner, { confirm: PHRASE, reason: 'x' });
        expect((await as(owner)('get', '/api/admin/access')).status).toBe(200);
    });

    it('lets people sign in again (open), and with limited login only the allowed accounts', async () => {
        const owner = await staffToken('owner');
        const allowed = await makeUser();
        const other = await makeUser();
        const oldTokens = [(await learnerLogin(allowed)).body.token, (await learnerLogin(other)).body.token];

        await as(owner)('put', '/api/admin/access/login').send({ mode: 'limited' });
        await as(owner)('post', '/api/admin/access/login-allowed').send({ userIds: [allowed.id] });
        await press(owner, { confirm: PHRASE, reason: 'x' });

        // The old sessions are over for both, and only the allowed account can start a new one.
        for (const t of oldTokens) expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);
        const fresh = await learnerLogin(allowed);
        expect(fresh.status).toBe(200);
        expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${fresh.body.token}`)).status).toBe(200);
        expect((await learnerLogin(other)).body.code).toBe('login_not_allowed');

        await as(owner)('put', '/api/admin/access/login').send({ mode: 'open' });
        expect((await learnerLogin(other)).status).toBe(200);
    });

    it('adds exactly 1 each time, so two presses end two generations of sessions', async () => {
        const owner = await staffToken('owner');
        await makeUser();
        await press(owner, { confirm: PHRASE, reason: 'one' });
        await press(owner, { confirm: PHRASE, reason: 'two' });
        expect(await tokenVersions()).toEqual([2]);
        expect(await audits('access.sign_out_everyone')).toHaveLength(2);
    });
});

describe('the users list and detail: who is allowed to sign in', () => {
    it('shows an owner a flag on each row and on the detail, and filters by it', async () => {
        const owner = await staffToken('owner');
        const yes = await makeUser({ name: 'Yes Person' });
        const no = await makeUser({ name: 'No Person' });
        await as(owner)('post', '/api/admin/access/login-allowed').send({ userIds: [yes.id] });

        const list = await as(owner)('get', '/api/admin/users');
        const byName = Object.fromEntries(list.body.items.map((u) => [u.name, u.loginAllowed]));
        expect(byName).toEqual({ 'Yes Person': true, 'No Person': false });

        const onlyYes = await as(owner)('get', '/api/admin/users?loginAllowed=true');
        expect(onlyYes.body.items.map((u) => u.id)).toEqual([yes.id]);
        expect(onlyYes.body.total).toBe(1);
        const onlyNo = await as(owner)('get', '/api/admin/users?loginAllowed=false');
        expect(onlyNo.body.items.map((u) => u.id)).toEqual([no.id]);

        expect((await as(owner)('get', `/api/admin/users/${yes.id}`)).body.loginAllowed).toBe(true);
        expect((await as(owner)('get', `/api/admin/users/${no.id}`)).body.loginAllowed).toBe(false);
    });

    it('hides the flag from the other roles (null), and refuses the filter instead of ignoring it', async () => {
        const user = await makeUser();
        await db.insert(loginAllowedUsers).values({ userId: user.id });
        for (const role of ['admin', 'support', 'viewer']) {
            const token = await staffToken(role);
            const list = await as(token)('get', '/api/admin/users');
            expect([role, list.body.items[0].loginAllowed]).toEqual([role, null]);
            expect((await as(token)('get', `/api/admin/users/${user.id}`)).body.loginAllowed).toBeNull();
            expect([role, (await as(token)('get', '/api/admin/users?loginAllowed=true')).status]).toEqual([role, 403]);
        }
    });

    it('refuses a bad filter value', async () => {
        const owner = await staffToken('owner');
        expect((await as(owner)('get', '/api/admin/users?loginAllowed=maybe')).status).toBe(400);
    });

    it('composes the filter with the others', async () => {
        const owner = await staffToken('owner');
        const a = await makeUser({ name: 'Anna', bannedAt: new Date() });
        const b = await makeUser({ name: 'Anton' });
        await as(owner)('post', '/api/admin/access/login-allowed').send({ userIds: [a.id, b.id] });
        const res = await as(owner)('get', '/api/admin/users?loginAllowed=true&status=banned');
        expect(res.body.items.map((u) => u.id)).toEqual([a.id]);
    });
});
