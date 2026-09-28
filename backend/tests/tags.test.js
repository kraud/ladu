/**
 * Tags API — Integration Tests
 *
 * Phase 4 Slice 2 rewrite (phase-4-tags.md): the tag list/get/create/patch/
 * delete/follow/unfollow/link endpoints were rebuilt wholesale —
 *   - `GET /api/tags?scope=&q=&sort=&cursor=&limit=` replaces
 *     getTags/searchTags/getOtherUserTags/getFollowedTagsIdByUserId/
 *     filterTags; returns `TagSummary` rows (counts via SQL, never by
 *     loading each tag's word list) plus `{ items, nextCursor, total }`.
 *   - `PATCH /api/tags/:id` replaces the old `PUT` — metadata only; word
 *     membership moved to `POST /api/tags/links` / `/links/remove`.
 *   - `POST /api/tags/:id/follow` / `DELETE /api/tags/:id/follow` replace
 *     the old body-carrying follow/unfollow routes.
 *   - Tag labels are unique per author, case-insensitively (409 on clash).
 *   - New endpoints use 404 for "doesn't exist" and 403 for "not allowed",
 *     not the legacy mix of 400/401.
 *
 * Slice 3 rebuild: `POST /api/tags/addExternalTag` is retired in favor of
 * `POST /api/tags/:id/clone` (`{visibility}`, caller-chosen rather than
 * copying the source's) — batch inserts, `sourceTagId`/`sourceWordId`
 * provenance, a numeric label suffix on collision, and removing an existing
 * follow of the cloned tag. `acceptTagShare` now passes its own `tx` into
 * the shared `cloneTagForUser` instead of that function opening a second,
 * nested transaction; its own response shape is otherwise unchanged (no
 * visibility choice in that flow, still `normalizeTag`).
 */

// Must run before `require('../app')` below — see auth.test.js's comment on
// this same pattern for why (this file isn't Babel/ts-jest transformed, so
// jest.mock hoisting never applies to it).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('supertest');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const {
    tagShares,
    tags,
    tagWords,
    translationCases,
    translations,
    userFollowingTags,
    words,
} = require('../src/db/schema');

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

const registerAndLogin = async (name = 'Tag User', email = 'tag@test.com', username = 'taguser') => {
    await request(app).post('/api/users').send({
        name, email, username, password: 'pass123', languages: ['English', 'Spanish'],
    });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

const createWord = async (token, partOfSpeech, caseName, wordValue) => {
    const res = await request(app)
        .post('/api/words')
        .set('Authorization', `Bearer ${token}`)
        .send({
            partOfSpeech,
            translations: [
                { language: 'English', cases: [{ word: wordValue, caseName }] },
                { language: 'Estonian', cases: [{ word: wordValue + 'EE', caseName: 'infinitiveMaEE' }] },
            ],
        });
    return res.body;
};

const createTag = (token, overrides = {}) =>
    request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Tag', visibility: 'Private', ...overrides });

// ===========================================================================
// POST /api/tags - Create Tag
// ===========================================================================
describe('POST /api/tags - Create Tag', () => {
    let token, userId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
    });

    it('creates a tag without words (authorId set server-side)', async () => {
        const res = await createTag(token, { label: 'Vocabulary', visibility: 'Private' });

        expect(res.statusCode).toBe(200);
        expect(res.body.wordCount).toBe(0);
        expect(res.body.author).toEqual({ id: userId, username: 'taguser' });
        expect(res.body.isOwner).toBe(true);
    });

    it('creates a tag with word associations', async () => {
        const [word] = await db.insert(words).values({ userId, partOfSpeech: 'Noun' }).returning();

        const res = await createTag(token, { label: 'Nouns', wordIds: [word.id] });

        expect(res.statusCode).toBe(200);
        expect(res.body.wordCount).toBe(1);

        const tagWordsRows = await db.select().from(tagWords).where(eq(tagWords.tagId, res.body.id));
        expect(tagWordsRows).toHaveLength(1);
    });

    it('fails with 403 and creates nothing when a wordId belongs to another user', async () => {
        const other = await registerAndLogin('Other', 'other@test.com', 'other');
        const otherWord = await createWord(other.token, 'Noun', 'singularEN', 'apple');

        const res = await createTag(token, { label: 'Not mine', wordIds: [otherWord.id] });

        expect(res.statusCode).toBe(403);
        const allTags = await db.select().from(tags);
        expect(allTags).toHaveLength(0);
    });

    it('fails with 400 when label is missing', async () => {
        const res = await createTag(token, { label: undefined });
        expect(res.statusCode).toBe(400);
    });

    it('fails with 400 when visibility status is invalid', async () => {
        const res = await createTag(token, { label: 'Bad', visibility: 'Invalid' });
        expect(res.statusCode).toBe(400);
    });

    // D13 (phase-4-tags.md): labels are unique per author, case-insensitively.
    it('fails with 409 when the label is already used by the same author', async () => {
        await createTag(token, { label: 'Kitchen' });
        const res = await createTag(token, { label: 'kitchen' }); // case-insensitive clash
        expect(res.statusCode).toBe(409);
    });

    it('allows two different authors to use the same label', async () => {
        await createTag(token, { label: 'Kitchen' });
        const other = await registerAndLogin('Other2', 'other2@test.com', 'other2');
        const res = await createTag(other.token, { label: 'Kitchen' });
        expect(res.statusCode).toBe(200);
    });
});

