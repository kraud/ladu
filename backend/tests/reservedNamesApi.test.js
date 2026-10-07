// Reserved names, slice 7 — registration, Google signup and profile update.
// See .context/plans/verified-badges.md. The word list itself is tested in
// reservedNames.test.js; here we test the three flows around it.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, userBadges, accessSettings } = require('../src/db/schema');
const { createStaff } = require('../lib/staffAccounts');
const { issueTicket } = require('../lib/oauth/ticket');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const LANGUAGES = ['English', 'Spanish'];
const allUsers = () => db.select().from(users);
const getUser = async (id) => (await db.select().from(users).where(eq(users.id, id)))[0];

let seq = 0;
/** An account made straight in the DB, so it can have a name the API would now refuse (a legacy account). */
const makeUser = async (overrides = {}) => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({
            name: `Person ${seq}`,
            email: `reserved${seq}@example.com`,
            username: `person${seq}`,
            languages: LANGUAGES,
            verified: true,
            ...overrides,
        })
        .returning();
    return user;
};

const grantBadge = async (user, type = 'official', { revoked = false } = {}) => {
    const staff = await createStaff({ email: `staff${++seq}@example.com`, name: 'Staff', password: 'correct-horse-battery', role: 'owner' });
    await db.insert(userBadges).values({ userId: user.id, type, grantedBy: staff.id, revokedAt: revoked ? new Date() : null });
};

describe('POST /api/users — registration', () => {
    const register = (overrides = {}) =>
        request(app).post('/api/users').send({
            name: 'Kevin Raud',
            email: 'kevin@example.com',
            username: 'kevinraud',
            password: 'pass123',
            languages: LANGUAGES,
            ...overrides,
        });

    it('refuses a reserved username with a code, and creates no account', async () => {
        const res = await register({ username: 'Ladu_0fficial' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ message: 'This username is not available', code: 'username_reserved' });
        expect(await allUsers()).toHaveLength(0);
    });

    it('refuses a reserved display name with its own code', async () => {
        const res = await register({ name: 'Official Ladu Team' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ message: 'This name is not available', code: 'name_reserved' });
        expect(await allUsers()).toHaveLength(0);
    });

    it('names the username first when both are reserved', async () => {
        const res = await register({ username: 'admin', name: 'Ladu' });

        expect(res.body.code).toBe('username_reserved');
    });

    it.each(['Ladu', 'L a d u', 'LADÚ', 'Lаdu', 'ＬＡＤＵ', 'Off1cial', 'Admin', 'Moderator'])(
        'refuses the look-alike username %j',
        async (username) => {
            const res = await register({ username });
            expect([username, res.statusCode, res.body.code]).toEqual([username, 400, 'username_reserved']);
        },
    );

    it('does not leak the word list in the answer', async () => {
        const res = await register({ username: 'ladu' });

        expect(JSON.stringify(res.body).toLowerCase()).not.toMatch(/ladu|official|admin|staff|support|moderator|team/);
    });

    it('allows ordinary names, including words that only contain a reserved word', async () => {
        const res = await register({ username: 'badminton', name: 'Teammate Kevin' });

        expect(res.statusCode).toBe(201);
        expect((await allUsers()).map((user) => user.username)).toEqual(['badminton']);
    });

    it('a closed registration gate answers before the name check', async () => {
        await db.update(accessSettings).set({ registrationMode: 'closed' }).where(eq(accessSettings.id, 1));

        const res = await register({ username: 'ladu' });

        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('registration_closed');
    });
});

describe('POST /api/auth/signup/complete — Google signup', () => {
    const ticket = (overrides = {}) =>
        issueTicket({ typ: 'oauth_signup', provider: 'google', sub: 'sub-1', email: 'gee@example.com', name: 'Gee Oogle', ...overrides });
    const complete = (body = {}) =>
        request(app).post('/api/auth/signup/complete').send({ ticket: ticket(), username: 'geeoogle', languages: LANGUAGES, ...body });

    it('refuses a reserved username, and creates no account', async () => {
        const res = await complete({ username: 'Official' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ message: 'This username is not available', code: 'username_reserved' });
        expect(await allUsers()).toHaveLength(0);
    });

    it('refuses a reserved name from the Google profile, and creates no account', async () => {
        const res = await complete({ ticket: ticket({ name: 'Ladu Support' }) });

        expect(res.statusCode).toBe(400);
        // Its own code and message: the person cannot change this name in our form.
        expect(res.body).toEqual({ message: 'The name of this Google account is not available', code: 'google_name_reserved' });
        expect(await allUsers()).toHaveLength(0);
    });

    it('names the username first when the username and the Google name are both reserved', async () => {
        const res = await complete({ username: 'Official', ticket: ticket({ name: 'Ladu Support' }) });

        expect(res.body.code).toBe('username_reserved');
    });

    it('creates the account for an ordinary username and name', async () => {
        const res = await complete();

        expect(res.statusCode).toBe(201);
        expect((await allUsers()).map((user) => user.username)).toEqual(['geeoogle']);
    });
});

