# Snapshot: Account / NotificationHub / DisplayTag + Social & Tag Components + features (users, friendships, notifications, tags, metrics)

All `file:line` references are relative to `frontend/src/` unless otherwise noted. Routes: `Account` → `/user` (`pages/management/RoutesWithAnimation.tsx:104-108`), `NotificationHub` → `/user/:userId?/notifications` (`RoutesWithAnimation.tsx:97-103`), `DisplayTag` → `/tag/:tagId?` env-gated by `checkEnvironmentAndIterationToDisplay(2)` (`RoutesWithAnimation.tsx:110-127`; gate helper in `components/forms/commonFunctions.ts`, used e.g. `pages/Account.tsx:313,417,502,559`).

---

### Account (route: `/user`)

Purpose: user profile hub — edit own profile (name/username/languages/native language), view own tags + followed tags, view/manage friends, create tags, share tags to friends.

Use cases:
1. Mount → dispatches `getTagsForCurrentUser()`, `getFollowedTagsByUser(user._id)`, `getFriendshipsByUserId(user._id)`, `clearUserResultData()` once on first render (`pages/Account.tsx:80-87`).
2. Redux `user` changes → local `localUserData` copy is rebuilt, defaulting missing `languages` to `[]` and `uiLanguage` to `Lang.EN` for legacy users (`pages/Account.tsx:90-99`).
3. Click "Edit profile" → `isEditing=true` (button toggles to "Save changes", `pages/Account.tsx:353-392`); Save button is disabled while `username` empty/`<3` chars or `name` empty/`<3` chars (`pages/Account.tsx:366-386`).
4. Click "Save changes" while editing → `onSaveUserChanges` → dispatch `updateUser(localUserData)` (auth slice), `isUpdatingUserData=true` (`pages/Account.tsx:191-194`).
5. Update result effect (`pages/Account.tsx:101-115`): on error → `toast.error(message)` and `onCancelEditingUSer()` (local data reset from redux user, `pages/Account.tsx:195-198`) + `isUpdatingUserData=false`; on success (not loading, not friends-modal open) → success toast + `isUpdatingUserData=false`. `updateUser` thunk: `PUT /api/users/updateUser`, and the service rewrites `localStorage['user']` with the new user object + existing token (`features/auth/authService.ts:26-40`; reducer keeps old token: `features/auth/authSlice.ts:175-182`).
6. Click "Cancel" while editing → `onCancelEditingUSer()` resets local data and exits editing (`pages/Account.tsx:394-411` + `:195-198`).
7. Click "Add friends" button (iteration≥4 gate, `pages/Account.tsx:293-311`) → clears `tagIdToShare` and opens `FriendSearchModal` in friend-add mode (`pages/Account.tsx:302-305`).
8. Click "Create tag" button (iteration≥2 gate, `pages/Account.tsx:313-336`) → `setOpenTagModal(true)` with `selectedTag=""` → `TagInfoModal` opens in create mode (`pages/Account.tsx:328`, title prop `pages/Account.tsx:706-709`).
9. Click a tag chip (own or followed) → `setSelectedTag(tagId)` → effect opens `TagInfoModal` with that tag (`pages/Account.tsx:471-476`, `:529-536`, `:160-164`).
10. Empty tags list → "no tags" text + "go to add tags" button navigating to `/review`, disabled unless iteration≥3 (`pages/Account.tsx:478-499`).
11. Empty friends list → "no friends" text + clickable "search and add friends" text opening the friends modal (`pages/Account.tsx:609-647`); non-empty → `FriendList` where clicking a friend extracts the *other* user's id → `setDefaultModalUserId(friendId)` → effect opens `FriendSearchModal` with that default user (`pages/Account.tsx:649-654`, `:200-205`, `:132-136`).
12. FriendSearchModal close → if `tagIdToShare` was set (share flow interrupted), both `tagIdToShare` and `selectedTag` reset (`pages/Account.tsx:660-687`).
13. Friendship list changes in redux → local `activeFriendships` filtered to `status === 'accepted'` (`pages/Account.tsx:119-130`).
14. Deferred refetch flags: if friend/tag lists changed while a modal was open, refetch happens only after the modal closes (`pages/Account.tsx:144-150`, `:166-172`).
15. Share-a-tag flow: `TagInfoModal.triggerAction(tagId)` → `setTagIdToShare(tagId)`, close tag modal, open friends modal in "select friend" mode (`pages/Account.tsx:701-705`). Selecting recipients triggers `onClickUserListSelection` → `sendingNotification=true` + `sendShareTagNotification(users, tagIdToShare)` which builds a `shareTagRequest` notification `{user: [ids], variant, content:{tagId, requesterId}}` and dispatches `createNotification` (`pages/Account.tsx:679-685`, `:211-224`).
16. Share completion effect (`pages/Account.tsx:175-187`): when `sendingNotification && notificationResponse.length>0 && !isLoadingNotifications && isSuccessNotifications` → stop flag, `clearRequesterNotifications()`, reset `tagIdToShare`, close friends modal, success toast, `clearFullTagData()` + `setSelectedTag("")`.

Endpoints: `PUT /api/users/updateUser` — `updateUser` (`features/auth/authService.ts:32`, consumed `features/auth/authSlice.ts:66`); `GET /api/tags/getTags` — `getTagsForCurrentUser` (`features/tags/tagService.ts:14`, `features/tags/tagSlice.ts:43-58`); `GET /api/tags/getFollowedTagsIdByUserId?userId` — `getFollowedTagsByUser` (`tagService.ts:31-42`, `tagSlice.ts:79-94`); `GET /api/friendships/getFriendships?userId` — `getFriendshipsByUserId` (`features/friendships/friendshipService.ts:19-30`, `friendshipSlice.ts:40-55`); `POST /api/notifications` — `createNotification` (`features/notifications/notificationService.ts:7-15`, `notificationSlice.ts:61-76`).

Guards/auth: no per-call guard in the page; all tokens are read from `thunkAPI.getState().auth.user.token` inside thunks (e.g. `friendshipSlice.ts:25`). UI gating by `checkEnvironmentAndIterationToDisplay(N)` for friends (4), tags (2), review-link (3) (`pages/Account.tsx:293,313,417,502,559,495`).