// ===========================================================================
// GET /api/tags - List Tags
// ===========================================================================
describe('GET /api/tags - List Tags', () => {
    let owner, follower, stranger;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        follower = await registerAndLogin('Follower', 'follower@test.com', 'follower');
        stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger');
    });

    it('scope=owned returns only the caller\'s own tags', async () => {
        await createTag(owner.token, { label: 'Mine', visibility: 'Private' });
        await createTag(stranger.token, { label: 'NotMine', visibility: 'Public' });

        const res = await request(app).get('/api/tags?scope=owned').set('Authorization', `Bearer ${owner.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].label).toBe('Mine');
        expect(res.body.items[0].isOwner).toBe(true);
        expect(res.body.total).toBe(1);
    });

    it('scope=followed returns a followed tag, including one turned Private (D9, "unavailable")', async () => {
        const publicTag = await createTag(owner.token, { label: 'Public one', visibility: 'Public' });
        const privateTag = await createTag(owner.token, { label: 'Turned private', visibility: 'Public' });
        await request(app).post(`/api/tags/${publicTag.body.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
        await request(app).post(`/api/tags/${privateTag.body.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
        await db.update(tags).set({ visibility: 'Private' }).where(eq(tags.id, privateTag.body.id));

        const res = await request(app).get('/api/tags?scope=followed').set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        const byLabel = Object.fromEntries(res.body.items.map((t) => [t.label, t]));
        expect(byLabel['Public one'].isAvailable).toBe(true);
        expect(byLabel['Turned private'].isAvailable).toBe(false);
        expect(byLabel['Turned private'].isFollowing).toBe(true);
    });

    it('scope=discover returns other users\' Public tags, excluding own and already-followed', async () => {
        const discoverable = await createTag(stranger.token, { label: 'Discoverable', visibility: 'Public' });
        await createTag(stranger.token, { label: 'PrivateStranger', visibility: 'Private' });
        const alreadyFollowed = await createTag(stranger.token, { label: 'AlreadyFollowed', visibility: 'Public' });
        await request(app).post(`/api/tags/${alreadyFollowed.body.id}/follow`).set('Authorization', `Bearer ${owner.token}`);
        await createTag(owner.token, { label: 'MyOwnPublic', visibility: 'Public' });

        const res = await request(app).get('/api/tags?scope=discover').set('Authorization', `Bearer ${owner.token}`);
        const labels = res.body.items.map((t) => t.label);
        expect(labels).toContain('Discoverable');
        expect(labels).not.toContain('PrivateStranger');
        expect(labels).not.toContain('AlreadyFollowed');
        expect(labels).not.toContain('MyOwnPublic');
        expect(res.body.items.find((t) => t.label === 'Discoverable').id).toBe(discoverable.body.id);
    });

    it('scope=all is the union of owned and followed', async () => {
        await createTag(owner.token, { label: 'MyOwn', visibility: 'Private' });
        const followed = await createTag(stranger.token, { label: 'Followed', visibility: 'Public' });
        await request(app).post(`/api/tags/${followed.body.id}/follow`).set('Authorization', `Bearer ${owner.token}`);

        const res = await request(app).get('/api/tags?scope=all').set('Authorization', `Bearer ${owner.token}`);
        const labels = res.body.items.map((t) => t.label);
        expect(labels).toEqual(expect.arrayContaining(['MyOwn', 'Followed']));
        expect(labels).toHaveLength(2);
    });

    it('defaults to scope=all when scope is omitted', async () => {
        await createTag(owner.token, { label: 'Default scope' });
        const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${owner.token}`);
        expect(res.body.items.map((t) => t.label)).toContain('Default scope');
    });

    it('q searches label and description', async () => {
        await createTag(owner.token, { label: 'Kitchen items', description: null });
        await createTag(owner.token, { label: 'Other', description: 'a kitchen-adjacent topic' });
        await createTag(owner.token, { label: 'Unrelated', description: null });

        const res = await request(app).get('/api/tags?scope=owned&q=kitchen').set('Authorization', `Bearer ${owner.token}`);
        const labels = res.body.items.map((t) => t.label);
        expect(labels).toEqual(expect.arrayContaining(['Kitchen items', 'Other']));
        expect(labels).not.toContain('Unrelated');
    });

    it('sort=label orders alphabetically instead of by recency', async () => {
        await createTag(owner.token, { label: 'Zebra' });
        await createTag(owner.token, { label: 'Apple' });

        const res = await request(app)
            .get('/api/tags?scope=owned&sort=label')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(res.body.items.map((t) => t.label)).toEqual(['Apple', 'Zebra']);
    });

    it('paginates with a keyset cursor', async () => {
        for (const label of ['a', 'b', 'c']) {
            await createTag(owner.token, { label });
        }

        const page1 = await request(app).get('/api/tags?scope=owned&limit=2').set('Authorization', `Bearer ${owner.token}`);
        expect(page1.body.items).toHaveLength(2);
        expect(page1.body.nextCursor).not.toBeNull();
        expect(page1.body.total).toBe(3);

        const page2 = await request(app)
            .get(`/api/tags?scope=owned&limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(page2.body.items).toHaveLength(1);
        expect(page2.body.nextCursor).toBeNull();

        const allIds = [...page1.body.items, ...page2.body.items].map((t) => t.id);
        expect(new Set(allIds).size).toBe(3);
    });

    it('rejects a malformed cursor with 400', async () => {
        const res = await request(app)
            .get('/api/tags?scope=owned&cursor=not-valid-base64!!')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(res.statusCode).toBe(400);
    });
});

// ===========================================================================
// GET /api/tags/:id - Get Tag By ID
// ===========================================================================
describe('GET /api/tags/:id - Get Tag By ID', () => {
    it('returns 404 for a Private tag the caller neither owns nor follows (hides existence)', async () => {
        const owner = await registerAndLogin('Owner3', 'owner3@test.com', 'owner3');
        const stranger = await registerAndLogin('Stranger2', 'stranger2@test.com', 'stranger2');
        const tag = await createTag(owner.token, { label: 'Hidden', visibility: 'Private' });

        const res = await request(app).get(`/api/tags/${tag.body.id}`).set('Authorization', `Bearer ${stranger.token}`);
        expect(res.statusCode).toBe(404);
    });

    it('returns 404 for a nonexistent id', async () => {
        const { token } = await registerAndLogin('Owner4', 'owner4@test.com', 'owner4');
        const res = await request(app)
            .get('/api/tags/00000000-0000-4000-8000-000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);
    });

    it('returns a followed tag turned Private as "unavailable", not 404 (D9)', async () => {
        const owner = await registerAndLogin('Owner5', 'owner5@test.com', 'owner5');
        const follower = await registerAndLogin('Follower4', 'follower4@test.com', 'follower4');
        const tag = await createTag(owner.token, { label: 'Was public', visibility: 'Public' });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
        await db.update(tags).set({ visibility: 'Private' }).where(eq(tags.id, tag.body.id));

        const res = await request(app).get(`/api/tags/${tag.body.id}`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.isAvailable).toBe(false);
        expect(res.body.isFollowing).toBe(true);
    });
});

// ===========================================================================
// PATCH /api/tags/:id - Update Tag
// ===========================================================================
describe('PATCH /api/tags/:id - Update Tag', () => {
    let token, userId, tagId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
        const res = await createTag(token, { label: 'Original', visibility: 'Private' });
        tagId = res.body.id;
    });

    it('updates label/description/visibility', async () => {
        const res = await request(app)
            .patch(`/api/tags/${tagId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'Renamed', description: 'new desc', visibility: 'Public' });

        expect(res.statusCode).toBe(200);
        expect(res.body.label).toBe('Renamed');
        expect(res.body.description).toBe('new desc');
        expect(res.body.visibility).toBe('Public');
    });

    it('does not touch word membership — that is POST /api/tags/links\' job', async () => {
        const [word] = await db.insert(words).values({ userId, partOfSpeech: 'Noun' }).returning();
        await request(app)
            .post('/api/tags/links')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [word.id] });

        const res = await request(app)
            .patch(`/api/tags/${tagId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'Renamed again' });

        expect(res.statusCode).toBe(200);
        expect(res.body.wordCount).toBe(1);
    });

    it('fails with 409 when renamed to a label already used by the same author', async () => {
        await createTag(token, { label: 'Taken' });
        const res = await request(app)
            .patch(`/api/tags/${tagId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'Taken' });
        expect(res.statusCode).toBe(409);
    });

    it('fails with 403 when not the author', async () => {
        const other = await registerAndLogin('Other3', 'other3@test.com', 'other3');
        const res = await request(app)
            .patch(`/api/tags/${tagId}`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ label: 'Hijacked' });
        expect(res.statusCode).toBe(403);
    });

    it('fails with 404 for a nonexistent id', async () => {
        const res = await request(app)
            .patch('/api/tags/00000000-0000-4000-8000-000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'X' });
        expect(res.statusCode).toBe(404);
    });
});

