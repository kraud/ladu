/**
 * Friendship Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL schema changes):
 *   - MongoDB stored participants in a `userIds` array (`[ObjectId, ObjectId]`).
 *     PostgreSQL uses explicit `user1_id` / `user2_id` columns.  To keep the
 *     front-end contract unchanged, the controller still accepts `userIds`
 *     in requests and returns it in responses (computed from the two columns).
 *   - Partnerships previously nested inside the friendship document are now
 *     stored in a separate `friendship_partnerships` table.
 *   - Notification deletion (on accept/reject) now directly queries the
 *     `notifications` table via Drizzle instead of Mongoose.
 *
 * Route usage is declared in ../routes/friendshipRoutes.js (still CJS).
 */

const { db } = require('../src/db');
const {
    friendshipPartnerships,
    friendships,
    notifications,
    users,
} = require('../src/db/schema');

const { and, eq, inArray, or, sql }: typeof import('drizzle-orm') = require('drizzle-orm');
const asyncHandler = require('express-async-handler');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
type FriendshipRow = typeof friendships.$inferSelect;
type PartnershipRow = typeof friendshipPartnerships.$inferSelect;
type NotificationRow = typeof notifications.$inferSelect;
type UserRow = typeof users.$inferSelect;

/**
 * The old Mongoose model stored partnerships as a nested array directly on
 * the friendship document.  We keep the same shape in the API response.
 */
interface PartnershipResponse {
    _id: string;
    mentor: string;
    language: string;
}

/**
 * Legacy friendship response shape (matches the old Mongoose toObject()).
 */
