// Two sign-ups at the same moment can both pass the "already in use" check. The unique
// constraint then fails the second insert. It must answer the normal 400, not a 500.
// See .context/features/admin.md §6 and backend/lib/duplicateAccount.ts.
const { mockModule } = require('./mockModule');
mockModule('../utils/sendEmail', vi.fn().mockResolvedValue());
const sendMail = require('../utils/sendEmail');

const request = require('./request');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, tokens } = require('../src/db/schema');
const { issueTicket } = require('../lib/oauth/ticket');
const { asDuplicateAccountError } = require('../lib/duplicateAccount');
const { HttpError } = require('../lib/httpError');

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    sendMail.mockClear();
    // restoreAllMocks (below) also drops the resolved value of this mock.
    sendMail.mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const body = (overrides = {}) => ({
    name: 'New One',
    email: 'new@example.com',
    username: 'newone',
    password: 'a-good-password-1',
    languages: ['English', 'Spanish'],
    ...overrides,
});
const register = (b) => request(app).post('/api/users').send(b);
const googleSignup = (email, username) =>
    request(app)
        .post('/api/auth/signup/complete')
        .send({
            ticket: issueTicket({ typ: 'oauth_signup', provider: 'google', sub: 'google-sub-1', email, name: 'Gee Oogle' }),
            username,
            languages: ['English', 'Spanish'],
        });

const competitor = (overrides = {}) => ({
    name: 'Competitor',
    email: 'competitor@example.com',
    username: 'competitor',
    password: 'p',
    languages: ['English', 'Spanish'],
    verified: true,
    ...overrides,
});

// The competing account is saved after the "already in use" check and before the
// transaction of the sign-up, which is exactly the window of the race.
const racingAccount = (overrides) => {
    const original = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementationOnce(async (callback) => {
        await db.insert(users).values(competitor(overrides));
        return original(callback);
    });
};

const allUsers = () => db.select().from(users);

describe('POST /api/users: a competing sign-up wins between the check and the insert', () => {
    it('answers 400 "Email already in use" when the email was taken in that moment', async () => {
        racingAccount({ email: 'new@example.com' });

        const res = await register(body());

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Email already in use' });
        expect(await allUsers()).toHaveLength(1);
        expect(await db.select().from(tokens)).toHaveLength(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('answers 400 "Username already in use" when the username was taken in that moment', async () => {
        racingAccount({ username: 'newone' });

        const res = await register(body());

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Username already in use' });
        expect(await allUsers()).toHaveLength(1);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('shows no SQL, no parameters and no password hash in the answer', async () => {
        racingAccount({ email: 'new@example.com' });

        const res = await register(body());

        expect(res.text).not.toMatch(/insert into|params|\$2[aby]\$|a-good-password-1/i);
    });

    it('lets exactly one of two parallel sign-ups with the exact same email win, and answers the other 400', async () => {
        const results = await Promise.all([register(body()), register(body({ username: 'newone2' }))]);

        expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
        expect(results.find((r) => r.status === 400).body.message).toBe('Email already in use');
        expect(await allUsers()).toHaveLength(1);
    });
});

describe('POST /api/auth/signup/complete (Google): the same race', () => {
    it('answers 400 "Email already in use" when the email was taken in that moment', async () => {
        racingAccount({ email: 'g@example.com' });

        const res = await googleSignup('g@example.com', 'googler');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Email already in use' });
        expect(await allUsers()).toHaveLength(1);
    });

    it('answers 400 "Username already in use" when the username was taken in that moment', async () => {
        racingAccount({ username: 'googler' });

        const res = await googleSignup('g@example.com', 'googler');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Username already in use' });
        expect(await allUsers()).toHaveLength(1);
    });
});

describe('asDuplicateAccountError', () => {
    const pgError = (constraint, code = '23505') => ({ cause: { code, constraint } });

    it('maps the two unique constraints of users to a 400', () => {
        const email = asDuplicateAccountError(pgError('users_email_unique'));
        const username = asDuplicateAccountError(pgError('users_username_unique'));

        expect(email).toBeInstanceOf(HttpError);
        expect(email).toMatchObject({ status: 400, message: 'Email already in use' });
        expect(username).toMatchObject({ status: 400, message: 'Username already in use' });
    });

    it('returns every other error unchanged', () => {
        const other = pgError('some_other_unique');
        const notUnique = pgError('users_email_unique', '23503');
        const plain = new Error('boom');

        expect(asDuplicateAccountError(other)).toBe(other);
        expect(asDuplicateAccountError(notUnique)).toBe(notUnique);
        expect(asDuplicateAccountError(plain)).toBe(plain);
        expect(asDuplicateAccountError(undefined)).toBeUndefined();
    });
});
