# Endpoint contract: social routes (friendships, notifications, tag sharing)

Cut down on 2026-11-02. The old catalog listed all 57 routes of the old app. Its sections for words, users and auth, tags, autocomplete and exercises were removed: those APIs were rebuilt, and `backend/routes/` is the truth for them (`git log -- .context/.frontend/snapshot/endpoints.md` shows the old text). This file keeps the social routes, because those features are not built in the new frontend yet (Phases 6 and 7 of `.context/roadmap.md`, section "Design for the deferred social phases"). **Stop date:** remove this file when the social phases ship.

## Routes in the backend today (checked 2026-11-02)

All need a signed-in learner (`protect`). The friendship and tag-share routes follow the redesign; their controllers and tests are not reconciled (`CLAUDE.md`), and no frontend uses them.

| METHOD | Path | File |
|---|---|---|
| GET | `/api/friendships` | `routes/friendshipRoutes.js` |
| POST | `/api/friendships` | `routes/friendshipRoutes.js` |
| POST | `/api/friendships/:id/accept` | `routes/friendshipRoutes.js` |
| POST | `/api/friendships/:id/decline` | `routes/friendshipRoutes.js` |
| DELETE | `/api/friendships/:id` | `routes/friendshipRoutes.js` |
| GET | `/api/notifications/getNotifications` | `routes/notificationRoutes.js` |
| GET | `/api/notifications/getRequesterNotifications` | `routes/notificationRoutes.js` |
| DELETE | `/api/notifications/:id` | `routes/notificationRoutes.js` |
| PUT | `/api/notifications/:id` | `routes/notificationRoutes.js` |
| POST | `/api/tags/:id/share` | `routes/tagRoutes.js` |
| POST | `/api/tag-shares/:id/accept` | `routes/tagShareRoutes.js` |
| POST | `/api/tag-shares/:id/decline` | `routes/tagShareRoutes.js` |

## The old app (frozen 2026-09-05)

What the old frontend called. Use it as the parity reference (the old app is the tiebreaker until the Phase 8 cutover). The old routes differ from the table above: the old friendship API had no decline, and `PUT /:id` and the compound `...AndNotifications` routes are gone.

Auth column: ✅ = `protect` middleware on the route.

### Friendships — `backend/routes/friendshipRoutes.js` (service: `frontend/src/features/friendships/friendshipService.ts`) — all auth ✅

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/friendships/getFriendships` | ✅ (`friendshipRoutes.js:8`) | Friendships for a participant (`friendshipController.ts`) | `getFriendships` (`friendshipService.ts:19-30`) | Query param `userId` (may be any user, comment at `friendshipService.ts:17-18`) |
| POST | `/api/friendships` | ✅ (`friendshipRoutes.js:9`) | Send friend request (`friendshipController.ts`) | `createFriendship` (`friendshipService.ts:7-15`) | |
| DELETE | `/api/friendships/deleteRequestAndNotifications/:id` | ✅ (`friendshipRoutes.js:11`) | Cancel request + its notifications (`friendshipController.ts`) | `deleteFriendshipRequest` (`friendshipService.ts:42-50`) | Must precede `/:id` (`friendshipRoutes.js:10`) |
| DELETE | `/api/friendships/:id` | ✅ (`friendshipRoutes.js:12`) | Delete friendship (`friendshipController.ts`) | `deleteFriendshipById` (`friendshipService.ts:32-40`) | |
| PUT | `/api/friendships/acceptRequestAndDeleteNotifications/:id` | ✅ (`friendshipRoutes.js:13`) | Accept request (`friendshipController.ts`) | `acceptFriendshipRequest` (`friendshipService.ts:52-61`) | Body `{status: 'accepted'}` (`friendshipService.ts:59`) |
| PUT | `/api/friendships/:id` | ✅ (`friendshipRoutes.js:14`) | Update friendship (`friendshipController.ts`) | `updateFriendshipById` (`friendshipService.ts:63-71`) | |

### Notifications — `backend/routes/notificationRoutes.js` (service: `frontend/src/features/notifications/notificationService.ts`) — all auth ✅

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/notifications/getNotifications` | ✅ (`notificationRoutes.js:8`) | Notifications where user is recipient (`notificationController.ts`) | `getNotifications` (`notificationService.ts:17-25`) | |
| GET | `/api/notifications/getRequesterNotifications` | ✅ (`notificationRoutes.js:9`) | Notifications where user is requester (`notificationController.ts`) | `getRequesterNotifications` (`notificationService.ts:27-35`) | |
| POST | `/api/notifications` | ✅ (`notificationRoutes.js:10`) | Create notification (`notificationController.ts`) | `createNotification` (`notificationService.ts:7-15`) | |
| DELETE | `/api/notifications/:id` | ✅ (`notificationRoutes.js:11`) | Delete notification (`notificationController.ts`) | `deleteNotificationById` (`notificationService.ts:37-45`) | |
| PUT | `/api/notifications/:id` | ✅ (`notificationRoutes.js:12`) | Update notification (e.g. mark read) (`notificationController.ts`) | `updateNotificationById` (`notificationService.ts:47-55`) | |

---