// ===========================================================================
// DELETE /api/tags/:id - Delete Tag
// ===========================================================================
describe('DELETE /api/tags/:id - Delete Tag', () => {
    let token, userId, tagId, wordId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;

        const [word] = await db.insert(words).values({ userId, partOfSpeech: 'Verb' }).returning();
        wordId = word.id;

        const res = await createTag(token, { label: 'ToDelete', wordIds: [wordId] });
        tagId = res.body.id;
    });

    it('deletes the tag and cleans up TagWord entries, but leaves the word itself (D12)', async () => {
        const res = await request(app).delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);

        const [foundTag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
        expect(foundTag).toBeUndefined();

        const tagWordsRows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(tagWordsRows).toHaveLength(0);

        const [foundWord] = await db.select().from(words).where(eq(words.id, wordId)).limit(1);
        expect(foundWord).toBeDefined();
    });

    it('fails with 403 when not the author', async () => {
        const other = await registerAndLogin('Other4', 'other4@test.com', 'other4');
        const res = await request(app).delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${other.token}`);
        expect(res.statusCode).toBe(403);
    });

    it('fails with 404 for a nonexistent id', async () => {
        const res = await request(app)
            .delete('/api/tags/00000000-0000-4000-8000-000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(404);
    });
});

// ===========================================================================
// POST/DELETE /api/tags/:id/follow - Follow / Unfollow
// ===========================================================================
describe('Follow / Unfollow a tag', () => {
    let owner, follower, tagId;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner6', 'owner6@test.com', 'owner6');
        follower = await registerAndLogin('Follower5', 'follower5@test.com', 'follower5');
        const res = await createTag(owner.token, { label: 'Followable', visibility: 'Public' });
        tagId = res.body.id;
    });

    it('follows a tag and reflects isFollowing/followerCount', async () => {
        const res = await request(app).post(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.isFollowing).toBe(true);
        expect(res.body.followerCount).toBe(1);
    });

    it('is idempotent — following twice does not error or double-count', async () => {
        await request(app).post(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        const res = await request(app).post(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.followerCount).toBe(1);
    });

    it('fails with 400 when following your own tag', async () => {
        const res = await request(app).post(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${owner.token}`);
        expect(res.statusCode).toBe(400);
    });

    it('fails with 403 when the tag is not viewable', async () => {
        const [privateTag] = await db.insert(tags).values({ authorId: owner.id, label: 'Hidden2', visibility: 'Private' }).returning();
        const res = await request(app).post(`/api/tags/${privateTag.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(403);
    });

    it('unfollows a tag and reflects isFollowing/followerCount', async () => {
        await request(app).post(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        const res = await request(app).delete(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.isFollowing).toBe(false);
        expect(res.body.followerCount).toBe(0);
    });

    it('is idempotent — unfollowing when not following is a no-op, not an error', async () => {
        const res = await request(app).delete(`/api/tags/${tagId}/follow`).set('Authorization', `Bearer ${follower.token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.isFollowing).toBe(false);
    });
});