Sequencing/effects: 11 `useEffect`s total (`pages/Account.tsx:80-187`); flag machines `isUpdatingUserData`/`sendingNotification`/`triggerGetFriendships`/`triggerGetTagList`; toasts on profile update success/fail (`:104,111`) and tag share success (`:182`); redux reads of `notificationResponse`/`isSuccessNotifications` (`:51`).

Reuse notes: `UserBadgeData` interface is page-exported and consumed by `UserBadge` (`pages/Account.tsx:31-39`, `components/UserBadge.tsx:5`); the "deferred refetch after modal close" pattern is bespoke; the share-tag notification payload shape `{user: string|string[], variant: 'shareTagRequest', content:{tagId, requesterId}}` is verbatim-portable (`pages/Account.tsx:215-223`).

---

### NotificationHub (route: `/user/:userId?/notifications`)

Purpose: inbox listing incoming `friendRequest` and `shareTagRequest` notifications with accept / delete / snooze actions.

Use cases:
1. Mount → if route `userId !== user._id`, redirect to own notifications URL; otherwise dispatch `getNotifications()` + `getFriendshipsByUserId(user._id)` (`pages/NotificationHub.tsx:50-57`).
2. Each notification row renders an avatar (initials via `stringAvatar`, `pages/NotificationHub.tsx:185-199`), a description (`getDescription`: friendRequest shows sender username `:87-104`; shareTagRequest shows sender + tag label with `'--'` fallback `:105-121`; unknown variant shows `missingNotificationType` `:122-137`), and 3 icon buttons (accept/delete/ignore) colored blue or black when dismissed (`:172,192,235`).
3. Click accept on `friendRequest` → `acceptFriendRequest(notification, friendships, ...)` from `components/generalUseFunctions.ts:236-260`: finds friendship whose `userIds[0] === notification.content.requesterId`, then (a) fires toasts-flags callback, (b) `deleteNotification(notification._id)`, (c) `updateFriendship({_id: friendship._id, status: 'accepted'})`. Callbacks set both `changedNotificationList` and `changedFriendshipList` (`pages/NotificationHub.tsx:308-327`).
4. Click accept on `shareTagRequest` → `setNotificationInProcess(notification._id)` + dispatch `acceptExternalTag(notification.content.tagId)` (`pages/NotificationHub.tsx:328-332`).
5. Share-accept completion effect (`pages/NotificationHub.tsx:74-85`): when `notificationInProcess !== "" && clonedTagResponse !== undefined && !isLoadingTags && isSuccessTags` → `onClickDelete(notificationInProcess)`, clear `notificationInProcess`, `clearClonedTagData()`, success toast.
6. Click delete → `setChangedNotificationList(true)` + `deleteNotification(id)` (`pages/NotificationHub.tsx:303-306`).
7. Click snooze (ignore) → dispatch `updateNotification({_id, dismissed: !dismissed})` and set changed flag (`pages/NotificationHub.tsx:405-413`).
8. Refetch-queue effects: notifications refetched when `isSuccessNotifications && changedNotificationList && !isLoadingNotifications` (`:59-64`); friendships refetched + `toast.info` when friendship change lands (`:66-72`). NB bug: that effect's dep array uses `changedNotificationList`, not `changedFriendshipList` (`pages/NotificationHub.tsx:72`), so the toast/refetch fires on the wrong flag.
9. Empty list → "no notifications" text; loading state shows spinner while `isLoadingNotifications || isLoadingTags` (`pages/NotificationHub.tsx:455-475`).
10. Icons/tooltips are a variant×action switch: friendRequest → PersonAdd/NotificationsOff/Clear; shareTagRequest → BookmarkAdd/NotificationsOff/BookmarkRemove (`getIcon` `:337-369`, `getTooltipLabel` `:371-403`; empty tooltip string suppresses tooltip `:384`).

Endpoints: `GET /api/notifications/getNotifications` — `getNotifications` (`notificationService.ts:17-25`, thunk `notificationSlice.ts:26-41`); `DELETE /api/notifications/:id` — `deleteNotification` (`notificationService.ts:37-45`, `notificationSlice.ts:97-112`); `PUT /api/notifications/:id` — `updateNotification` (`notificationService.ts:47-55`, `notificationSlice.ts:79-94`); `GET /api/friendships/getFriendships?userId` — as above; `PUT /api/friendships/:id` — `updateFriendship` (`friendshipService.ts:63-71`, `friendshipSlice.ts:109-124`); `POST /api/tags/addExternalTag` — `acceptExternalTag` (`tagService.ts:147-158`, `tagSlice.ts:266-281`).

Guards/auth: none in-page; route param mismatch handled by redirect (`pages/NotificationHub.tsx:51-53`). Note `friendships`/`notifications` slices never clear `isSuccess*` between ops, so effects rely on the changed-flags.

Sequencing/effects: 4 chained effects (`:50-85`) form a two-stage "op flag → refetch → toast" machine; the share-accept path waits on the *tags* slice (`clonedTagResponse`) before deleting the notification — cross-slice dependency. `updateNotification`'s fulfilled case does not store payload (`notificationSlice.ts:170-173`), so the snooze UI relies on the follow-up refetch.

Reuse notes: `getIcon`/`getTooltipLabel` variant/action switch tables are verbatim-portable; the accept-friend-request orchestration helper is dispatch-callback-parameterized (`generalUseFunctions.ts:236-260`) so it is portable to any dispatch implementation.

---

### DisplayTag (route: `/tag/:tagId?`)

Purpose: full-page read-only tag viewer with clone ("copy tag+words") and follow/unfollow actions for public tags owned by others.

