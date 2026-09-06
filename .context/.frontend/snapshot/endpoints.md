# Endpoint Contract Catalog — Ladu (keelapp)

Snapshot for the full-reimplementation build plan. Every claim carries `file:line` evidence read from the live code.

- Route wiring: `backend/app.js:21-27` mounts the 7 routers under `/api/{words,users,notifications,friendships,tags,autocompleteTranslations,exercises}`.
- All routers and routes are CommonJS `.js` (`backend/routes/*.js`) but they import the **live TS controllers** (`backend/controllers/*.ts`, e.g. `backend/routes/wordRoutes.js:6-7`) and the **live TS auth middleware** (`backend/middleware/authMiddleware.ts`, required by all 7 route files). The sibling Mongoose `.js` controllers (`backend/controllers/*.js`, e.g. `wordController.js`) and `authMiddleware.js` are **dead code** — nothing imports them.
- Auth model: `Authorization: Bearer <JWT>` header, JWT carries only `{ id }`, expires in 30d (`userController.ts:52-57`); `protect` verifies the token and 401s with `Not authorized` / `Not authorized (missing token)` (`authMiddleware.ts:5-31`).
- Error shape: global `errorHandler` returns `{ message, stack (non-prod only) }` with the status code set by the controller (`errorMiddleware.js:33-42`, mounted `app.js:29`).
- Legacy-compat note: word/tag/user responses deliberately keep the old Mongo `_id` field alongside the Postgres `id` (`wordService.ts:57-69`, `tagController.ts:29-34`, `userController.ts:59-75`).

## Reconciliation

| Count | Value |
|---|---|
| Backend-exposed routes | **57** (words 10, users 10, tags 15, autocompleteTranslations 8, friendships 6, notifications 5, exercises 3) |
| Frontend service methods | **55** exported across 10 services; **54** make HTTP calls (`logout` in `authService.ts:43-45` is localStorage-only) |
| Frontend-called endpoints | **54** (every backend route except the 3 backend-only ones below) |
| Backend-only routes | `GET /api/users/me` (`userRoutes.js:12` → `getMe`, `userController.ts:241-244`) — no FE consumer; `GET /api/words/getWordsRelatedToFollowedTag` (`wordRoutes.js:11` → `getWordsByFollowedTag`, `wordController.ts:469-473`) — no FE consumer; `GET /api/words/getAllWordDataByWord` (`wordRoutes.js:17`) — TODO-marked, no FE consumer |

TODO-marked routes (both carry `// TODO: this should be removed? Double check`):
- `GET /api/tags/filterTags` (`tagRoutes.js:17` → `getTagDataByRequest`, `tagController.ts:93-138`) — **IS consumed** by `tagService.filterTags` (`tagService.ts:130-145`, params `_id/author/label/description/public`).
- `GET /api/words/getAllWordDataByWord` (`wordRoutes.js:17` → `getAllWordDataByWord`, `wordController.ts:1069-1072`, wrapping `getWordDataByRequest` at `wordController.ts:1028-1066`) — **no FE consumer**; query params mirror `buildWordConditions` (`wordController.ts:109-120`: `id`, `user`, `partOfSpeech`, `clue`).

## Master table

Auth column: ✅ = `protect` middleware on the route; ❌ = unguarded (by design unless noted).