// ===========================================================================
// POST /api/tags/links and /links/remove - Bulk tag<->word links
// ===========================================================================
describe('POST /api/tags/links - Link tags to words', () => {
    let token, userId, tagId, wordId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
        const [word] = await db.insert(words).values({ userId, partOfSpeech: 'Noun' }).returning();
        wordId = word.id;
        const tagRes = await createTag(token, { label: 'Linkable' });
        tagId = tagRes.body.id;
    });

    it('links a tag to a word', async () => {
        const res = await request(app)
            .post('/api/tags/links')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [wordId] });
        expect(res.statusCode).toBe(200);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(1);
    });

    it('is a no-op (not an error) when the link already exists', async () => {
        await request(app).post('/api/tags/links').set('Authorization', `Bearer ${token}`).send({ tagIds: [tagId], wordIds: [wordId] });
        const res = await request(app)
            .post('/api/tags/links')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [wordId] });
        expect(res.statusCode).toBe(200);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(1);
    });

    it('fails with 403 and applies nothing when a tag is not owned by the caller', async () => {
        const other = await registerAndLogin('Other5', 'other5@test.com', 'other5');
        const otherTag = await createTag(other.token, { label: 'NotYours' });

        const res = await request(app)
            .post('/api/tags/links')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId, otherTag.body.id], wordIds: [wordId] });
        expect(res.statusCode).toBe(403);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(0);
    });

    it('fails with 403 and applies nothing when a word is not owned by the caller', async () => {
        const other = await registerAndLogin('Other6', 'other6@test.com', 'other6');
        const otherWord = await createWord(other.token, 'Noun', 'singularEN', 'pear');

        const res = await request(app)
            .post('/api/tags/links')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [wordId, otherWord.id] });
        expect(res.statusCode).toBe(403);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(0);
    });
});