Use cases:
1. Mount with `tagId` → dispatch `getTagById(tagId)` + `getFollowedTagsByUser(user._id)` (`pages/DisplayTag.tsx:68-75`).
2. Loading gate: while `isLoadingTags` and not copying/following, `displayContent=false` → `LoadingScreen` (multi-language rotating text, 2400 ms display time) hides content (`pages/DisplayTag.tsx:77-82`, `:140-156`).
3. Tag data lands → `tagCurrentData = fullTagData`, `isEditing=false`; deletion detection branch `!isEditing && isDeleting` exists but `setIsDeleting(true)` is **never called** anywhere in this page — the delete toast path (`:94-99`) is dead code (`pages/DisplayTag.tsx:92-103`, state `:53`).
4. API error → error toast with message (`pages/DisplayTag.tsx:84-90`).
5. Click "Return" → `navigate(-1)` + `clearFullTagData()` (`pages/DisplayTag.tsx:175-186`).
6. If `fullTagData.author !== user._id && fullTagData.public === 'Public'` → show two buttons (`pages/DisplayTag.tsx:188-235`).
7. Click "Clone tag and words" → `setCurrentlyCopyingTag(true)` → effect dispatches `acceptExternalTag(fullTagData._id)` (`pages/DisplayTag.tsx:203-214`, `:107-112`); completion effect: when `clonedTagResponse !== undefined && !isLoadingTags && isSuccessTags` → `clearClonedTagData()` + success toast with tag label (`:114-121`).
8. Click "Follow/Unfollow tag" → `onClickFollowUnfollow()` from `useFollowUnfollowTag` hook (see hook section below), button label/color flips on `userFollowsTag` (`pages/DisplayTag.tsx:220-232`).
9. Follow state computed by `useIsUserFollowingTag` against `followedTagsByUser` (`pages/DisplayTag.tsx:59-66`).
10. Body renders `TagDataForm` with `displayOnly = ((tagId !== "") || fullTagData._id) && !isEditing` — and since `setIsEditing(true)` is never called here, DisplayTag is always read-only (`pages/DisplayTag.tsx:241-254`; `isEditing` only ever set false at `:101`).

Endpoints: `GET /api/tags/:id` — `getTagById` (`tagService.ts:60-68`, `tagSlice.ts:133-148`); `GET /api/tags/getFollowedTagsIdByUserId?userId`; `POST /api/tags/addExternalTag` — `acceptExternalTag`.

Guards/auth: none in-page; authorship/visibility check is UI-level only (`pages/DisplayTag.tsx:188-192`) — no server-side confirmation before the clone/follow dispatch beyond the thunk's token header.

Sequencing/effects: `currentlyCopyingTag` and `currentlyFollowingOrUnfollowingTag` flags suppress the loading screen during clone/follow (`pages/DisplayTag.tsx:79`); toast IDs (`toastId: "click-on-modal"`, `:87`) de-dupe error toasts.

Reuse notes: `emptyTagData` shape `{author,label,description,public:'Private',words:[]}` is shared verbatim with `TagInfoModal` (`pages/DisplayTag.tsx:44-50`, `components/TagInfoModal.tsx:76-82`); the clone completion effect is a direct duplicate of NotificationHub's (`pages/DisplayTag.tsx:114-121` vs `pages/NotificationHub.tsx:75-85`) — a reimplementation should factor it.

---

### FriendSearchModal (component)

Purpose: dual-mode modal — (a) friend management: search any user, view their profile+tags, add/accept/cancel/delete friendship; (b) share-tag mode (when `userList` prop passed): multi-select friends and send a `shareTagRequest`.

