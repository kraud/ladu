/**
 * Notifications API — Integration Tests
 *
 * Migration notes (Mongoose → Drizzle):
 *   - The aggregation pipeline (User/Tag $lookup) is replaced by
 *     application-level join queries in the controller.
 *   - There is no client route to create a notification: `POST /api/notifications`
 *     let any user notify any user ids with any text, and was removed
 *     (demo-access.md Review log S2-2). Notification rows are made by the server, in
 *     the transaction of the domain action (§8.1); these tests insert them directly.
 */

// Must run before `require('../app')` below — see auth.test.js's comment on
// this same pattern for why (this file isn't Babel/ts-jest transformed, so
// jest.mock hoisting never applies to it).
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

const request = require('./request');
const { eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { notifications } = require('../src/db/schema');

jest.setTimeout(15000);

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

/** A notification for `recipientId`, sent by `requesterId`, as the server would make it. */
const notify = (recipientId, requesterId) =>
    db.insert(notifications).values({ userId: recipientId, variant: 'friendRequest', dismissed: false, content: { requesterId } });

const registerAndLogin = async (name, email, username) => {
    await request(app).post('/api/users').send({ name, email, username, password: 'pass123', languages: ['English', 'Spanish'] });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

describe('Notification CRUD', () => {
    let userA, userB;

    beforeEach(async () => {
        userA = await registerAndLogin('Alice', 'alice@test.com', 'alice');
        userB = await registerAndLogin('Bob', 'bob@test.com', 'bob');
    });

    it('POST /api/notifications is gone: 404, and nothing is created', async () => {
        const res = await request(app)
            .post('/api/notifications')
            .set('Authorization', `Bearer ${userA.token}`)
            .send({ user: [userB.id], variant: 'friendRequest', content: { requesterId: userA.id } });

        expect(res.statusCode).toBe(404);
        expect(await db.select().from(notifications)).toHaveLength(0);
    });

    it('GET /api/notifications/getNotifications - lists notifications for the current user', async () => {
        await notify(userB.id, userA.id);

        const res = await request(app)
            .get('/api/notifications/getNotifications')
            .set('Authorization', `Bearer ${userB.token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].variant).toBe('friendRequest');
        // The aux function joins the requester's username
        expect(res.body[0].notificationSender).toBeDefined();
        expect(res.body[0].notificationSender.username).toBe('alice');
    });

    it('GET /api/notifications/getRequesterNotifications - lists notifications where user is requester', async () => {
        await notify(userB.id, userA.id);

        const res = await request(app)
            .get('/api/notifications/getRequesterNotifications')
            .set('Authorization', `Bearer ${userA.token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
    });

    it('PUT /api/notifications/:id - updates a notification', async () => {
        // userB creates a notification for userA (userA is the owner)
        await notify(userA.id, userB.id);

        const [notifRow] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userA.id))
            .limit(1);

        const res = await request(app)
            .put(`/api/notifications/${notifRow.id}`)
            .set('Authorization', `Bearer ${userA.token}`)
            .send({ dismissed: true });

        expect(res.statusCode).toBe(200);
        expect(res.body.dismissed).toBe(true);
    });

    it('DELETE /api/notifications/:id - deletes a notification', async () => {
        await notify(userB.id, userA.id);

        const [notifRow] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userB.id))
            .limit(1);

        const res = await request(app)
            .delete(`/api/notifications/${notifRow.id}`)
            .set('Authorization', `Bearer ${userB.token}`);

        expect(res.statusCode).toBe(200);

        const [found] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, notifRow.id))
            .limit(1);
        expect(found).toBeUndefined();
    });
});

describe('Notification Authorization', () => {
    let userA, userB, userC;

    beforeEach(async () => {
        userA = await registerAndLogin('Alice', 'alice@test.com', 'alice');
        userB = await registerAndLogin('Bob', 'bob@test.com', 'bob');
        userC = await registerAndLogin('Carol', 'carol@test.com', 'carol');
    });

    it('DELETE /api/notifications/:id - rejects deletion by non-owner', async () => {
        // userA creates a notification for userB
        await notify(userB.id, userA.id);

        const [notifRow] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userB.id))
            .limit(1);

        // userC (not the owner) tries to delete
        const res = await request(app)
            .delete(`/api/notifications/${notifRow.id}`)
            .set('Authorization', `Bearer ${userC.token}`);

        expect(res.statusCode).toBe(401);
    });

    it('PUT /api/notifications/:id - rejects update by non-owner', async () => {
        // userA creates a notification for userB
        await notify(userB.id, userA.id);

        const [notifRow] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userB.id))
            .limit(1);

        // userC (not the owner) tries to update
        const res = await request(app)
            .put(`/api/notifications/${notifRow.id}`)
            .set('Authorization', `Bearer ${userC.token}`)
            .send({ dismissed: true });

        expect(res.statusCode).toBe(401);
    });
});