describe('POST /api/tags/links/remove - Unlink tags from words', () => {
    let token, userId, tagId, wordId;

    beforeEach(async () => {
        const data = await registerAndLogin();
        token = data.token;
        userId = data.id;
        const [word] = await db.insert(words).values({ userId, partOfSpeech: 'Noun' }).returning();
        wordId = word.id;
        const tagRes = await createTag(token, { label: 'Unlinkable', wordIds: [word.id] });
        tagId = tagRes.body.id;
    });

    it('removes a tag<->word link', async () => {
        const res = await request(app)
            .post('/api/tags/links/remove')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [wordId] });
        expect(res.statusCode).toBe(200);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(0);
    });

    it('is a no-op (not an error) when the link does not exist', async () => {
        await request(app).post('/api/tags/links/remove').set('Authorization', `Bearer ${token}`).send({ tagIds: [tagId], wordIds: [wordId] });
        const res = await request(app)
            .post('/api/tags/links/remove')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId], wordIds: [wordId] });
        expect(res.statusCode).toBe(200);
    });

    it('fails with 403 and removes nothing when a tag is not owned by the caller', async () => {
        const other = await registerAndLogin('Other7', 'other7@test.com', 'other7');
        const otherTag = await createTag(other.token, { label: 'NotYours2' });

        const res = await request(app)
            .post('/api/tags/links/remove')
            .set('Authorization', `Bearer ${token}`)
            .send({ tagIds: [tagId, otherTag.body.id], wordIds: [wordId] });
        expect(res.statusCode).toBe(403);

        const rows = await db.select().from(tagWords).where(eq(tagWords.tagId, tagId));
        expect(rows).toHaveLength(1);
    });
});