interface FriendshipResponse {
    _id: string;
    id: string;
    userIds: string[];
    status: string | null;
    partnerships: PartnershipResponse[];
    usersData?: Array<{ _id: string; name: string; username: string }>;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Normalise the old `userIds` array into the two-column format.
 * UUIDs are sorted lexicographically to prevent duplicate friend pairs
 * (e.g. [B, A] and [A, B] would both produce the same row).
 */
const toUserColumns = (userIds: string[]): { user1Id: string; user2Id: string } => {
    const [a, b] = userIds;
    return a < b ? { user1Id: a, user2Id: b } : { user1Id: b, user2Id: a };
};

/**
 * Reconstruct the legacy `userIds` array from the two columns.
 */
const toUserIdsArray = (row: FriendshipRow): string[] => [row.user1Id, row.user2Id];

/**
 * Fetch partnerships for a set of friendship UUIDs.
 * Returns a Map<friendshipId, PartnershipResponse[]>.
 */
const fetchPartnershipsMap = async (friendshipIds: string[]): Promise<Map<string, PartnershipResponse[]>> => {
    if (friendshipIds.length === 0) return new Map();

    const rows = await db
        .select()
        .from(friendshipPartnerships)
        .where(inArray(friendshipPartnerships.friendshipId, friendshipIds));

    const map = new Map<string, PartnershipResponse[]>();
    for (const p of rows) {
        const entry: PartnershipResponse = {
            _id: p.id,
            mentor: p.mentorId,
            language: p.language,
        };
        const bucket = map.get(p.friendshipId);
        if (bucket) bucket.push(entry);
        else map.set(p.friendshipId, [entry]);
    }
    return map;
};

/**
 * Resolve user display info for a list of user UUIDs.
 */
const fetchUsersData = async (userIds: string[]) => {
    if (userIds.length === 0) return [];

    const rows = await db
        .select({ _id: users.id, name: users.name, username: users.username })
        .from(users)
        .where(inArray(users.id, userIds));

    return rows;
};

/**
 * Assemble a friendship response object from a DB row.
 */
const assembleFriendshipResponse = async (
    row: FriendshipRow,
    partnershipsMap: Map<string, PartnershipResponse[]>,
): Promise<FriendshipResponse> => ({
    _id: row.id,
    id: row.id,
    userIds: toUserIdsArray(row),
    status: row.status,
    partnerships: partnershipsMap.get(row.id) || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

/**
 * Build a notification filter that matches the old Mongoose query pattern
 * `{ user, variant, "content.requesterId": requesterId }`.
 */
const notificationFilter = (userId: string, variant: string, requesterId: string) =>
    and(
        eq(notifications.userId, userId),
        eq(notifications.variant, variant),
        sql`${notifications.content}->>'requesterId' = ${requesterId}`,
    );

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Get all friendships for a given participant
//          (NB! the requester does not need to be the participant themselves)
// @route   GET /api/friendships/getFriendships
// @access  Private
const getUserFriendshipsByParticipantId = asyncHandler(async (req: any, res: any) => {
    if (!req.query || !req.query.userId) {
        res.status(400);
        throw new Error('Missing search query text');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('Logged-in user not found');
    }

    const participantId = req.query.userId;

    // Find all friendships where this user is either participant
    const rows = await db
        .select()
        .from(friendships)
        .where(or(eq(friendships.user1Id, participantId), eq(friendships.user2Id, participantId)));

    if (rows.length === 0) {
        res.status(200).json([]);
        return;
    }

    const friendshipIds = rows.map((r) => r.id);
    const partnershipsMap = await fetchPartnershipsMap(friendshipIds);

    // Resolve display info for every participant across all matched friendships
    const allUserIds = [...new Set(rows.flatMap((r) => [r.user1Id, r.user2Id]))];
    const usersData = await fetchUsersData(allUserIds);
    const usersDataMap = new Map(usersData.map((u) => [u._id, u]));

    const result = await Promise.all(
        rows.map(async (row) => {
            const base = await assembleFriendshipResponse(row, partnershipsMap);
            return {
                ...base,
                usersData: base.userIds.map((id) => usersDataMap.get(id)).filter(Boolean),
            };
        }),
    );

    res.status(200).json(result);
});

// @desc    Create a friendship (friend request)
// @route   POST /api/friendships
// @access  Private
const createFriendship = asyncHandler(async (req: any, res: any) => {
    const userIds: string[] = req.body.userIds;

    if (!userIds) {
        res.status(400);
        throw new Error('Please specify users to be part of the friendship.');
    }
    if (userIds.length !== 2) {
        res.status(400);
        throw new Error('Only 2 users can be part of a friendship');
    }
    if (userIds[0] === userIds[1]) {
        res.status(400);
        throw new Error('The participants of a friendship must be 2 different users');
    }
    if (!userIds.includes(req.user.id)) {
        res.status(401);
        throw new Error('Not allowed to create: user is not part of the friendship');
    }
    if (!req.body.status) {
        res.status(400);
        throw new Error('Please specify the status of the friendship.');
    }

    const { user1Id, user2Id } = toUserColumns(userIds);

    const [newFriendship] = await db
        .insert(friendships)
        .values({ user1Id, user2Id, status: req.body.status })
        .returning();

    // Handle partnerships if provided (matches old behaviour where partnerships
    // were created inline inside the friendship document).
    const incomingPartnerships: Array<{ mentor: string; language: string }> = req.body.partnerships || [];
    if (incomingPartnerships.length > 0) {
        await db.insert(friendshipPartnerships).values(
            incomingPartnerships.map((p) => ({
                friendshipId: newFriendship.id,
                mentorId: p.mentor,
                language: p.language,
            })),
        );
    }

    const partnershipsMap = await fetchPartnershipsMap([newFriendship.id]);
    const response = await assembleFriendshipResponse(newFriendship, partnershipsMap);

    res.status(200).json(response);
});

// @desc    Delete a friendship
// @route   DELETE /api/friendships/:id
// @access  Private
const deleteFriendship = asyncHandler(async (req: any, res: any) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }
    // The user must be a participant of the friendship to delete it
    if (friendship.user1Id !== req.user.id && friendship.user2Id !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to delete: user is not part of the friendship');
    }

    // Cascade FK deletes handle partnership rows automatically.
    await db.delete(friendships).where(eq(friendships.id, req.params.id));

    const partnershipsMap = await fetchPartnershipsMap([friendship.id]);
    const response = await assembleFriendshipResponse(friendship, partnershipsMap);

    res.status(200).json(response);
});

// @desc    Update a friendship
// @route   PUT /api/friendships/:id
// @access  Private
const updateFriendship = asyncHandler(async (req: any, res: any) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }
    if (friendship.user1Id !== req.user.id && friendship.user2Id !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to update: user is not part of the friendship');
    }

