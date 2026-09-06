/**
 * Notification Controller — Drizzle ORM (PostgreSQL)
 *
 * Migration notes (MongoDB → PostgreSQL):
 *   - The aggregation pipeline (User/Tag $lookup) in `getNotificationDataByRequest`
 *     is replaced by application-level queries: we fetch notifications, then
 *     batch-resolve the requester (users) and optional tag (tags) data.
 *   - The `getNotificationsByUserIdWhereUserIsRequester` endpoint no longer
 *     directly calls `Notification.find()` — it reuses the same aux function
 *     with the appropriate query filter.
 *
 * Route usage is declared in ../routes/notificationRoutes.js (still CJS).
 */

const { db } = require('../src/db');
const { notifications, tags, users } = require('../src/db/schema');

const { and, eq, inArray, sql } = require('drizzle-orm');
const asyncHandler = require('express-async-handler');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
type NotificationRow = typeof notifications.$inferSelect;
type UserRow = typeof users.$inferSelect;
type TagRow = typeof tags.$inferSelect;

/**
 * Shape returned by the old Mongoose aggregation pipeline.
 * Each notification carries a resolved `notificationSender` (with username)
 * and optionally a `notificationTag` (with label) for shareTagRequest variants.
 */
interface NotificationAugmented extends Omit<NotificationRow, 'content'> {
    content: Record<string, any> | null;
    notificationSender: { id: string; username: string } | null;
    notificationTag: { id: string; label: string } | null;
}

/**
 * Shape the frontend expects (NotificationData from interfaces.ts).
 * DB column `id` → `_id`, `userId` → `user`.
 */
interface FrontendNotification {
    _id: string;
    user: string;
    variant: string;
    dismissed: boolean;
    content: Record<string, any> | null;
    notificationSender: { _id: string; username: string } | null;
    notificationTag: { _id: string; label: string } | null;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Resolve the username for each unique requesterId found across notifications.
 *
 * This replaces the MongoDB `$lookup` + `$unwind` against the User collection.
 */
const resolveSenders = async (
    notifications_: NotificationAugmented[],
): Promise<void> => {
    const requesterIds = [
        ...new Set(
            notifications_
                .map((n) => n.content?.requesterId)
                .filter(Boolean) as string[],
        ),
    ];
    if (requesterIds.length === 0) return;

    const userRows = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, requesterIds));

    const usernameMap = new Map(userRows.map((u) => [u.id, u.username]));

    for (const n of notifications_) {
        const rid = n.content?.requesterId;
        if (rid && usernameMap.has(rid)) {
            n.notificationSender = { id: rid, username: usernameMap.get(rid)! };
        }
    }
};

/**
 * Resolve the tag label for each shareTagRequest notification.
 *
 * This replaces the conditional MongoDB `$lookup` + `$unwind` against the Tag
 * collection (which only runs when variant === 'shareTagRequest').
 */
const resolveTags = async (
    notifications_: NotificationAugmented[],
): Promise<void> => {
    const tagRequests = notifications_.filter(
        (n) => n.variant === 'shareTagRequest' && n.content?.tagId,
    );
    if (tagRequests.length === 0) return;

    const tagIds = [...new Set(tagRequests.map((n) => n.content!.tagId as string))];
    const tagRows = await db
        .select({ id: tags.id, label: tags.label })
        .from(tags)
        .where(inArray(tags.id, tagIds));

    const labelMap = new Map(tagRows.map((t) => [t.id, t.label]));

    for (const n of tagRequests) {
        const tid = n.content!.tagId as string;
        if (labelMap.has(tid)) {
            n.notificationTag = { id: tid, label: labelMap.get(tid)! };
        }
    }
};

/**
 * Auxiliary function — the spiritual successor to the old
 * `getNotificationDataByRequest` aggregation pipeline.
 *
 * Accepts a query object with optional keys:
 *   - `user`        → filters by notification.userId
 *   - `variant`     → filters by notification.variant
 *   - `dismissed`   → filters by notification.dismissed
 *   - `requesterId` → filters by content->>'requesterId' (JSONB field)
 *   - `tagId`       → filters by content->>'tagId' (JSONB field)
 *
 * Returns augmented notification documents with resolved sender/tag data.
 */