describe('PUT /api/users/updateUser — profile update', () => {
    const update = (user, body = {}) =>
        request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${global.signin(user.id)}`)
            .send({ email: user.email, ...body });

    describe('reserved names', () => {
        it('refuses a new reserved username, and keeps the stored one', async () => {
            const user = await makeUser({ username: 'kevin' });

            const res = await update(user, { username: 'Ladu_Team' });

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'This username is not available', code: 'username_reserved' });
            expect((await getUser(user.id)).username).toBe('kevin');
        });

        it('refuses a new reserved display name, and keeps the stored one', async () => {
            const user = await makeUser({ name: 'Kevin' });

            const res = await update(user, { name: 'Official' });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('name_reserved');
            expect((await getUser(user.id)).name).toBe('Kevin');
        });

        it('allows an ordinary change', async () => {
            const user = await makeUser();

            const res = await update(user, { name: 'Kevin Raud', username: 'kevinraud' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({ name: 'Kevin Raud', username: 'kevinraud' });
        });

        it('lets an account with an active official badge take a reserved name', async () => {
            const user = await makeUser();
            await grantBadge(user);

            const res = await update(user, { username: 'Ladu', name: 'Ladu Official' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({ username: 'Ladu', name: 'Ladu Official' });
        });

        it.each([
            ['a revoked official badge', { type: 'official', revoked: true }],
            ['a badge of another type', { type: 'teacher', revoked: false }],
        ])('does not exempt %s', async (_label, { type, revoked }) => {
            const user = await makeUser({ username: 'kevin' });
            await grantBadge(user, type, { revoked });

            const res = await update(user, { username: 'Ladu' });

            expect(res.statusCode).toBe(400);
            expect((await getUser(user.id)).username).toBe('kevin');
        });

        it('lets a legacy account keep a name it already has (only a change is checked)', async () => {
            const user = await makeUser({ username: 'LaduFan', name: 'Ladu Official' });

            const res = await update(user, { username: 'LaduFan', name: 'Ladu Official', languages: ['English', 'Spanish', 'German'] });

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({ username: 'LaduFan', name: 'Ladu Official' });
            expect((await getUser(user.id)).languages).toEqual(['English', 'Spanish', 'German']);
        });

        it('does not re-check an unchanged username when only the other field changes', async () => {
            const user = await makeUser({ username: 'LaduFan', name: 'Ladu Official' });

            const res = await update(user, { username: 'LaduFan', name: 'Kevin' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({ username: 'LaduFan', name: 'Kevin' });
        });

        it('still refuses a legacy account that changes to another reserved name', async () => {
            const user = await makeUser({ username: 'LaduFan' });

            const res = await update(user, { username: 'Admin' });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('username_reserved');
        });
    });

    describe('username uniqueness and trimming', () => {
        it('refuses a username that another account has in a different case', async () => {
            await makeUser({ username: 'kevin' });
            const user = await makeUser({ username: 'someone' });

            const res = await update(user, { username: 'Kevin' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Username already in use!');
            expect((await getUser(user.id)).username).toBe('someone');
        });

        it('lets an account change the case of its own username', async () => {
            const user = await makeUser({ username: 'bobby' });

            const res = await update(user, { username: 'Bobby' });

            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('Bobby');
        });

        it('saves the username trimmed', async () => {
            const user = await makeUser();

            const res = await update(user, { username: '  newname  ' });

            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('newname');
            expect((await getUser(user.id)).username).toBe('newname');
        });

        it('checks uniqueness on the trimmed value', async () => {
            await makeUser({ username: 'taken' });
            const user = await makeUser();

            const res = await update(user, { username: '  TAKEN ' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Username already in use!');
        });

        it.each(['', '   ', 5, null])('refuses an empty or non-text username: %j', async (username) => {
            const user = await makeUser({ username: 'keepme' });

            const res = await update(user, { username });

            expect(res.statusCode).toBe(400);
            expect((await getUser(user.id)).username).toBe('keepme');
        });

        it('keeps the stored username when the field is absent', async () => {
            const user = await makeUser({ username: 'keepme' });

            const res = await update(user, { name: 'Kevin' });

            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('keepme');
        });
    });

    it('still refuses an email that is not the caller\'s, before it checks any name', async () => {
        const user = await makeUser();
        const other = await makeUser();

        const res = await request(app)
            .put('/api/users/updateUser')
            .set('Authorization', `Bearer ${global.signin(user.id)}`)
            .send({ email: other.email, username: 'Ladu' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid credentials');
    });
});