### Words — `backend/routes/wordRoutes.js` (service: `frontend/src/features/words/wordService.ts`)

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/words` | ✅ (`wordRoutes.js:9`) | All words owned by the user, full `WordResponse[]` (`wordController.ts:454-464`) | `getWords` (`wordService.ts:17-25`) | No pagination |
| GET | `/api/words/getWordsRelatedToFollowedTag` | ✅ (`wordRoutes.js:11`) | Word IDs belonging to tags the user follows (`wordController.ts:469-473`) | **none** (backend-only) | Returns plain `string[]` |
| GET | `/api/words/simple` | ✅ (`wordRoutes.js:13`) | Filtered/simplified words for table view (`wordController.ts:478-566`) | `getWordsSimplified` (`wordService.ts:27-38`) | Query param `filters` (JSON array); own words + followed-tag words |
| GET | `/api/words/searchWord` | ✅ (`wordRoutes.js:15`) | Case-insensitive search across any translation case (`wordController.ts:936-1022`) | `searchWord` (`wordService.ts:83-94`) | Query param `query`; excludes `gender%`/`gradable%` cases |
| GET | `/api/words/getAllWordDataByWord` | ✅ (`wordRoutes.js:17`) | Legacy generic word query (`wordController.ts:1069-1072`) | **none** (backend-only) | **TODO-marked** (`wordRoutes.js:17`) |
| GET | `/api/words/:id` | ✅ (`wordRoutes.js:19`) | Single word with translations/cases/tags (`wordController.ts:571-580`) | `getWordById` (`wordService.ts:40-48`) | 400 "Word not found" if missing |
| POST | `/api/words` | ✅ (`wordRoutes.js:21`) | Create word + translations + cases + tag links (`wordController.ts:585-650`) | `createWord` (`wordService.ts:7-15`) | 400 unless `partOfSpeech` and ≥2 translations |
| PUT | `/api/words/:id` | ✅ (`wordRoutes.js:23`) | Update word, diff-sync translations/cases/tags (`wordController.ts:655-860`) | `updateWordById` (`wordService.ts:73-81`) | Body key `id` used for URL (`wordService.ts:79`); 401 if not owner; deletes exercise-perf rows for removed translations |
| DELETE | `/api/words/deleteMany` | ✅ (`wordRoutes.js:26`) | Delete multiple words (`wordController.ts:897-934`) | `deleteManyWordsById` (`wordService.ts:60-71`) | `wordsId: string[]` in request **body** of a DELETE; route must stay before `/:id` (`wordRoutes.js:25`) |
| DELETE | `/api/words/:id` | ✅ (`wordRoutes.js:27`) | Delete one word, cascades translations/cases/tag_words (`wordController.ts:865-892`) | `deleteWordById` (`wordService.ts:50-58`) | |

### Users / Auth — `backend/routes/userRoutes.js` (services: `frontend/src/features/auth/authService.ts`, `users/userService.ts`, `metrics/metricService.ts`)

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| POST | `/api/users` | ❌ (`userRoutes.js:9`) | Register user + email verification token/mail (`userController.ts:116-179`) | `register` (`authService.ts:8-12`) | 201, public user shape; unguarded by design |
| POST | `/api/users/login` | ❌ (`userRoutes.js:10`) | Email+password login, returns JWT (`userController.ts:181-193`) | `login` (`authService.ts:15-23`) | Stores whole response in `localStorage['user']` when `verified` (`authService.ts:18-20`) |
| PUT | `/api/users/updateUser` | ✅ (`userRoutes.js:11`) | Update profile fields (`userController.ts:195-239`) | `updateUser` (`authService.ts:26-40`) | FE re-hydrates `localStorage['user']` with `{...response.data, token}` (`authService.ts:34-37`) |
| GET | `/api/users/me` | ✅ (`userRoutes.js:12`) | Current user from token (`userController.ts:241-244`) | **none** (backend-only) | |
| GET | `/api/users/searchUser` | ✅ (`userRoutes.js:13`) | Find users by name/username (`userController.ts:246-316`) | `getUsersByNameUsername` (`userService.ts:8-19`) | Query params spread from `SearchUserQuery` (`userService.ts:13-15`) |
| GET | `/api/users/getUser/:id` | ✅ (`userRoutes.js:14`) | Public user by ID (`userController.ts:318-333`) | `getUserByUserId` (`userService.ts:22-30`) | |
| GET | `/api/users/:id/verify/:token` | ❌ (`userRoutes.js:15`) | Email verification; consumes one-time token, marks verified, returns JWT (`userController.ts:335-376`) | `validateUser` (`authService.ts:47-56`) | 400 `{message}` on invalid link; on success FE stores `response.data.user` (`authService.ts:52-54`) |
| POST | `/api/users/requestPasswordReset` | ❌ (`userRoutes.js:16`) | Create reset token + email link (`userController.ts:378-413`) | `requestPasswordResetToken` (`authService.ts:63-66`) | 200 `{}`; 400 if email unknown |
| PUT | `/api/users/updatePassword` | ❌ (`userRoutes.js:17`) | Set new password using reset token (`userController.ts:415-453`) | `updatePassword` (`authService.ts:58-61`) | Body `{userId, password, token}`; clears all `passwordTokens` (`userController.ts:439-450`) |
| GET | `/api/users/getUserMetrics` | ✅ (`userRoutes.js:18`) | Basic dashboard metrics (`userController.ts:455-475`) | `getUserMetrics` (`metricService.ts:7-15`) | Service lives under `features/metrics` but base URL is `/api/users` (`metricService.ts:4`) |

### Tags — `backend/routes/tagRoutes.js` (service: `frontend/src/features/tags/tagService.ts`)

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/tags/getTags` | ✅ (`tagRoutes.js:13`) | Tags authored by current user, each with resolved words (`tagController.ts:227-233` via `getTagDataByRequest`, `tagController.ts:93-138`) | `getUserTags` (`tagService.ts:8-16`) | The "minimal tag list" |
| GET | `/api/tags/getOtherUserTags` | ✅ (`tagRoutes.js:14`) | Tags of another user, excluding already-followed (`tagController.ts:247-274`) | `getOtherUserTags` (`tagService.ts:18-29`) | Query param `otherUserId` |
| GET | `/api/tags/getFollowedTagsIdByUserId` | ✅ (`tagRoutes.js:15`) | Tag IDs a user follows (`tagController.ts:234-245`) | `getFollowedTagsByUserId` (`tagService.ts:31-42`) | Query param `userId`; 401 if missing |
| GET | `/api/tags/searchTags` | ✅ (`tagRoutes.js:16`) | Search tags incl. others'/followed toggles (`tagController.ts:140-225`) | `searchTags` (`tagService.ts:44-58`) | Params `query`, `includeOtherUsersTags`, `includeFollowedTags` (sent as strings, parsed by `queryParamToBool` `tagController.ts:20-21`) |
| GET | `/api/tags/filterTags` | ✅ (`tagRoutes.js:17`) | Generic tag filter (`tagController.ts:93-138`) | `filterTags` (`tagService.ts:130-145`) | **TODO-marked** but consumed; params `_id/author/label/description/public` |
| GET | `/api/tags/:id` | ✅ (`tagRoutes.js:18`) | Single tag with words (`tagController.ts:276-279`) | `getTagById` (`tagService.ts:60-68`) | Non-UUID id throws via `getTagDataByRequest` (`tagController.ts:100-101`) |
| POST | `/api/tags/addExternalTag` | ✅ (`tagRoutes.js:19`) | Clone a tag + its words for current user (`tagController.ts:329-389`) | `addExternalTag` (`tagService.ts:147-158`) | Body `{tagId}` |
| POST | `/api/tags/followTag` | ✅ (`tagRoutes.js:20`) | Follow another user's tag (`tagController.ts:308-327`) | `followTagByAnotherUser` (`tagService.ts:160-168`) | Body `{tagId, userId}`; 401 if `userId` missing |
| POST | `/api/tags/addTagInBulkToWords` | ✅ (`tagRoutes.js:21`) | Bulk-associate tags with words (`tagController.ts:281-306`) | `addTagsInBulkToWords` (`tagService.ts:110-118`) | Body `{newTagsToApply: string[], selectedWords: string[]}` |
| POST | `/api/tags/checkIfTagLabelAvailable` | ✅ (`tagRoutes.js:22`) | Label uniqueness check (`tagController.ts:391-407`) | `checkIfTagLabelAvailable` (`tagService.ts:80-88`) | Body `{tagLabel, userId}` |
| GET | `/api/tags/getAmountByTag/:id` | ✅ (`tagRoutes.js:23`) | Word count per tag (`tagController.ts:596-611`) | `getTagWordsAmount` (`tagService.ts:120-128`) | |
| POST | `/api/tags` | ✅ (`tagRoutes.js:24`) | Create tag (`tagController.ts:409-448`) | `createTag` (`tagService.ts:70-78`) | 400 without `label` |
| DELETE | `/api/tags/unfollowTag/:id` | ✅ (`tagRoutes.js:25`) | Unfollow a followed tag (`tagController.ts:482-521`) | `unfollowTagByAnotherUser` (`tagService.ts:170-181`) | `userId` in DELETE **body**; must precede `/:id` |
| DELETE | `/api/tags/:id` | ✅ (`tagRoutes.js:26`) | Delete own tag (`tagController.ts:450-480`) | `deleteTagById` (`tagService.ts:90-98`) | |
| PUT | `/api/tags/:id` | ✅ (`tagRoutes.js:27`) | Update tag (`tagController.ts:523-594`) | `updateTagById` (`tagService.ts:100-108`) | |