// ===========================================================================
// Tag sharing lifecycle — UNCHANGED controller code (Slice 3 rebuilds
// clone's internals); only the wordIds/id shape ripples in here.
// ===========================================================================
describe('Tag sharing lifecycle', () => {
    let owner, recipient;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        recipient = await registerAndLogin('Recipient', 'recipient@test.com', 'recipient');
    });

    const createSharedTag = async () => {
        const word = await createWord(owner.token, 'Verb', 'infinitiveNonFiniteSimpleEN', 'to run');
        const res = await createTag(owner.token, { label: 'Shared', wordIds: [word.id] });
        return res.body;
    };

    it('POST /api/tags/:id/share - shares a tag and creates a notification', async () => {
        const tag = await createSharedTag();

        const res = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        expect(res.statusCode).toBe(200);
        expect(res.body.tagId).toBe(tag.id);
        expect(res.body.recipientId).toBe(recipient.id);
        expect(res.body.status).toBe('pending');
    });

    it('POST /api/tags/:id/share - rejects duplicate pending share', async () => {
        const tag = await createSharedTag();
        await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        expect(res.statusCode).toBe(400);
    });

    it('POST /api/tags/:id/share - rejects sharing another users tag', async () => {
        const tag = await createSharedTag();

        const res = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${recipient.token}`)
            .send({ recipientId: owner.id });

        expect(res.statusCode).toBe(401);
    });

    it('POST /api/tag-shares/:id/accept - clones tag with translations and cases', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/accept`)
            .set('Authorization', `Bearer ${recipient.token}`);

        expect(res.statusCode).toBe(200);

        // The cloned tag must exist with the recipient as author, and
        // (phase-4-tags.md D11) record where it was cloned from.
        const clonedTag = res.body.clonedTag;
        expect(clonedTag.authorId).toBe(recipient.id);
        expect(clonedTag.label).toBe('Shared');
        expect(clonedTag.sourceTagId).toBe(tag.id);
        // Accept doesn't ask for a visibility choice — it copies the source's.
        expect(clonedTag.visibility).toBe(tag.visibility);

        // The cloned word must carry its translations + cases (the §8.3 fix)
        // and its own provenance (D11).
        const [clonedWord] = await db
            .select()
            .from(words)
            .where(eq(words.userId, recipient.id))
            .limit(1);
        expect(clonedWord.isCloned).toBe(true);
        expect(clonedWord.originalCreatorId).toBe(owner.id);
        expect(clonedWord.sourceWordId).not.toBeNull();

        const transRows = await db
            .select()
            .from(translations)
            .where(eq(translations.wordId, clonedWord.id));
        expect(transRows.length).toBeGreaterThanOrEqual(1);

        const caseRows = await db
            .select()
            .from(translationCases)
            .where(eq(translationCases.translationId, transRows[0].id));
        expect(caseRows.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/tag-shares/:id/accept - rejects accept by the sender', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/accept`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.statusCode).toBe(401);
    });

    it('POST /api/tag-shares/:id/decline - declines a share', async () => {
        const tag = await createSharedTag();
        const share = await request(app)
            .post(`/api/tags/${tag.id}/share`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ recipientId: recipient.id });

        const res = await request(app)
            .post(`/api/tag-shares/${share.body.id}/decline`)
            .set('Authorization', `Bearer ${recipient.token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('declined');

        const [updated] = await db
            .select()
            .from(tagShares)
            .where(eq(tagShares.id, share.body.id))
            .limit(1);
        expect(updated.status).toBe('declined');
    });
});

// ===========================================================================
// POST /api/tags/:id/clone — Slice 3 rebuild: caller-chosen visibility,
// source_tag_id/source_word_id provenance, a numeric suffix on label
// collision, batch inserts (word/translation/case correctness must survive
// the switch from a per-word loop), and auto-unfollow.
// ===========================================================================
describe('POST /api/tags/:id/clone - Clone a Public tag', () => {
    let owner, stranger;

    beforeEach(async () => {
        owner = await registerAndLogin('Owner', 'owner@test.com', 'owner');
        stranger = await registerAndLogin('Stranger', 'stranger@test.com', 'stranger');
    });

    const cloneTag = (token, tagId, visibility = 'Private') =>
        request(app)
            .post(`/api/tags/${tagId}/clone`)
            .set('Authorization', `Bearer ${token}`)
            .send({ visibility });

    it('clones a Public tag with the caller\'s chosen visibility, not the source\'s', async () => {
        const word = await createWord(owner.token, 'Noun', 'singularNominative', 'book');
        const tag = await createTag(owner.token, { label: 'PublicTag', visibility: 'Public', wordIds: [word.id] });

        const res = await cloneTag(stranger.token, tag.body.id, 'Private');

        expect(res.statusCode).toBe(200);
        expect(res.body.isOwner).toBe(true);
        expect(res.body.author.id).toBe(stranger.id);
        expect(res.body.visibility).toBe('Private');
        expect(res.body.wordCount).toBe(1);
        expect(res.body.sourceTag).toEqual({ id: tag.body.id, label: 'PublicTag' });
    });

    it('rejects cloning a Private tag with 403', async () => {
        const tag = await createTag(owner.token, { label: 'PrivateTag', visibility: 'Private' });
        const res = await cloneTag(stranger.token, tag.body.id);
        expect(res.statusCode).toBe(403);
    });

    it('rejects cloning your own tag with 400', async () => {
        const tag = await createTag(owner.token, { label: 'MineAlready', visibility: 'Public' });
        const res = await cloneTag(owner.token, tag.body.id);
        expect(res.statusCode).toBe(400);
    });

    it('fails with 404 for a nonexistent tag', async () => {
        const res = await cloneTag(stranger.token, '00000000-0000-4000-8000-000000000000');
        expect(res.statusCode).toBe(404);
    });

    it('fails with 400 for an invalid visibility value', async () => {
        const tag = await createTag(owner.token, { label: 'PublicTag2', visibility: 'Public' });
        const res = await cloneTag(stranger.token, tag.body.id, 'Invalid');
        expect(res.statusCode).toBe(400);
    });

    // Regression guard for the per-word-loop -> batch-insert rewrite: two
    // words, each with its own translations, must not cross-contaminate.
    it('clones multiple words with each word\'s own translations intact', async () => {
        const cat = await createWord(owner.token, 'Noun', 'singularNominative', 'cat');
        const dog = await createWord(owner.token, 'Noun', 'singularNominative', 'dog');
        const tag = await createTag(owner.token, { label: 'Animals', visibility: 'Public', wordIds: [cat.id, dog.id] });

        const res = await cloneTag(stranger.token, tag.body.id);
        expect(res.statusCode).toBe(200);
        expect(res.body.wordCount).toBe(2);

        const clonedWords = await db.select().from(words).where(eq(words.userId, stranger.id));
        expect(clonedWords).toHaveLength(2);

        for (const clonedWord of clonedWords) {
            expect(clonedWord.isCloned).toBe(true);
            expect(clonedWord.originalCreatorId).toBe(owner.id);
            expect([cat.id, dog.id]).toContain(clonedWord.sourceWordId);

            const sourceWord = clonedWord.sourceWordId === cat.id ? cat : dog;
            const expectedWord = sourceWord === cat ? 'cat' : 'dog';

            const [translation] = await db
                .select()
                .from(translations)
                .where(eq(translations.wordId, clonedWord.id))
                .limit(1);
            const [caseRow] = await db
                .select()
                .from(translationCases)
                .where(eq(translationCases.translationId, translation.id))
                .limit(1);
            // Each cloned word's case value must match ITS OWN source word,
            // never the other one's (what a misaligned batch-insert zip
            // would produce).
            expect(caseRow.word).toBe(expectedWord);
        }
    });

    it('appends a numeric suffix when the label collides with one the recipient already has', async () => {
        await createTag(stranger.token, { label: 'Kitchen' });
        const tag = await createTag(owner.token, { label: 'Kitchen', visibility: 'Public' });

        const res = await cloneTag(stranger.token, tag.body.id);
        expect(res.statusCode).toBe(200);
        expect(res.body.label).toBe('Kitchen (2)');
    });

    it('removes the follow when cloning a tag the caller already follows (D11)', async () => {
        const tag = await createTag(owner.token, { label: 'Followed then cloned', visibility: 'Public' });
        await request(app).post(`/api/tags/${tag.body.id}/follow`).set('Authorization', `Bearer ${stranger.token}`);

        const res = await cloneTag(stranger.token, tag.body.id);
        expect(res.statusCode).toBe(200);

        const followRows = await db
            .select()
            .from(userFollowingTags)
            .where(eq(userFollowingTags.tagId, tag.body.id));
        expect(followRows).toHaveLength(0);
    });
});

describe('GET /api/tags/:id - Private tag hides existence from a non-author', () => {
    it('returns 404 (not 401) for a non-author viewing a Private tag', async () => {
        const owner = await registerAndLogin('Owner2', 'owner2clone@test.com', 'owner2clone');
        const stranger = await registerAndLogin('Stranger2', 'stranger2clone@test.com', 'stranger2clone');
        const word = await createWord(owner.token, 'Noun', 'singularNominative', 'book');
        const tag = await createTag(owner.token, { label: 'Hidden3', visibility: 'Private', wordIds: [word.id] });

        const res = await request(app)
            .get(`/api/tags/${tag.body.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);

        expect(res.statusCode).toBe(404);
    });
});
