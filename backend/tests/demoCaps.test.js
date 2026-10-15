// Demo access, Slice 2 step 1: the word and tag caps on every create and clone path (D3, D11),
// Private-only tags and no follow (D10 b, d), and no social action from a demo (Review log S2-1).
// See .context/plans/demo-access.md.
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { users, words, tags, tagWords, friendships, tagShares } = require('../src/db/schema');
const { resetDemoStartLimiter } = require('../lib/demo');
const { generateToken } = require('../controllers/userController');

jest.setTimeout(20000);

beforeAll(() => testDb.connectDB());
beforeEach(async () => {
    await testDb.clearDB();
    resetDemoStartLimiter();
    process.env.DEMO_STARTS_PER_IP = '100';
});
afterAll(async () => {
    delete process.env.DEMO_STARTS_PER_IP;
    await testDb.closeDB();
    await pool.end();
});

const setDemo = ({ maxWords = 30, maxTags = 5 } = {}) =>
    pool.query(`UPDATE access_settings SET demo_enabled = true, demo_max_words = $1, demo_max_tags = $2 WHERE id = 1`, [maxWords, maxTags]);

/** Starts a demo with these caps on top of the seed. */
const startDemo = async (caps) => {
    await setDemo(caps);
    const res = await request(app).post('/api/demo').send({});
    expect(res.status).toBe(201);
    return res.body;
};

let seq = 0;
const realUser = async () => {
    seq += 1;
    const [user] = await db
        .insert(users)
        .values({ name: `Real ${seq}`, email: `real${seq}@example.com`, username: `real${seq}`, languages: ['English', 'Spanish'], verified: true })
        .returning();
    return { ...user, token: generateToken(user) };
};

const as = (who) => (method, url) => request(app)[method](url).set('Authorization', `Bearer ${who.token}`);
const nounBody = (en, es) => ({
    partOfSpeech: 'Noun',
    translations: [
        { language: 'English', cases: [{ caseName: 'singularEN', word: en }] },
        { language: 'Spanish', cases: [{ caseName: 'singularES', word: es }] },
    ],
    tags: [],
});
const countWords = async (userId) => (await db.select().from(words).where(eq(words.userId, userId))).length;
const countTags = async (userId) => (await db.select().from(tags).where(eq(tags.authorId, userId))).length;
const expectCode = (res, status, code) => {
    expect({ status: res.status, code: res.body.code }).toEqual({ status, code });
};

/** A real user's Public tag with `n` words. */
const publicTagWithWords = async (owner, n) => {
    const wordIds = [];
    for (let i = 0; i < n; i += 1) wordIds.push((await as(owner)('post', '/api/words').send(nounBody(`w${seq}-${i}`, `p${seq}-${i}`))).body.id);
    const tag = await as(owner)('post', '/api/tags').send({ label: `Shared ${seq}`, visibility: 'Public', wordIds });
    expect(tag.status).toBe(200);
    return tag.body;
};

describe('word cap', () => {
    it('POST /api/words: one more word fits, the next is refused with demo_word_limit', async () => {
        const demo = await startDemo({ maxWords: 1 });
        const before = await countWords(demo.id);
        expect((await as(demo)('post', '/api/words').send(nounBody('window', 'ventana'))).status).toBe(200);
        expectCode(await as(demo)('post', '/api/words').send(nounBody('door', 'puerta')), 403, 'demo_word_limit');
        expect(await countWords(demo.id)).toBe(before + 1);
    });

    it('a cap of 0: the seed stays, nothing can be added', async () => {
        const demo = await startDemo({ maxWords: 0 });
        expectCode(await as(demo)('post', '/api/words').send(nounBody('window', 'ventana')), 403, 'demo_word_limit');
    });

    it('never passes the cap with parallel creates', async () => {
        const demo = await startDemo({ maxWords: 3 });
        const before = await countWords(demo.id);
        const answers = await Promise.all(Array.from({ length: 8 }, (_, i) => as(demo)('post', '/api/words').send(nounBody(`w${i}`, `p${i}`))));
        expect(answers.filter((r) => r.status === 200)).toHaveLength(3);
        expect(answers.filter((r) => r.body.code === 'demo_word_limit')).toHaveLength(5);
        expect(await countWords(demo.id)).toBe(before + 3);
    });

    it('POST /api/words/:id/clone counts a copy, and is refused at the cap', async () => {
        const owner = await realUser();
        const tag = await publicTagWithWords(owner, 2);
        const [first, second] = (await db.select().from(tagWords).where(eq(tagWords.tagId, tag.id))).map((r) => r.wordId);
        const demo = await startDemo({ maxWords: 1 });

        expect((await as(demo)('post', `/api/words/${first}/clone`)).status).toBe(201);
        expectCode(await as(demo)('post', `/api/words/${second}/clone`), 403, 'demo_word_limit');
    });

    it('does not limit a normal account', async () => {
        const user = await realUser();
        for (let i = 0; i < 3; i += 1) expect((await as(user)('post', '/api/words').send(nounBody(`w${i}`, `p${i}`))).status).toBe(200);
    });
});