    // Build the update payload from the request body.
    // Accept `userIds` array (legacy format) and convert to columns if provided.
    const updateData: Record<string, any> = {};
    if (req.body.userIds) {
        const { user1Id, user2Id } = toUserColumns(req.body.userIds);
        updateData.user1Id = user1Id;
        updateData.user2Id = user2Id;
    }
    if (req.body.status !== undefined) updateData.status = req.body.status;

    if (Object.keys(updateData).length > 0) {
        await db.update(friendships).set(updateData).where(eq(friendships.id, req.params.id));
    }

    // Sync partnerships if provided: remove all existing and re-insert.
    if (req.body.partnerships !== undefined) {
        await db.delete(friendshipPartnerships).where(eq(friendshipPartnerships.friendshipId, req.params.id));

        const incomingPartnerships: Array<{ mentor: string; language: string }> = req.body.partnerships || [];
        if (incomingPartnerships.length > 0) {
            await db.insert(friendshipPartnerships).values(
                incomingPartnerships.map((p) => ({
                    friendshipId: req.params.id,
                    mentorId: p.mentor,
                    language: p.language,
                })),
            );
        }
    }

    const [updated] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    const partnershipsMap = await fetchPartnershipsMap([updated.id]);
    const response = await assembleFriendshipResponse(updated, partnershipsMap);

    res.status(200).json(response);
});

// @desc    Delete a pending friendship request and its associated notification
// @route   DELETE /api/friendships/deleteRequestAndNotifications/:id
// @access  Private
const deleteFriendshipRequest = asyncHandler(async (req: any, res: any) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (friendship.status === 'accepted') {
        res.status(400);
        throw new Error("Can't delete friendship request. Friendship already accepted.");
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }
    if (friendship.user1Id !== req.user.id && friendship.user2Id !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to delete: user is not part of the friendship');
    }

    // Determine the other participant (the one who received the request notification)
    const otherUserId = friendship.user1Id === req.user.id ? friendship.user2Id : friendship.user1Id;

    await db.delete(friendships).where(eq(friendships.id, req.params.id));

    // Clean up the corresponding notification (if one exists).
    const notifFilter = notificationFilter(otherUserId, 'friendRequest', req.user.id);

    const [deletedNotification] = await db
        .delete(notifications)
        .where(notifFilter)
        .returning();

    res.status(200).json({
        deletedFriendshipRequest: { id: friendship.id },
        deletedNotification: deletedNotification || null,
    });
});

// @desc    Accept a friendship request and delete the related notification
// @route   PUT /api/friendships/acceptRequestAndDeleteNotifications/:id
// @access  Private
const acceptFriendshipRequest = asyncHandler(async (req: any, res: any) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (friendship.status === 'accepted') {
        res.status(400);
        throw new Error("Can't accept friendship request. Friendship already accepted.");
    }
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }
    if (friendship.user1Id !== req.user.id && friendship.user2Id !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to accept: user is not part of the friendship');
    }

    // Determine the other participant (the one who sent the request)
    const otherUserId = friendship.user1Id === req.user.id ? friendship.user2Id : friendship.user1Id;

    const [updated] = await db
        .update(friendships)
        .set({ status: req.body.status || 'accepted' })
        .where(eq(friendships.id, req.params.id))
        .returning();

    // Delete the notification that was sent to the current user about this request.
    const notifFilter = notificationFilter(req.user.id, 'friendRequest', otherUserId);

    const [deletedNotification] = await db
        .delete(notifications)
        .where(notifFilter)
        .returning();

    const partnershipsMap = await fetchPartnershipsMap([updated.id]);
    const response = await assembleFriendshipResponse(updated, partnershipsMap);

    res.status(200).json({
        deletedFriendshipRequest: response,
        deletedNotification: deletedNotification || null,
    });
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getUserFriendshipsByParticipantId,
    createFriendship,
    deleteFriendship,
    updateFriendship,
    deleteFriendshipRequest,
    acceptFriendshipRequest,
};