Use cases:
1. Opened with `defaultUserId` → dispatch `getUserById` + `getTagsByAnotherUserID` (that user's public tags) (`components/FriendSearchModal.tsx:122-130`).
2. Opened in share mode (`props.userList` defined) → dispatch `getNotificationsUserAsRequester()` to learn who already has a pending share for this tag; matching notification `user` ids (compared against `fullTagData._id`) are excluded from selectable lists (`components/FriendSearchModal.tsx:97-120`). NB: the effect body references `fullTagData`, but `fullTagData` is destructured *later* at `:229` — works at runtime only because effects run post-render; a latent hoisting hazard.
3. Type in `AutocompleteSearch` → debounced (400 ms, inside the component) dispatch `searchUser({nameOrUsernameMatch, searchOnlyFriends: userList !== undefined})` (`components/FriendSearchModal.tsx:292-298`).
4. Select a result: share mode appends to `selectedUsersList` chips (removable via `ChipList` onDelete `:321-334`); normal mode sets `selectedUser` → profile view (`:299-308`).
5. Share mode also lists remaining friends (`FriendList` with `getListOfAvailableUsers(...)` filtering out already-selected and already-notified ids, `:340-358`, helper `components/generalUseFunctions.ts:503-534`); "Send tag" button dispatches parent callback with selected list, disabled when selection empty (`:378-391`).
6. Profile view shows `UserBadge`, the other user's tags as chips — clicking one closes the modal and navigates to `/tag/:tagId` (`:405-450`).
7. Friendship action button is a 4-state machine computed by `getFriendRequestButtonLabel(friendships, id)` (`components/generalUseFunctions.ts:214-234`): 0 = no friendship → `sendFriendRequestNotification` (creates `friendRequest` notification `{user:[id], variant, content:{requesterId, requesterUsername}}`, `:182-193`) **and** `addFriendship` (`POST` with `{userIds:[me, them], status:'pending'}`, first userId = requester, `:195-205`); 1 = they requested → `acceptRequest` (`acceptFriendshipRequestAndDeleteNotification`, `:214-218`); 2 = I requested → `cancelRequest` (`deleteFriendshipRequestAndNotification`, `:207-212`); 3 = accepted friends → `deleteActiveFriendship` (`deleteFriendship` + `reloadFriendList()` prop callback, `:220-227`).
8. Confirmation: states 0/1 skip confirmation (`ignoreConfirmation`, `:508-512`); states 2/3 require a second click via `ConfirmationButton` (`:513-518`).
9. **Dual-slice wait effect** (`components/FriendSearchModal.tsx:148-180`): four op booleans `sentRequest/cancelledRequest/acceptedRequest/deletedRequest` (`:91-94`) are set optimistically on click; the toast for each fires only when **both** slices report settled — `(isSuccessNotifications && !isLoadingNotifications) || deletedRequest || cancelledRequest || acceptedRequest` AND `isSuccessFriendships && !isLoadingFriendships` (cancel/delete/accept don't touch the notifications loading flag, hence the exception, `:149-156`). After any toast, `getFriendshipsByUserId` is re-dispatched to refresh button labels (`:174-178`).
10. "Cancel" button in profile view: clears selection; if the user came from the friend list (`defaultUserId`), closes the modal instead of returning to search (`:525-541`).
11. Modal close (`handleOnClose`) resets selection, clears `otherUserTags` + `userResult` (`:84-89`).

Endpoints: `GET /api/users/searchUser?nameOrUsernameMatch&searchOnlyFriends` — `searchUser` (`features/users/userService.ts:8-19`, thunk `features/users/userSlice.ts:33-48`); `GET /api/users/getUser/:userId` — `getUserById` (`userService.ts:22-30`, `userSlice.ts:50-65`); `GET /api/tags/getOtherUserTags?otherUserId` — `getTagsByAnotherUserID` (`tagService.ts:18-29`, `tagSlice.ts:61-76`); `GET /api/notifications/getRequesterNotifications` — `getNotificationsUserAsRequester` (`notificationService.ts:27-35`, `notificationSlice.ts:43-58`); `POST /api/notifications` — `createNotification`; `POST /api/friendships` — `createFriendship` (`friendshipService.ts:7-15`, `friendshipSlice.ts:22-37`); `DELETE /api/friendships/deleteRequestAndNotifications/:id` — `deleteFriendshipRequestAndNotification` (`friendshipService.ts:42-50`, `friendshipSlice.ts:74-89`); `PUT /api/friendships/acceptRequestAndDeleteNotifications/:id` body `{status:'accepted'}` — `acceptFriendshipRequestAndDeleteNotification` (`friendshipService.ts:52-61`, `friendshipSlice.ts:91-106`); `DELETE /api/friendships/:id` — `deleteFriendship` (`friendshipService.ts:32-40`, `friendshipSlice.ts:57-72`).

Guards/auth: none in-component; token pulled per-thunk. Known unguarded quirk: no check that a `friendRequest` notification already exists before sending another (server-side responsibility, unverified here).

Sequencing/effects: 6 effects (`:97-234`); the 4-op-boolean + dual-slice wait is the core flag machine; `userResult → selectedUser` mapping effect (`:133-146`); `otherUserTags → allTags` copy effect (`:232-234`).

Reuse notes: the friendship-state resolution (`checkIfAlreadyFriend` + `getFriendRequestButtonLabel`, `generalUseFunctions.ts:204-234`) and the button label/color/icon lookup arrays at `components/FriendSearchModal.tsx:495-518` are verbatim-portable data.

---

### TagInfoModal (component)

Purpose: create / edit / review / delete a tag (and bulk-delete its words); entry point for "send to friend" share flow; follow/unfollow for non-author public tags.

Use cases:
1. Open with empty `tagId` → `isEditing=true` → blank form, create mode (`components/TagInfoModal.tsx:116-121`).
2. Open with a `tagId` and not editing/updating → dispatch `getTagById(tagId)` into `fullTagData` (`:123-129`).
3. Authorship: `userIsAuthor = fullTagData.author === user._id` (`:156-160`).
4. Create mode buttons: "Create tag" (disabled unless `tagCurrentData.completionState` set by the form, or while loading) → `createNewTag()`: `isCreating=true`, dispatch `createTag(tagCurrentData)`, `setMadeChangesToTagList(true)` (parent defers refetch), `isEditing=false` (`:240-278`, `:400-406`); "Cancel" → `handleOnClose()` (full reset incl. `clearFullTagData()` and delete-flag reset, `:65-74`).
5. Edit mode (existing tag): "Save changes" → `updateExistingTagData()` → `updateTag(tagCurrentData)` + changes flag (`:176-198`, `:408-414`); "Cancel" reverts local copy from `fullTagData` (`:204-216`); "Delete tag" → `deleteTagData()` → `deleteTag(tagCurrentData._id)` + changes flag (`:222-237`, `:416-421`).
6. Review mode as author: "Send to friend" → `props.triggerAction(tagCurrentData._id)` (parent switches to FriendSearchModal share mode, `:292-301`); "Delete all words" via `ConfirmationButton` → `deleteTagWords()` maps `tagCurrentData.words[*]._id` and dispatches `deleteManyWordsById(wordsId)` (words slice), disabled when tag has no words (`:303-319`, `:423-432`); "Edit" → `setIsEditing(true)` (`:325-333`); "Close" → `handleOnClose()` (`:337-353`). These author buttons are hidden once `currentTagHasBeenDeleted` (`:285`).
7. Review mode as non-author (following user): `ConfirmationButton` "Follow/Unfollow tag" → `onClickFollowUnfollow()`, disabled while loading; "Close" (`:356-395`).
8. Result-processing effect (`:134-154`): when `!isLoadingTags && isSuccessTags && fullTagData !== undefined` — delete → info toast + `isDeleting=false` + `currentTagHasBeenDeleted=true`; update → success toast + `isUpdating=false`; create → success toast + `isCreating=false`; always `tagCurrentData = fullTagData` and `isEditing=false`. NB: createTag/updateTag/deleteTag all write their payload into the same `fullTagData` slot (`features/tags/tagSlice.ts:450-453,489-492,476-479`), so the modal distinguishes ops purely by its local booleans.
9. Words-deleted effect: `words` slice success + `isDeletingWords` → toast + `clearFullTagDataWords()` (sets `fullTagData.words=[]`, `tagSlice.ts:342-347`) (`components/TagInfoModal.tsx:162-170`).
10. Follow completion: effect dispatches `getFollowedTagsByUser(user._id)` whenever `currentlyFollowingOrUnfollowingTag` returns false and `fullTagData` exists (`:104-114`) — refreshes followed list after `useFollowUnfollowTag` finishes.

Endpoints: `POST /api/tags` — `createTag` (`tagService.ts:70-78`, thunk `tagSlice.ts:151-166`); `PUT /api/tags/:id` — `updateTagById` (`tagService.ts:100-108`, `tagSlice.ts:205-220`); `DELETE /api/tags/:id` — `deleteTagById` (`tagService.ts:90-98`, `tagSlice.ts:187-202`); `DELETE /api/words/...` (bulk) — `deleteManyWordsById` (`features/words/wordSlice.ts`, consumed `components/TagInfoModal.tsx:26,430`); `GET /api/tags/:id`.

Guards/auth: none in-component; only UI-level author check switches button sets (`:281,356`). `completionState` on `TagData` (set by `TagDataForm`) gates save (`:190,254`).

Sequencing/effects: op-boolean machine `isCreating/isUpdating/isDeleting/isDeletingWords` + `currentTagHasBeenDeleted` (`:85-92`); follow/unfollow via the shared hook (`:95-102`).

Reuse notes: create/update/delete all funnel into the `fullTagResponse → fullTagData` slot — a reimplementation should give each op its own response slot (this is the source of the overloaded-slot confusion documented in the task). The `setMadeChangesToTagList` deferred-parent-refetch contract (`:36`, wired at `pages/Account.tsx:698-700`) is a clean pattern.

---

### UserBadge (component)

Purpose: profile card — avatar, name/username (text or TextField when editing), email, and the DnD language-order selector.

Use cases:
1. View mode: displays name, username (fallback `"-username"`), email (`components/UserBadge.tsx:60-142`).
2. Edit mode (`isEditing`): name and username become controlled `TextField`s pushing changes up via `returnFieldsData({...userData, name/username})` on every keystroke (`:62-75`, `:96-109`).
3. `DnDLanguageOrderSelector` is embedded: `allSelectedItems = userData.languages`, drag-reorder and add/remove push `languages` up via `returnFieldsData`; `otherItems` = languages not yet selected (computed by filtering `Lang` enum values, `:27-35`, `:209-246`); container is single (`singleContainer={!isEditing}`) and disabled outside edit mode; the native-language button (`displayLeftActionButton.selectedItemLabel`) toggles `nativeLanguage` — clicking the already-selected one unsets it (`:226-241`).
4. Loading overlay: `CircularProgress` ring around the avatar while `isLoading` (`:167-200`).

Endpoints: none (pure presentational + controlled callbacks).

Guards/auth: n/a.

Sequencing/effects: none (no effects); all state lives in parent (`pages/Account.tsx:55-57,266-276`).

Reuse notes: directly reusable as a controlled component; the language-enum → remaining-languages computation (`UserBadge.tsx:27-35`) and `nativeLanguage` toggle semantics are verbatim-portable.

---

### AutocompleteSearch (component)

Purpose: generic MUI Autocomplete-based single-select search over `SearchResult`s (type `user` | `tag` | `word`), used by FriendSearchModal.

Use cases:
1. Typing → 400 ms debounce → `props.getOptions(inputValue)` (parent dispatches the search thunk) (`components/AutocompleteSearch.tsx:69-80`).
2. Loading alignment effect: keeps local `loadingLocal` in sync with `props.isSearchLoading` and clears stale options, so the first option never flashes "no matches" (`:57-66`).
3. `props.options` changes → copied into local `options` (`:82-84`).
4. Selecting a value → effect fires `props.onSelect(value)`, closes dropdown, resets value to null (`:87-93`).
5. Per-type rendering: icon — word → country flag, user → avatar, tag → filled LocalOffer if `completeTagInfo.author === current user` else outlined (`getOptionIcon :95-145`); second line — word → part-of-speech abbreviation, user → username + friendship-status icon from `getFriendRequestButtonLabel` (index into `[null, EmojiPeople, Quiz, HowToReg]`), tag → public/private (`getSecondLayerInfo :147-212`).

Endpoints: none (parent-injected fetch); consumes redux `state.friendships` + `state.auth.user` for option decoration (`:54-55`).

Guards/auth: n/a.

Sequencing/effects: 4 effects as above; no redux writes.

Reuse notes: fully generic — works for users/tags/words with no component changes; the debounce+loading-sync pair is a reusable pattern. All option rendering is config by `SearchResult.type`.

---

### AutocompleteMultiple (component)

Purpose: multi-select tag filter/selector backed by tag search; returns `FilterItem`s shaped by `matchAll` mode.

Use cases:
1. Typing → 400 ms debounce → dispatch `searchTagsByLabel({query, includeOtherUsersTags: false, includeFollowedTags: true})` directly from the component (`components/AutocompleteMultiple.tsx:50-61`).
2. Same loading-sync effect as AutocompleteSearch against `isLoadingTagSearch` (`:39-47`; dedicated search-loading flag `features/tags/tagSlice.ts:16,408-420` avoids triggering page-wide loading bars).
3. `searchResultTags` → converted to `TagData[]` options (`searchResultToTag`, `:63-78`).
4. `onChange`: empty → `saveResults([])`; `matchAll` → single `FilterItem` with `restrictiveArray` (all selected tags must match simultaneously); else one additive `FilterItem` per tag with `additiveItem` (`:121-175`, shape builder `getDataToStoreByType :83-119`).
5. Props `allowNewOptions`, `disabled`, `forceLoadingState`, `limitTags` adjust behavior (`:14-27`).

Endpoints: `GET /api/tags/searchTags?query&includeOtherUsersTags&includeFollowedTags` — `searchTagsByLabel` → `searchTags` (`tagService.ts:44-58`, thunk `tagSlice.ts:97-112`).

Guards/auth: n/a.

Sequencing/effects: 3 effects; note booleans are sent as strings in query params (`tagService.ts:51-53`).

Reuse notes: `FilterItem`/`matchAll` contract is the reusable filter-protocol; TODOs in-source flag a planned refactor to `SearchResult` (`:15,75`).

---

### GeneralUseComponents (component file)

Exports: `CountryFlag`, `ChipList`, `FriendList`, `getIconByEnvironment`, `triggerToastMessageWithButton`, `ChipListOfWordDetailsElements` (`components/GeneralUseComponents.tsx:36-462`).

**ChipList** (`:98-191`): renders MUI Chips from `TagData[]|SearchResult[]`. Discrimination is duck-typed: item has `words` → TagData → label `"<label> (<wordCount>)"` when it has words (`:100-109` — this is where **tag word counts** are displayed); `type` switch for SearchResults (`:112-127`). Click → `onClickAction(item._id ?? item.id)` (`:131-142`); `deletableItems` → `onDelete` wired to `onClickAction` for SearchResults, unimplemented TODO for TagData (`:144-153`).

**FriendList** (`:202-324`): renders `FriendshipData[]` rows with striped background/rounded first-last rows (`:214-226`), initials avatar via `stringAvatar(getOtherUserDataFromFriendship(friendship, currentUserId).name)` (`:241-253`), clickable username (respects `disableNameOnClick`, `:270-288`) and an action `IconButton` (custom `actionIcon` or default ArrowForwardIos, `:301-317`). `getOtherUserDataFromFriendship` picks the participant whose `_id !== currentUserId` (`generalUseFunctions.ts:83-…`).

**CountryFlag** (`:36-89`): wrapper over `country-flag-icons` with border/size props. **getIconByEnvironment** (`:326-356`): env-based icon (dev → ConstructionIcon etc.). **triggerToastMessageWithButton** (`:367-411`): programmatic toast with action button. **ChipListOfWordDetailsElements** (`:418-462`): chips of noun/verb case data (`ts/wordCasesDataByPoS` import `:20`).

Endpoints: none. Guards: n/a. Sequencing: ChipList keys by `index + '-' + label` (`:166`). Reuse: both list components are generic; the TagData-vs-SearchResult duck typing (`:102,134,147`) should be replaced by a discriminated union in the reimplementation.

---

### DnDLanguageOrderSelector + DnDSortableItem (components)

Purpose: dnd-kit based two-container item ordering (used for `user.languages` ordering inside UserBadge).

Use cases:
1. Two `SortableContext` containers ("selected" and "other"); MouseSensor requires 5 px drag distance to avoid accidental reorders (`components/DnDLanguageOrderSelector.tsx:50-57`).
2. Drag within "selected" → `arrayMove` reorder of `allSelectedItems` (language priority order) (`:116-129`); within "other" similarly (`:123-129`).
3. Drag between containers → `sortingLogicBetweenDifferentContainers`: to "selected" → splice from `otherItems` and insert at destination index (`:59-75`); to "other" → allowed only if `allSelectedItems.length > 2`, else error toast "You can't have less than 2 languages displayed." (toastId `always-2-lang`, 2.5 s auto-close) (`:76-88`).
4. Click-based move: `DnDSortableItem`'s "+"/"-" right action button calls `onActionButtonClick` → same cross-container logic via `moveLanguageToOtherContainer` (`components/DnDLanguageOrderSelector.tsx:135-147`, button at `components/DnDSortableItem.tsx:216-228`).
5. Native-language pin: left `PersonPinCircle` button when `displayLeftActionButton`/`onActionButtonLeftClick` provided; tooltip explains it marks native language; disabled items show "This is your current native-language" (`components/DnDSortableItem.tsx:178-206`).
6. Item display modes `'text'|'flag'|'both'`, `flagSide`, `hideIndex`, translated labels via `t('languages.<lang>')` (`components/DnDSortableItem.tsx:88-153`); invisible placeholder item reserves drop space (`:171-176`).
7. `singleContainer` (UserBadge view mode) renders only the selected container; `disabled` freezes both drag and buttons (`components/DnDLanguageOrderSelector.tsx:27-31,102`).

Endpoints: none. Guards: n/a. Sequencing: all changes pushed synchronously via `setAllSelectedItems`/`setOtherItems` props — no local state, no effects. Reuse: container-agnostic (props accept any string ids, though the language-pairing with `Lang` enum is baked into `DnDSortableItem`'s flag rendering); the >2-languages minimum rule is a verbatim-portable invariant.

---

### ImageCarousel (component)

Purpose: auto-advancing framer-motion image carousel with swipe + dot navigation.

Use cases: 1. Mount / `images.length` or `intervalTime` change → `setInterval` advancing `currentIndex` cyclically, cleared on unmount/change (`components/ImageCarousel.tsx:18-33`). 2. Swipe left/right handlers cycle index (`:36-46`). 3. Dot click sets index and resets interval (`:49-53`). Mobile breakpoint via `useMediaQuery("(max-width: 600px)")` (`:15`). Consumed by `pages/Practice.tsx:23` (not by any in-scope page). Endpoints: none. Reuse: generic, props-only (`images`, `intervalTime`, `showDots`).

---

### ConfirmationButton + ConfirmationModal (components)

**ConfirmationButton** (`components/ConfirmationButton.tsx`): click → if `ignoreConfirmation` → immediately `onConfirm()`; else swaps to inline confirm/cancel panel (`buttonWasClicked` state, `:24,32`); confirm runs `onConfirm()` and resets (`:51-57`); cancel just resets (`:74-87`); custom labels fall back to i18n `buttons.confirm`/`buttons.cancel` (`:61-64,83-86`). Local state only, no endpoints. Used by FriendSearchModal (friendship cancel/delete) and TagInfoModal (delete-all-words, follow/unfollow) (`FriendSearchModal.tsx:462-519`, `TagInfoModal.tsx:308-318,364-377`).

**ConfirmationModal** (`components/ConfirmationModal.tsx:13-33`): MUI `Dialog` with title/message/cancel/confirm; pure controlled component. NB: currently **unconsumed** by any in-scope page/component (no importers among the targets; a grep of the snapshot targets shows no usage) — candidate for deletion or adoption in the reimplementation.

---

### hooks/useFollowUnfollowTag.tsx

Two hooks:
- `useFollowUnfollowTag({isUserFollowingTag, setIsUserFollowingTag})` (`hooks/useFollowUnfollowTag.tsx:12-59`): reads tags slice (`followedTagResponse`, `fullTagData`, loading flags, `:14`); local flag `currentlyFollowingOrUnfollowingTag`. `onClickFollowUnfollow()` (`:44-53`): sets flag, then dispatch `unfollowTag({tagId: fullTagData._id, userId})` or `followTag(...)` based on current state. Completion effect (`:26-42`): when `followedTagResponse !== undefined && !isLoadingTags && isSuccessTags` → clear flag; if was following → toast "You do not follow this tag anymore" + refetch `getFollowedTagsByUser` + set false; else toast "You are now following this tag" + set true; finally `clearFollowedTagData()`. Error toast effect (`:18-24`). NB: toasts are hardcoded English strings, not i18n (`:31,36`); both follow and unfollow write the same `followedTagResponse` slot (`features/tags/tagSlice.ts:541-545,554-558`) — the "overloaded followedTagResponse slot".
- `useIsUserFollowingTag({tagList, tagIdToCheck})` (`:67-85`): derives `userFollowsTag` by id-membership in the followed-tags list, recomputed on either input.

Endpoints: `POST /api/tags/followTag` body `{tagId, userId}` (`tagService.ts:160-168`, thunk `tagSlice.ts:284-299`); `DELETE /api/tags/unfollowTag/:tagId` with **request body** `{userId}` (`tagService.ts:170-181`, thunk `tagSlice.ts:302-317`). Guards: none. Consumers: `pages/DisplayTag.tsx:59-66`, `components/TagInfoModal.tsx:95-102`.

### hooks/useInterval.tsx

`useIntervalFunction(callback, delay|null, runCallbackOnStart?)` (`hooks/useInterval.tsx:3-26`): stores callback in a ref; if `delay !== null` optionally ticks once immediately then `setInterval`; cleanup clears. Sole consumer: `pages/management/MainView.tsx:67-75` polls `getNotifications()` every 90 000 ms (comment erroneously says 60 s) with `runCallbackOnStart=true`, gated on `localStorage['user']` existing (`MainView.tsx:69`).

---

### features/users (slice + service)

State: `userList` (search results), `userResult` (single fetched user), generic `isError/isSuccess/isLoadingUser/message` (`features/users/userSlice.ts:6-24`).
Thunks: `searchUser` → `GET /api/users/searchUser` with query `{nameOrUsernameMatch, searchOnlyFriends}` (`userService.ts:8-19`; thunk `userSlice.ts:33-48`); `getUserById` → `GET /api/users/getUser/:userId` (`userService.ts:22-30`; thunk `userSlice.ts:50-65`).
Reducers: `resetUserSliceState`, `clearUserResultData` (`userSlice.ts:70-83`); extraReducers set `userList`/`userResult` on fulfilled (`:84-114`). Note thunk names are `'auth/searchUser'`/`'auth/getUser'` (`userSlice.ts:33,50`) because users and auth share the backend controller — cosmetic, but rename in reimpl. Consumers: FriendSearchModal (`:7,102,126,294`), Account (`:20,85`).

### features/friendships (slice + service)

State: `friendships[]`, `isError/isSuccessFriendships/isLoadingFriendships/message` (`friendshipSlice.ts:5-19`).
Thunks → endpoints (all `features/friendships/friendshipService.ts`, token from `getState().auth.user.token` in every thunk `friendshipSlice.ts:25,43,60,77,94,112`):
- `createFriendship` → `POST /api/friendships` (`:7-15`, thunk `:22-37`)
- `getFriendshipsByUserId` → `GET /api/friendships/getFriendships?userId` (`:19-30`, thunk `:40-55`)
- `deleteFriendship` → `DELETE /api/friendships/:id` (`:32-40`, thunk `:57-72`)
- `deleteFriendshipRequestAndNotification` → `DELETE /api/friendships/deleteRequestAndNotifications/:id` (`:42-50`, thunk `:74-89`)
- `acceptFriendshipRequestAndDeleteNotification` → `PUT /api/friendships/acceptRequestAndDeleteNotifications/:id` body `{status:'accepted'}` (`:52-61`, thunk `:91-106`)
- `updateFriendship` → `PUT /api/friendships/:id` (`:63-71`, thunk `:109-124`)
Reducer: only `reset` local reducer; every fulfilled sets `isSuccessFriendships=true` and — for the get — replaces `friendships`; create/delete/update deliberately do **not** mutate `friendships` (TODO comments `:140-141,154-155,168-169`), relying on callers to refetch. Consumers: Account, NotificationHub, FriendSearchModal, generalUseFunctions.

### features/notifications (slice + service)

State: `notifications[]`, `notificationResponse[]` (create result), `requesterNotifications[]`, `isError/isSuccessNotifications/isLoadingNotifications/message` (`notificationSlice.ts:5-23`).
Thunks → endpoints (`notificationService.ts`):
- `getNotifications` → `GET /api/notifications/getNotifications` (`:17-25`, thunk `notificationSlice.ts:26-41`)
- `getNotificationsUserAsRequester` → `GET /api/notifications/getRequesterNotifications` (`:27-35`, thunk `:43-58`)
- `createNotification` → `POST /api/notifications` (`:7-15`, thunk `:61-76`; fulfilled stores `[action.payload]` into `notificationResponse`, `:157-161` — the slot Account's share effect watches)
- `updateNotification` → `PUT /api/notifications/:id` (`:47-55`, thunk `:79-94`)
- `deleteNotification` → `DELETE /api/notifications/:id` (`:37-45`, thunk `:97-112`)
Reducers: `reset`, `clearRequesterNotifications` (`:117-125`). Every thunk shares the single `isLoadingNotifications` flag (`:128-190`), which is why FriendSearchModal needs the "no notifications-loading" exception for accept/cancel/delete (`FriendSearchModal.tsx:149-156`). Notification payload variants: `friendRequest` with `content.{requesterId, requesterUsername}`, `shareTagRequest` with `content.{tagId, requesterId}`; `user` may be `string|string[]`; response objects embed `notificationSender.username` and `notificationTag.label` (producers `Account.tsx:215-223`, `FriendSearchModal.tsx:183-192`; readers `NotificationHub.tsx:90,107,148`). Poll: MainView every 90 s (`MainView.tsx:67-75`).

### features/tags (slice + service)

State (`tagSlice.ts:5-40`): `tags` (own, as SearchResults), `otherUserTags`, `followedTagsByUser: TagData[]`, `searchResultTags`, `fullTagData: TagData|undefined`, `currentTagAmountWords: number`, `clonedTagResponse: {clonedTag, clonedWords}|undefined`, `followedTagResponse: any` (overloaded follow+unfollow slot, `:13`), `tagLabelIsAlreadyInUse`, separate `isLoadingTagSearch` vs `isLoadingTags`.
Thunks → endpoints (`tagService.ts:183-187` exports 15 fns):
- `getTagsForCurrentUser` → `GET /api/tags/getTags` (`tagService.ts:8-16`, thunk `:43-58`)
- `getTagsByAnotherUserID` → `GET /api/tags/getOtherUserTags?otherUserId` (`:18-29`, thunk `:61-76`)
- `getFollowedTagsByUser` → `GET /api/tags/getFollowedTagsIdByUserId?userId` (`:31-42`, thunk `:79-94`)
- `searchTagsByLabel` → `GET /api/tags/searchTags?query&includeOtherUsersTags&includeFollowedTags` (`:44-58`, thunk `:97-112`; separate `isLoadingTagSearch` flag)
- `filterTagsByAnyField` → `GET /api/tags/filterTags` (`:130-145`, thunk `:115-130`; consumed via `TableFilters`)
- `getTagById` → `GET /api/tags/:id` (`:60-68`, thunk `:133-148`)
- `createTag` → `POST /api/tags` (`:70-78`, thunk `:151-166`)
- `checkIfTagLabelIsAvailable` → `POST /api/tags/checkIfTagLabelAvailable` (`:80-88`, thunk `:169-184`)
- `deleteTag` → `DELETE /api/tags/:id` (`:90-98`, thunk `:187-202`)
- `updateTag` → `PUT /api/tags/:id` (`:100-108`, thunk `:205-220`)
- `applyNewTagToSelectedWordsById` → `POST /api/tags/addTagInBulkToWords` (`:110-118`, thunk `:228-243`)
- **`getAmountByTag` — dead thunk**: `GET /api/tags/getAmountByTag/:id`, thunk marked "TODO: never used. Not properly implemented? Check if needed. If not, delete." (`tagSlice.ts:245-263`, reducer writes `currentTagAmountWords` `:512-524`). No dispatches anywhere in the app; the word count shown in ChipList comes from `item.words.length` instead (`GeneralUseComponents.tsx:102-106`).
- `acceptExternalTag` → `POST /api/tags/addExternalTag` body `{tagId}`; response `{clonedTag, clonedWords}` (`:147-158`, thunk `:266-281`, reducer `:525-532`)
- `followTag` / `unfollowTag` → as in the hook section; both write `followedTagResponse` (`:538-563`)
Reducers: `reset`, `clearFullTagData`, `clearClonedTagData`, `clearFollowedTagData`, `clearFullTagDataWords`, `clearOtherUserTags`, `clearSearchResultTags`, `clearTagLabelIsAlreadyInUse` (`tagSlice.ts:322-366`). Shared `isLoadingTags` across nearly all thunks (except search) is what forces DisplayTag's `currentlyCopyingTag || currentlyFollowingOrUnfollowingTag` suppression (`pages/DisplayTag.tsx:79`). Consumers: Account, NotificationHub, DisplayTag, FriendSearchModal, TagInfoModal, AutocompleteMultiple, both follow hooks, TableFilters.

### features/metrics (slice + service)

State: `isError/isSuccess/isLoading/message/data` (`features/metrics/metricSlice.ts:4-18`). Single thunk `getUserMetrics` → `GET /api/users/getUserMetrics` (note: users controller, not a metrics controller — `features/metrics/metricService.ts:4,13`; thunk `metricSlice.ts:20-37`). Reducers: `resetMetricSliceState` (`:43-48`); fulfilled stores payload wholesale in `data` (`:55-61`). Sole consumer: `pages/Dashboard.tsx:15,40-42` (dispatch on mount; charts in `components/charts/UserInfoPanel`). Not used by any page in this snapshot's scope, but the slice+service is fully self-contained and portable.

---
**ConfirmationModal** (`components/ConfirmationModal.tsx:13-33`): MUI `Dialog` with title/message/cancel/confirm; pure controlled component. NB: not used by any page/component in *this* snapshot's scope, but it is consumed outside scope by `components/ExerciseCard.tsx:38,948,965` (practice flow) — keep it when porting.

## Cross-cutting notes for the reimplementation plan

1. **Response-slot overloading**: `fullTagData` receives createTag/updateTag/deleteTag/getTagById payloads (`tagSlice.ts:437-492`) and `followedTagResponse` receives follow+unfollow (`:541-562`); consumers disambiguate with local op booleans (`TagInfoModal.tsx:134-154`, `useFollowUnfollowTag.tsx:26-42`). New design should give one response slot per operation.
2. **Shared loading flags**: one `isLoadingTags`/`isLoadingNotifications` per slice; components work around it with local suppression flags (`DisplayTag.tsx:79`) and exception clauses in wait effects (`FriendSearchModal.tsx:149-156`). Per-thunk loading would delete a whole class of effect gymnastics.
3. **Dual-slice wait effects** (friend request ops): both FriendSearchModal (4 booleans + notification/friendship settled) and NotificationHub (changed-flags + tags slice for share-accept) implement hand-rolled saga-like waits (`FriendSearchModal.tsx:148-180`, `NotificationHub.tsx:59-85`).
4. **Known dead code**: `getAmountByTag` thunk (`tagSlice.ts:245-263`), DisplayTag's `isDeleting` branch (`DisplayTag.tsx:53,94-99`), `ConfirmationModal` (no consumers in scope), `ChipList.onDelete` for TagData (`GeneralUseComponents.tsx:147-149`).
5. **Bugs to not carry over**: NotificationHub friendship-refetch effect deps use `changedNotificationList` instead of `changedFriendshipList` (`NotificationHub.tsx:72`); FriendSearchModal references `fullTagData` before its declaration inside an effect (`FriendSearchModal.tsx:112` vs `:229`); MainView polling comment says 60 s but code uses 90 s (`MainView.tsx:73`); `acceptFriendRequest`'s second callback is named `triggerUpdateNotification` but actually updates the *friendship* (`generalUseFunctions.ts:240,252-255`).
6. **localStorage**: `localStorage['user']` holds the full verified login response incl. token; `updateUser` rewrites it in the service layer (`authService.ts:34-37`); MainView polling and notification gates read it directly (`MainView.tsx:69`).