const getNotificationDataByRequest = async (
    reqQuery: Record<string, any>,
): Promise<NotificationAugmented[]> => {
    const filters: any[] = [];

    if (reqQuery.user !== undefined) {
        filters.push(eq(notifications.userId, reqQuery.user));
    }
    if (reqQuery.variant !== undefined) {
        filters.push(eq(notifications.variant, reqQuery.variant));
    }
    if (reqQuery.dismissed !== undefined) {
        filters.push(eq(notifications.dismissed, reqQuery.dismissed));
    }
    // Support filtering on JSONB content fields (using PostgreSQL ->> operator)
    if (reqQuery.requesterId !== undefined) {
        filters.push(
            sql`${notifications.content}->>'requesterId' = ${reqQuery.requesterId}`,
        );
    }
    if (reqQuery.tagId !== undefined) {
        filters.push(
            sql`${notifications.content}->>'tagId' = ${reqQuery.tagId}`,
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const rows: NotificationAugmented[] = await db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(notifications.createdAt);

    // Convert content to a plain object (it's JSONB, so it's already parsed by Drizzle)
    for (const row of rows) {
        row.content = row.content as Record<string, any> | null;
    }

    await resolveSenders(rows);
    await resolveTags(rows);

    return rows;
};

/**
 * Sort and partition notifications into dismissed → unread (dismissed last),
 * matching the legacy front-end expectation.
 */
const partitionAndSort = (
    data: NotificationAugmented[],
): NotificationAugmented[] => {
    const dismissed: NotificationAugmented[] = [];
    const unread: NotificationAugmented[] = [];

    for (const n of data) {
        if (n.dismissed) dismissed.push(n);
        else unread.push(n);
    }

    // Newest first within each group.
    dismissed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    unread.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return unread.concat(dismissed);
};

/**
 * Transform a DB row (with camelCase `id`, `userId`) into the frontend shape
 * (with `_id`, `user`) that NotificationData expects.
 */
const toFrontendNotification = (
    row: NotificationAugmented,
): FrontendNotification => ({
    _id: row.id,
    user: row.userId,
    variant: row.variant,
    dismissed: row.dismissed,
    content: row.content,
    notificationSender: row.notificationSender
        ? { _id: row.notificationSender.id, username: row.notificationSender.username }
        : null,
    notificationTag: row.notificationTag
        ? { _id: row.notificationTag.id, label: row.notificationTag.label }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// @desc    Get Notifications for the current user
// @route   GET /api/notifications/getNotifications
// @access  Private
const getNotificationsByUserId = asyncHandler(async (req: any, res: any) => {
    const requestQuery = { user: req.user.id };
    const data = await getNotificationDataByRequest(requestQuery);
    const results = partitionAndSort(data).map(toFrontendNotification);
    res.status(200).json(results);
});

// @desc    Get Notifications where the current user is the requester
// @route   GET /api/notifications/getRequesterNotifications
// @access  Private
const getNotificationsByUserIdWhereUserIsRequester = asyncHandler(async (req: any, res: any) => {
    const data = await getNotificationDataByRequest({
        requesterId: req.user.id,
    });
    const results = partitionAndSort(data).map(toFrontendNotification);
    res.status(200).json(results);
});

// @desc    Create notifications (one per user in the user array)
// @route   POST /api/notifications
// @access  Private
const createNotification = asyncHandler(async (req: any, res: any) => {
    // NB! when posting, a NotificationData-user property will always be an array (of at least 1).
    if (!req.body.user) {
        res.status(400);
        throw new Error('Please specify a user to be notified.');
    }
    if (!req.body.variant) {
        res.status(400);
        throw new Error('Please specify the type (variant) of notification.');
    }

    // The notification is added once for each item in user array.
    const notificationRows = (req.body.user as string[]).map((userId: string) => ({
        userId,
        variant: req.body.variant,
        dismissed: false,
        content: req.body.content ?? null,
    }));

    const created = await db
        .insert(notifications)
        .values(notificationRows)
        .returning();

    const augmented: NotificationAugmented[] = created.map((row) => ({
        ...row,
        content: row.content as Record<string, any> | null,
        notificationSender: null,
        notificationTag: null,
    }));

    res.status(200).json(augmented.map(toFrontendNotification));
});

// @desc    Delete Notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req: any, res: any) => {
    const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, req.params.id))
        .limit(1);

    if (!notification) {
        res.status(400);
        throw new Error('Notification not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged-in user matches the notification user
    if (notification.userId !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    await db.delete(notifications).where(eq(notifications.id, req.params.id));

    const deletedRow: NotificationAugmented = {
        ...notification,
        content: notification.content as Record<string, any> | null,
        notificationSender: null,
        notificationTag: null,
    };

    res.status(200).json(toFrontendNotification(deletedRow));
});

// @desc    Update Notification
// @route   PUT /api/notifications/:id
// @access  Private
const updateNotification = asyncHandler(async (req: any, res: any) => {
    const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, req.params.id))
        .limit(1);

    if (!notification) {
        res.status(400);
        throw new Error('Notification not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged-in user matches the notification user
    if (notification.userId !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    // Sanitize body: frontend sends `_id` and `user` but DB has `id` / `userId`
    const {
        _id: _ignoreId,
        user,
        ...rest
    } = req.body;
    const setData: Record<string, any> = { ...rest };
    if (user !== undefined) setData.userId = user;

    const [updated] = await db
        .update(notifications)
        .set(setData)
        .where(eq(notifications.id, req.params.id))
        .returning();

    const updatedRow: NotificationAugmented = {
        ...updated,
        content: updated.content as Record<string, any> | null,
        notificationSender: null,
        notificationTag: null,
    };

    res.status(200).json(toFrontendNotification(updatedRow));
});

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
    getNotificationsByUserId,
    getNotificationsByUserIdWhereUserIsRequester,
    createNotification,
    deleteNotification,
    updateNotification,
};
