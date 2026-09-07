/**
 * Friendship Controller — Drizzle ORM (PostgreSQL)
 *
 * Redesigned per study §8.2. The previous model stored a sort-normalised
 * `user1Id`/`user2Id` pair with a nullable varchar status, no requester
 * identity, no decline action, duplicate-prone create, and compound
 * non-transactional accept/delete endpoints. The redesign:
 *   - `requesterId` / `addresseeId` NOT NULL FKs (direction is preserved).
 *   - NOT NULL `status` enum: pending | accepted | declined | cancelled.
 *   - Database-enforced uniqueness (schema.ts): one pending request per
 *     direction, one accepted friendship per unordered pair.
 *   - One action per endpoint; the friendRequest notification is created /
 *     removed server-side in the same transaction as the friendship write.
 *
 * Route usage is declared in ../routes/friendshipRoutes.js (still CJS).
 */

import { and, eq, or, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';

const { db } = require('../src/db');
const { friendships, notifications, users } = require('../src/db/schema');
const asyncHandler = require('express-async-handler');

type FriendshipRow = typeof friendships.$inferSelect;
type FriendshipStatus = FriendshipRow['status'];

interface ParticipantData {
    id: string;
    name: string;
    username: string;
}

interface FriendshipResponse {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: FriendshipStatus;
    usersData: ParticipantData[];
    createdAt: Date;
    updatedAt: Date;
}

/** `protect` middleware guarantees `req.user`; this controller only reads its id. */
type RequestWithAuth = Request & { user: { id: string } };

const isUuid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/**
 * Assemble the response, resolving display info for both participants.
 */
const toResponse = async (row: FriendshipRow): Promise<FriendshipResponse> => {
    const participants = await db
        .select({ id: users.id, name: users.name, username: users.username })
        .from(users)
        .where(or(eq(users.id, row.requesterId), eq(users.id, row.addresseeId)));

    return {
        id: row.id,
        requesterId: row.requesterId,
        addresseeId: row.addresseeId,
        status: row.status,
        usersData: participants,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
};

/**
 * The friendRequest notification addressed to the recipient (addressee) with
 * the requester recorded in its JSONB content.
 */
const friendRequestNotificationFilter = (addresseeId: string, requesterId: string) =>
    and(
        eq(notifications.userId, addresseeId),
        eq(notifications.variant, 'friendRequest'),
        sql`${notifications.content}->>'requesterId' = ${requesterId}`,
    );

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Get all friendships for the current user (either direction)
// @route   GET /api/friendships
// @access  Private
const getUserFriendships = asyncHandler(async (req: RequestWithAuth, res: Response) => {
    const rows = await db
        .select()
        .from(friendships)
        .where(
            or(
                eq(friendships.requesterId, req.user.id),
                eq(friendships.addresseeId, req.user.id),
            ),
        );

    const result = await Promise.all(rows.map(toResponse));
    res.status(200).json(result);
});

// @desc    Send a friend request (creates the notification in-transaction)
// @route   POST /api/friendships
// @access  Private
const createFriendship = asyncHandler(async (req: RequestWithAuth, res: Response) => {
    const addresseeId: unknown = req.body.addresseeId;

    if (!isUuid(addresseeId)) {
        res.status(400);
        throw new Error('Please specify a valid addresseeId.');
    }
    if (addresseeId === req.user.id) {
        res.status(400);
        throw new Error('You cannot send a friend request to yourself.');
    }

    const [addressee] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, addresseeId))
        .limit(1);
    if (!addressee) {
        res.status(400);
        throw new Error('Addressee not found.');
    }

    // Check both directions for an existing active or outstanding relationship.
    const [existing] = await db
        .select()
        .from(friendships)
        .where(
            and(
                or(
                    and(
                        eq(friendships.requesterId, req.user.id),
                        eq(friendships.addresseeId, addresseeId),
                    ),
                    and(
                        eq(friendships.requesterId, addresseeId),
                        eq(friendships.addresseeId, req.user.id),
                    ),
                ),
                or(
                    eq(friendships.status, 'pending'),
                    eq(friendships.status, 'accepted'),
                ),
            ),
        )
        .limit(1);

    if (existing) {
        res.status(400);
        throw new Error(
            existing.status === 'accepted'
                ? 'You are already friends with this user.'
                : 'A friend request already exists between these users.',
        );
    }

    const [row] = await db.transaction(async (tx) => {
        const [created] = await tx
            .insert(friendships)
            .values({
                requesterId: req.user.id,
                addresseeId,
                status: 'pending',
            })
            .returning();

        await tx.insert(notifications).values({
            userId: addresseeId,
            variant: 'friendRequest',
            dismissed: false,
            content: { requesterId: req.user.id },
        });

        return [created];
    });

    res.status(200).json(await toResponse(row));
});

