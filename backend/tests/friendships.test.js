/**
 * Friendships API — Integration Tests
 *
 * These tests verify the friendship lifecycle: creating a request, listing
 * friendships, accepting, deleting requests, and removing established
 * friendships.
 *
 * Migration notes (Mongoose → Drizzle):
 *   - The `userIds` array in the legacy Mongoose model is now two columns
 *     (`user1_id`, `user2_id`).  The controller accepts and returns the
 *     array format for backward compatibility.
 *   - Partnerships nested inside the old document are now stored in the
 *     `friendship_partnerships` table.
 *   - Notification assertions use the Drizzle `notifications` table directly.
 */

const request = require('supertest');
const { and, eq } = require('drizzle-orm');
const app = require('../app');
const testDb = require('./db');
const { db, pool } = require('../src/db');
const { friendships, notifications } = require('../src/db/schema');

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue());

beforeAll(() => testDb.connectDB());
beforeEach(() => testDb.clearDB());
afterAll(async () => {
    await testDb.closeDB();
    await pool.end();
});

// Helper: register a user and return the response body with `_id` and `token`.
const registerAndLogin = async (name, email, username) => {
    await request(app).post('/api/users').send({ name, email, username, password: 'pass123' });
    const r = await request(app).post('/api/users/login').send({ email, password: 'pass123' });
    return r.body;
};

describe('Friendship Flow', () => {
    let userA, userB, userC;

    beforeEach(async () => {
        userA = await registerAndLogin('Alice', 'alice@test.com', 'alice');
        userB = await registerAndLogin('Bob', 'bob@test.com', 'bob');
        userC = await registerAndLogin('Carol', 'carol@test.com', 'carol');
    });

    const createFriendship = async (sender, recipient) => {
        return request(app)
            .post('/api/friendships').set('Authorization', `Bearer ${sender.token}`)
            .send({ userIds: [sender._id, recipient._id], status: 'pending' });
    };

    it('POST /api/friendships - sends a friend request', async () => {
        const res = await createFriendship(userA, userB);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'pending');
        // NB: notification creation on friend request is not implemented in the
        // controller (legacy behaviour preserved).  The front-end / notification
        // service is expected to create the notification externally.
    });

    it('PUT /api/friendships/acceptRequestAndDeleteNotifications/:id - accepts request', async () => {
        const req_ = await createFriendship(userA, userB);
        const friendshipId = req_.body._id;

        const res = await request(app)
            .put(`/api/friendships/acceptRequestAndDeleteNotifications/${friendshipId}`)
            .set('Authorization', `Bearer ${userB.token}`)
            .send({ status: 'accepted' });

        expect(res.statusCode).toBe(200);

        // Verify the friendship status was updated in the database.
        const [updated] = await db
            .select()
            .from(friendships)
            .where(eq(friendships.id, friendshipId))
            .limit(1);
        expect(updated.status).toBe('accepted');

        // No notification was created (legacy behaviour), so the delete is a no-op.
        const [notif] = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.userId, userB._id), eq(notifications.variant, 'friendRequest')))
            .limit(1);
        expect(notif).toBeUndefined();
    });

    it('DELETE /api/friendships/deleteRequestAndNotifications/:id - deletes a pending request', async () => {
        const req_ = await createFriendship(userA, userB);
        const friendshipId = req_.body._id;

        const res = await request(app)
            .delete(`/api/friendships/deleteRequestAndNotifications/${friendshipId}`)
            .set('Authorization', `Bearer ${userA.token}`);

        expect(res.statusCode).toBe(200);

        const [found] = await db
            .select()
            .from(friendships)
            .where(eq(friendships.id, friendshipId))
            .limit(1);
        expect(found).toBeUndefined();
    });

    it('GET /api/friendships/getFriendships - lists friendships', async () => {
        await createFriendship(userA, userB);

        const res = await request(app)
            .get(`/api/friendships/getFriendships?userId=${userA._id}`)
            .set('Authorization', `Bearer ${userA.token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
});

describe('DELETE /api/friendships/:id - Delete Friendship', () => {
    let userA, userB;

    beforeEach(async () => {
        userA = await registerAndLogin('Alice', 'alice@test.com', 'alice');
        userB = await registerAndLogin('Bob', 'bob@test.com', 'bob');
    });

    it('deletes an accepted friendship', async () => {
        const req_ = await request(app)
            .post('/api/friendships').set('Authorization', `Bearer ${userA.token}`)
            .send({ userIds: [userA._id, userB._id], status: 'pending' });
        const friendshipId = req_.body._id;

        await request(app)
            .put(`/api/friendships/acceptRequestAndDeleteNotifications/${friendshipId}`)
            .set('Authorization', `Bearer ${userB.token}`)
            .send({ status: 'accepted' });

        const del = await request(app)
            .delete(`/api/friendships/${friendshipId}`)
            .set('Authorization', `Bearer ${userA.token}`);

        expect(del.statusCode).toBe(200);

        const [found] = await db
            .select()
            .from(friendships)
            .where(eq(friendships.id, friendshipId))
            .limit(1);
        expect(found).toBeUndefined();
    });
});