describe('tag cap and Private only', () => {
    it('POST /api/tags: one more Private tag fits, the next is refused with demo_tag_limit', async () => {
        const demo = await startDemo({ maxTags: 1 });
        const before = await countTags(demo.id);
        expect((await as(demo)('post', '/api/tags').send({ label: 'Mine', visibility: 'Private' })).status).toBe(200);
        expectCode(await as(demo)('post', '/api/tags').send({ label: 'More', visibility: 'Private' }), 403, 'demo_tag_limit');
        expect(await countTags(demo.id)).toBe(before + 1);
    });

    it('refuses any visibility but Private on create and on update', async () => {
        const demo = await startDemo();
        for (const visibility of ['Public', 'Friends-Only']) {
            expectCode(await as(demo)('post', '/api/tags').send({ label: `T ${visibility}`, visibility }), 403, 'demo_restricted');
        }
        const tag = (await as(demo)('post', '/api/tags').send({ label: 'Mine', visibility: 'Private' })).body;
        expectCode(await as(demo)('patch', `/api/tags/${tag.id}`).send({ visibility: 'Public' }), 403, 'demo_restricted');
        const renamed = await as(demo)('patch', `/api/tags/${tag.id}`).send({ label: 'Renamed', visibility: 'Private' });
        expect(renamed.status).toBe(200);
        const [row] = await db.select().from(tags).where(eq(tags.id, tag.id));
        expect(row).toMatchObject({ label: 'Renamed', visibility: 'Private' });
    });

    it('still lets a normal account make a Public tag', async () => {
        const user = await realUser();
        expect((await as(user)('post', '/api/tags').send({ label: 'Open', visibility: 'Public' })).status).toBe(200);
    });
});

describe('tag clone', () => {
    it('clones a Public tag as Private when it fits both caps', async () => {
        const owner = await realUser();
        const source = await publicTagWithWords(owner, 2);
        const demo = await startDemo({ maxWords: 2, maxTags: 1 });
        const res = await as(demo)('post', `/api/tags/${source.id}/clone`).send({ visibility: 'Private' });
        expect(res.status).toBe(200);
        expect(res.body.visibility).toBe('Private');
    });

    it('refuses a Public copy', async () => {
        const owner = await realUser();
        const source = await publicTagWithWords(owner, 1);
        const demo = await startDemo();
        expectCode(await as(demo)('post', `/api/tags/${source.id}/clone`).send({ visibility: 'Public' }), 403, 'demo_restricted');
    });

    it('refuses the whole clone when its words would pass the word cap: no tag and no word is added', async () => {
        const owner = await realUser();
        const source = await publicTagWithWords(owner, 3);
        const demo = await startDemo({ maxWords: 2 });
        const [wordsBefore, tagsBefore] = [await countWords(demo.id), await countTags(demo.id)];

        expectCode(await as(demo)('post', `/api/tags/${source.id}/clone`).send({ visibility: 'Private' }), 403, 'demo_word_limit');
        expect(await countWords(demo.id)).toBe(wordsBefore);
        expect(await countTags(demo.id)).toBe(tagsBefore);
    });

    it('refuses a clone that would pass the tag cap, but a words-only clone needs word room only', async () => {
        const owner = await realUser();
        const source = await publicTagWithWords(owner, 1);
        const demo = await startDemo({ maxWords: 5, maxTags: 0 });

        expectCode(await as(demo)('post', `/api/tags/${source.id}/clone`).send({ visibility: 'Private' }), 403, 'demo_tag_limit');
        const wordsOnly = await as(demo)('post', `/api/tags/${source.id}/clone`).send({ keepTag: false });
        expect(wordsOnly.status).toBe(200);
        expect(wordsOnly.body).toMatchObject({ tag: null, clonedWordCount: 1 });
    });
});

describe('no follow, no social action (D10 d, Review log S2-1)', () => {
    it('refuses to follow a tag', async () => {
        const owner = await realUser();
        const source = await publicTagWithWords(owner, 1);
        const demo = await startDemo();
        expectCode(await as(demo)('post', `/api/tags/${source.id}/follow`), 403, 'demo_restricted');
        // A normal account still can.
        const other = await realUser();
        expect((await as(other)('post', `/api/tags/${source.id}/follow`)).status).toBe(200);
    });

    it('refuses to send, accept or decline a friend request, and writes nothing', async () => {
        const real = await realUser();
        const demo = await startDemo();
        expectCode(await as(demo)('post', '/api/friendships').send({ addresseeId: real.id }), 403, 'demo_restricted');
        // A request planted towards the demo cannot be answered by it either.
        const [planted] = await db.insert(friendships).values({ requesterId: real.id, addresseeId: demo.id, status: 'pending' }).returning();
        expectCode(await as(demo)('post', `/api/friendships/${planted.id}/accept`), 403, 'demo_restricted');
        expectCode(await as(demo)('post', `/api/friendships/${planted.id}/decline`), 403, 'demo_restricted');
        const rows = await db.select().from(friendships);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('pending');
    });

    it('refuses to share a tag, or to accept or decline a share', async () => {
        const real = await realUser();
        const demo = await startDemo();
        const [demoTag] = await db.select().from(tags).where(eq(tags.authorId, demo.id)).limit(1);
        expectCode(await as(demo)('post', `/api/tags/${demoTag.id}/share`).send({ recipientId: real.id }), 403, 'demo_restricted');
        expect(await db.select().from(tagShares)).toHaveLength(0);

        const realTag = (await as(real)('post', '/api/tags').send({ label: 'Real', visibility: 'Private' })).body;
        const [share] = await db.insert(tagShares).values({ tagId: realTag.id, senderId: real.id, recipientId: demo.id, status: 'pending' }).returning();
        expectCode(await as(demo)('post', `/api/tag-shares/${share.id}/accept`), 403, 'demo_restricted');
        expectCode(await as(demo)('post', `/api/tag-shares/${share.id}/decline`), 403, 'demo_restricted');
    });
});