// @desc    Accept a pending friend request (addressee only)
// @route   POST /api/friendships/:id/accept
// @access  Private
const acceptFriendship = asyncHandler(async (req: RequestWithAuth, res: Response) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (friendship.status !== 'pending') {
        res.status(400);
        throw new Error('Only a pending friendship can be accepted.');
    }
    if (friendship.addresseeId !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to accept: user is not the addressee of this request');
    }

    const [updated] = await db.transaction(async (tx) => {
        const [result] = await tx
            .update(friendships)
            .set({ status: 'accepted' })
            .where(eq(friendships.id, req.params.id))
            .returning();

        // The pending request's notification is removed atomically.
        await tx
            .delete(notifications)
            .where(friendRequestNotificationFilter(req.user.id, friendship.requesterId));

        return [result];
    });

    res.status(200).json(await toResponse(updated));
});

// @desc    Decline a pending friend request (addressee only)
// @route   POST /api/friendships/:id/decline
// @access  Private
const declineFriendship = asyncHandler(async (req: RequestWithAuth, res: Response) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }
    if (friendship.status !== 'pending') {
        res.status(400);
        throw new Error('Only a pending friendship can be declined.');
    }
    if (friendship.addresseeId !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to decline: user is not the addressee of this request');
    }

    const [updated] = await db.transaction(async (tx) => {
        const [result] = await tx
            .update(friendships)
            .set({ status: 'declined' })
            .where(eq(friendships.id, req.params.id))
            .returning();

        await tx
            .delete(notifications)
            .where(friendRequestNotificationFilter(req.user.id, friendship.requesterId));

        return [result];
    });

    res.status(200).json(await toResponse(updated));
});

// @desc    Cancel (requester, while pending) or unfriend (either, once accepted);
//          hard-delete terminal declined/cancelled rows (requester cleanup).
// @route   DELETE /api/friendships/:id
// @access  Private
const deleteFriendship = asyncHandler(async (req: RequestWithAuth, res: Response) => {
    const [friendship] = await db
        .select()
        .from(friendships)
        .where(eq(friendships.id, req.params.id))
        .limit(1);

    if (!friendship) {
        res.status(400);
        throw new Error('Friendship not found');
    }

    const isParticipant =
        friendship.requesterId === req.user.id || friendship.addresseeId === req.user.id;

    if (friendship.status === 'accepted') {
        if (!isParticipant) {
            res.status(401);
            throw new Error('Not allowed to delete: user is not part of the friendship');
        }
        await db.delete(friendships).where(eq(friendships.id, req.params.id));
        res.status(200).json(await toResponse(friendship));
        return;
    }

    if (friendship.requesterId !== req.user.id) {
        res.status(401);
        throw new Error('Not allowed to delete this friendship request');
    }

    if (friendship.status === 'pending') {
        // Cancel: keep the row as terminal history; drop the notification.
        const [cancelled] = await db.transaction(async (tx) => {
            const [result] = await tx
                .update(friendships)
                .set({ status: 'cancelled' })
                .where(eq(friendships.id, req.params.id))
                .returning();

            await tx
                .delete(notifications)
                .where(friendRequestNotificationFilter(friendship.addresseeId, friendship.requesterId));

            return [result];
        });
        res.status(200).json(await toResponse(cancelled));
        return;
    }

    // declined / cancelled — cleanup.
    await db.delete(friendships).where(eq(friendships.id, req.params.id));
    res.status(200).json(await toResponse(friendship));
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getUserFriendships,
    createFriendship,
    acceptFriendship,
    declineFriendship,
    deleteFriendship,
};