### Autocomplete translations — `backend/routes/autocompleteTranslationRoutes.js` (service: `frontend/src/features/autocompletedTranslation/autocompletedTranslationService.ts`) — all 8 auth ✅, all return 200 with `{foundVerb|foundNoun|...}` wrappers; no DB access

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/autocompleteTranslations/english/verb/:infinitiveVerb` | ✅ (`autocompleteTranslationRoutes.js:8`) | English verb conjugations via `english-verbs-helper` (`autocompleteTranslationController.ts:167-208`) | `getEnglishVerbData` (`autocompletedTranslationService.ts:83-91`) | `{foundVerb, verbData}` |
| GET | `/api/autocompleteTranslations/spanish/verb/:infinitiveVerb` | ✅ (`:9`) | Spanish verb conjugations via `spanish-verbs` (`autocompleteTranslationController.ts:114-158`) | `getSpanishVerbData` (`autocompletedTranslationService.ts:43-51`) | `{foundVerb, verbData}` |
| GET | `/api/autocompleteTranslations/spanish/noun/:singularNominativeNoun` | ✅ (`:10`) | Spanish noun gender via `rosaenlg-gender-es` (`autocompleteTranslationController.ts:89-109`) | `getSpanishNounGender` (`autocompletedTranslationService.ts:53-61`) | `{foundNoun, possibleMatch?, nounData}`; gender is always guessed (TODO at `:91-94`) |
| GET | `/api/autocompleteTranslations/german/verb/:infinitiveVerb` | ✅ (`:13`) | German verb conjugations via `german-verbs` (`autocompleteTranslationController.ts:217-261`) | `getGermanVerbData` (`autocompletedTranslationService.ts:63-71`) | `{foundVerb, verbData}` |
| GET | `/api/autocompleteTranslations/german/noun/:singularNominativeNoun` | ✅ (`:14`) | German noun cases/gender via `german-words` (`autocompleteTranslationController.ts:266-289`) | `getGermanNounData` (`autocompletedTranslationService.ts:73-81`) | `{foundNoun, nounData}` |
| GET | `/api/autocompleteTranslations/estonian/verb/:infinitiveMaVerb` | ✅ (`:16`) | Proxies external Eesti API (`autocompleteTranslationController.ts:298-315`) | `getEstonianVerbData` (`autocompletedTranslationService.ts:30-41`) | Query param `searchInEnglish` (`:308-310`); response = raw external payload; unhandled rejection risk on API failure (`:314`) |
| GET | `/api/autocompleteTranslations/estonian/noun/:singularNominativeNoun` | ✅ (`:17`) | Proxies external Eesti API (`autocompleteTranslationController.ts:320-337`) | `getEstonianNounData` (`autocompletedTranslationService.ts:7-18`) | Same pattern |
| GET | `/api/autocompleteTranslations/estonian/adjective/:singularAdjective` | ✅ (`:18`) | Proxies external Eesti API (`autocompleteTranslationController.ts:342-359`) | `getEstonianAdjectiveData` (`autocompletedTranslationService.ts:20-28`) | Same pattern |

### Exercises — `backend/routes/exerciseRoutes.js` (services: `frontend/src/features/exercises/exerciseService.ts`, `exercisePerformance/exercisePerformanceService.ts`)

| METHOD | Path | Auth | Purpose | Frontend consumer | Notes |
|---|---|---|---|---|---|
| GET | `/api/exercises/getUserExercises` | ✅ (`exerciseRoutes.js:7`) | Generate exercises from parameters (`exerciseController.ts:683-796`) | `getUserExercises` (`exerciseService.ts:7-18`) | Query param `parameters` (JSON: `amountOfExercises`, `wordSelection`, `preSelectedWords`, `partsOfSpeech`, `languages`, `type`, `multiLang`, `nativeLanguage`, `difficultyMC`) |
| POST | `/api/exercises/saveTranslationPerformance` | ✅ (`exerciseRoutes.js:8`) | Persist translation-exercise result (`exercisePerformanceController.ts`) | `saveTranslationPerformance` (`exercisePerformanceService.ts:9-17`) | |
| POST | `/api/exercises/savePerformanceAction` | ✅ (`exerciseRoutes.js:9`) | Persist per-action events (skip/reveal/etc.) (`exercisePerformanceController.ts`) | `savePerformanceAction` (`exercisePerformanceService.ts:20-28`) | |

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

## Detailed request/response shapes (vertical-slice endpoints)

### Login — `POST /api/users/login`
- Request: `{ email, password }` (`userController.ts:182`).
- Success 200: `serializeLoginUser` (`userController.ts:64-75`): `{ _id, name, email, username, languages, uiLanguage, nativeLanguage (omitted when null), token (JWT, 30d), verified }`. Note: **no `password` field, but also no `createdAt`/`updatedAt`**.
- Failure 400 `{ message: "Invalid credentials" }` (`userController.ts:190-192`).
- FE behavior: on `response.data.verified` the *entire response* (including `token`) is persisted to `localStorage['user']` (`authService.ts:18-20`); unverified users are not persisted.

### Register — `POST /api/users`
- Request: `{ name, email, username, password }`; 400 "Please add all fields" if any missing (`userController.ts:117-123`).
- Case-insensitive uniqueness: 400 "Email already in use" / "Username already in use" (`userController.ts:125-137`).
- Defaults written (`userController.ts:144-156`): `languages: []`, `uiLanguage: "English"`, `nativeLanguage: null`, `verified: false`, `passwordTokens: []`, bcrypt-hashed password (cost 10, `:140-141`).
- Side effects: one-time 32-byte-hex token inserted into `tokens` table (`:160-166`), verification email to `${BASE_URL}/user/${id}/verify/${token}` (`:169-176`).
- Success 201: `publicUserResponse` (`userController.ts:105-114`): `{ _id, name, email, username, languages, uiLanguage, nativeLanguage, verified }` — **no token**.

### Verify — `GET /api/users/:id/verify/:token` (unguarded)
- Non-UUID id → treated as "no user match" (400 "Invalid Link (no user match)", `userController.ts:46-50,338-341`); 400 "Invalid Link (no token match)" if token row absent (`:351-353`).
- Success: sets `verified: true`, deletes the consumed token row (`:356-360`), returns 200 `{ user: { ...serializeUser(user), token } , message: "Email verified successfully" }` (`:362-371`) — `serializeUser` spreads the full user row plus `_id` (`:59-62`) and deletes `password` (`:367`), so this is the one response that carries profile fields **and** a token.
- FE: toasts `response.data.message`, stores `response.data.user` in `localStorage['user']` (`authService.ts:51-54`).

### Reset password — `POST /api/users/requestPasswordReset` + `PUT /api/users/updatePassword` (both unguarded)
- Request 1: `{ email }` (`userController.ts:379`). Unknown email → 400 "There is no user registered with the email given." (`:383-386`). Appends a 32-byte-hex token to `users.passwordTokens` (multiple outstanding links valid until update, `:388-395`), emails `${BASE_URL}/resetPassword/${id}/${token}` (`:399-406`). Success 200 `{}`.
- Request 2: `{ userId, password, token }` (`userController.ts:416`). Validation chain: 400 "Invalid format for UserId" (non-UUID, `:419-422`); 400 "Invalid Link (no user match)." (`:425-428`); 400 "Invalid token." if token not in `user.passwordTokens` (`:431-437`).
- Success: re-hashes password, **clears all** reset tokens (`:440-450`), 200 `{}`. FE: `updatePassword` (`authService.ts:58-61`) sends the body verbatim; response ignored beyond pass-through.

### Word create — `POST /api/words`
- Request body: `{ partOfSpeech, clue?, translations: [{ language, cases: [{ caseName, word }] }], tags?: [{ _id? | id? }] }`. 400 "Please add part of speech" (`wordController.ts:586-589`); 400 "Please add 2 or more translations" (`:590-593`).
- Flow: insert word (`userId = req.user.id`, `clue ?? null`, `:596-603`) → insert one `translations` row per language (`:606-613`) → insert `translation_cases` per case (`:615-633`) → insert `tag_words` links, tolerating `_id` or `id` keys and filtering falsy ids (`:636-645`).
- Response 200: single fully-assembled `WordResponse` (`wordController.ts:647-649`), shape per `wordService.ts:57-69`: `{ _id, id, user, partOfSpeech, translations: [{ _id, language, cases: [{ word, caseName }] }], clue, isCloned, originalCreator, tags: [tagRow], createdAt, updatedAt }`.

### Word get — `GET /api/words` and `GET /api/words/:id`
- `GET /api/words`: all words where `userId = req.user.id`, assembled via `fetchWordsWithRelations` (`wordController.ts:454-464`) → `WordResponse[]`. **Only own words** — followed-tag words are not included here (unlike `/simple`).
- `GET /api/words/:id`: any single word by ID with relations; 400 "Word not found" when missing (`wordController.ts:571-580`). No ownership check — an authed user can fetch another user's word by ID (known gap).

### Word update — `PUT /api/words/:id`
- URL id from `updatedData.id` (`wordService.ts:79`); body is the `WordDataBE` word plus `translations`, `tags`, optional `partOfSpeech`/`clue`/`user`.
- Guards: 400 "Word not found" (`wordController.ts:662-665`); 401 "User not found" (`:666-669`); 401 "User not authorized" if `word.userId !== req.user.id` (`:670-673`).
- Translations diff by language (`diffTranslations`, `wordController.ts:396-445`, applied `:675-821`): removed → delete user's `exercise_performances` for those translations then the translations (`:714-731`); kept → per-translation case diff (delete orphaned `exercise_performance_cases` then `translation_cases` `:734-769`, update case `word` in place `:771-778`, insert new cases `:780-788`); added → insert translations + cases (`:792-820`).
- Tags diff via `diffTagWords` (`:370-389`, applied `:823-841`): symmetric add/remove of `tag_words`.
- Word fields updated only if present: `user`→`userId`, `partOfSpeech`, `clue` (`:843-847`).
- Response 200: re-assembled `WordResponse` (`:858-859`).

### getWordsSimplified — `GET /api/words/simple`
- Query param `filters`: JSON string/array of `RawFilter { type, filterValue?, restrictiveArray? }` (`wordController.ts:262-266`, sent at `wordService.ts:32-34`); filters of the same `type` merged (`:273-303`). Supported types: `tag` (value = array of `{_id}` via `restrictiveArray`), `PoS` (array of POS strings), `gender` (array of gender words, matched against `translation_cases.word` where `caseName` ILIKE `gender%`, `:520-541`).
- Access scope: own words **OR** words of followed tags (`:488-494`). Multiple filter types are intersected; no filters = all accessible words (`:544-549`).
- Response 200 (`:561-565`): `{ amount: number, partsOfSpeechIncluded: string[], words: SimplifiedWord[] }`.
- `SimplifiedWord` (`simplifyWord`, `:339-360` + `getRequiredFieldsData`/`languageToFieldName` `:160-252`): `{ tags, partOfSpeech, createdAt, updatedAt, id, user, dataEN?/dataES?/dataDE?/dataEE? (per-language representative case), registeredCasesEE/EN/ES/DE? (case count per language), storedLanguages: string[] }`. Representative-case mapping: Adjective → `positiveEN`/`maleSingularES`-or-`neutralSingularES`/`positiveDE`/`algvorreEE`; Verb → `simplePresent1sEN`/`infinitiveNonFiniteSimpleES`/`infinitiveDE`/`infinitiveMaEE`; Noun handled by the `Noun`/default branches (`:167-237`). Missing cases throw (`:216-218,232-236`) → 500 via error handler.

### autocompleteTranslations — the 8 `GET /api/autocompleteTranslations/...` endpoints
- Common: all `protect`-guarded, no DB access; library-backed ones respond 200 even on miss with `{ foundVerb: false }` / `{ foundNoun: false }`.
- Verb/noun payload envelope: `{ language: 'Spanish'|'English'|'German', cases: [{ caseName, word }] }` nested under `verbData`/`nounData` (e.g. `autocompleteTranslationController.ts:118-153,271-284`).
- `caseName` vocabularies (reimplementation must keep these exact strings — they are stored verbatim as translation cases by the word form): Spanish verb `infinitiveNonFiniteSimpleES`, `participleNonFiniteSimpleES`, `indicative{Present,ImperfectPast,PerfectSimplePast,Future}{1s,2s,3s,1pl,2pl,3pl}ES` (`:121-151`); English verb `simple{Present,Past,Future,Conditional}{1s,2s,3s,1pl,3pl}EN` (`:179-201`); German verb `infinitiveDE`, `indicative{Present,Perfect,SimpleFuture,SimplePast}{1s..3pl}DE` (`:225-253`); German noun `genderDE`, `{singular,plural}{Nominativ,Akkusativ,Genitiv,Dativ}DE` (`:274-282`); Spanish noun `genderES` (with definite article), `singularES` (`:99-100`).
- Estonian trio is a pass-through proxy to `URL_EESTI_LANG_API/{term}[?lg=en]`; response = raw external JSON (`:308-314,330-336,352-358`). `searchInEnglish` query param (sent as `!!`-asserted string by FE, `autocompletedTranslationService.ts:12-14`).
- FE request convention: token in `Authorization: Bearer` config, path term interpolated unencoded (`autocompletedTranslationService.ts:16,26,39,49,59,69,79,89`).

### Minimal tag list — `GET /api/tags/getTags`
- Auth required. Resolves via `getTagDataByRequest({ query: { author: req.user.id } })` (`tagController.ts:227-233`).
- Filter behavior (`tagController.ts:93-138`): `author` must be a UUID or it throws ("Tag auxiliary function getTagDataByRequest failed", `:104-107`).
- Response 200: array of normalized tags (`normalizeTag`, `:29-34`) each with its words fully resolved through `tag_words` → `fetchWordsWithRelations` (`:123-137`): `{ id, _id, authorId, author, label, description, public, ...tagRow, words: WordResponse[] }`. **Not minimal in practice** — every tag carries all its assembled words; "minimal" only in the sense of "tags authored by me".
