# Snapshot: Auth Shell, Routing & Header (pages-auth-shell)

Snapshot of frontend auth/routing shell for reimplementation planning. All evidence is `file:line` in `frontend/src` unless noted. Read 2026-09-05.

---

### Login (route: `/login`)
Purpose: email+password sign-in; stores verified session in `localStorage['user']` and redirects to dashboard.

Use cases:
1. User submits valid email+password → `dispatch(login({email, password}))` (Login.tsx:71-77). Payload type `UserLoginData {email, password}` (Login.tsx:20-23).
2. Thunk calls service `POST /api/users/login`; when `response.data.verified` the **whole response incl. token** is written to `localStorage['user']` (authService.ts:15-23). If not verified, toast "You need to verify your account" and the thunk returns undefined (authSlice.ts:44-59) — no localStorage write, but the reducer still sets `isSuccess=true` + `user=payload` (authSlice.ts:161-165).
3. On `isError` → toast the backend/error message (Login.tsx:61-63, message extracted at authSlice.ts:54-56).
4. On `isSuccess || user` → `navigate('/')` (Login.tsx:64-66); effect always ends with `dispatch(resetState())` (Login.tsx:67).
5. Pressing Enter in password field triggers submit via `triggerOnEnterKeyPress={() => handleSubmit(onSubmit)()}` (Login.tsx:154-156); submit button does the same (Login.tsx:182-190); both disabled while `isLoadingAuth`.
6. "Not registered?" text button → `navigate("/register")` (Login.tsx:196-210).
7. "Forgot password?" text button → `navigate("/resetPassword")` (Login.tsx:216-230).
8. Loading state renders `<LinearIndeterminate/>` spinner (Login.tsx:169).
9. Page renders shared `<getAppTitle/>` LaduLogo banner first (Login.tsx:81; component at Login.tsx:241-298).

Endpoints: `POST /api/users/login` — `authService.login` (authService.ts:16).

Guards/auth: none — page is reachable logged-in (no redirect check); a stale `user` in Redux triggers immediate redirect (Login.tsx:64). Known quirk: unverified login still sets `isSuccess` → navigates to `/` without a stored token.

Sequencing/effects: single post-thunk effect keyed on `[user, isError, isSuccess, message, navigate, dispatch]` (Login.tsx:60-68). Framer Motion route + child variants (Login.tsx:83-86, 97-100). Validation via react-hook-form + yupResolver: email required+format, password required (Login.tsx:39-45).

Reuse notes: form scaffolding (`TextInputFormWithHook` + yup schema + shared post-thunk effect) is a repeatable pattern across all 4 auth pages — extract a config-driven auth-form component. `getAppTitle` is shared verbatim by Register/ResetPassword (Register.tsx:17, ResetPassword.tsx:17).

---

### Register (route: `/register`)
Purpose: create account; backend sends verification email.

Use cases:
1. User fills name/email/username/password/confirm → `dispatch(register({name, username, email, password}))`; **`password2` is stripped before sending** (Register.tsx:78-85; interface `UserRegisterData` at Register.tsx:20-26).
2. Thunk `POST /api/users` (authService.ts:8-12); on success toast "We sent an email to <email>. Please open it, to verify your account." (authSlice.ts:29-41). **Response is NOT stored in localStorage.**
3. Reducer sets `isSuccess=true`, `user=action.payload` (authSlice.ts:147-151) → page effect sees `isSuccess || user` and navigates to `/` (Register.tsx:71-73). Known quirk: user lands on dashboard unverified and without a token in localStorage.
4. On error → toast message (Register.tsx:68-70).
5. "Reset" button clears the form via react-hook-form `reset()` (Register.tsx:234-242).
6. "Already registered?" → `navigate("/login")` (Register.tsx:249-261).
7. Enter key in confirm-password field submits (Register.tsx:199-201); submit/reset disabled while loading; spinner when `isLoadingAuth` (Register.tsx:210).
8. Username uniqueness is NOT validated client-side — inline TODO at Register.tsx:48.

Endpoints: `POST /api/users` — `authService.register` (authService.ts:9).

Guards/auth: none.

Sequencing/effects: identical post-thunk effect shape to Login (Register.tsx:67-75). Yup schema: name/email/username/password required, email format, `password2` must equal `password` (Register.tsx:43-52). Framer Motion variants same as Login (Register.tsx:91-93).

Reuse notes: same form-engine pattern; the `password2`-stripping + toast-on-success behavior must be ported deliberately.

---

### VerificationUser (route: `/user/:userId?/verify/:tokenId?`)
Purpose: email-link account verification; consumes the link's two params, persists verified user, auto-redirects.

Use cases:
1. On mount: if `userId` or `tokenId` missing → toast error `errors.linkError` and `navigate("/Error")` (which hits the catch-all NotFound, VerificationUser.tsx:44-51); else `dispatch(verifyUser({userId, tokenId}))` (VerificationUser.tsx:49). Params come from `useParams` typed by `RouteVerificationUserProps {userId, tokenId}` (VerificationUser.tsx:20-34).
2. Thunk `GET /api/users/:userId/verify/:tokenId`; service toasts `response.data.message` and, **if `response.data.user` exists, writes it to `localStorage['user']`** (authService.ts:47-56); reducer sets `user=payload`, `isSuccess=true` (authSlice.ts:195-199).
3. Success effect: when `(isSuccess && !isLoadingAuth) || user` → `executeRedirection()`: `waitDelay(3000)` then `navigate('/')` (VerificationUser.tsx:38-42, 53-56; `waitDelay` from generalUseFunctions, VerificationUser.tsx:16).
4. UI states driven purely by Redux flags: "validating" / "validatingSuccess" / "goingIn" headings and Pending/CheckCircle/Help icons from `isLoadingAuth`/`isSuccess` (VerificationUser.tsx:98-104, 120-125).
5. Clicking the status message redirects to `/` but only when `!isLoadingAuth && isSuccess` (VerificationUser.tsx:156-160).
6. Spinner shown when `!isLoadingAuth || isSuccess` (VerificationUser.tsx:129-141).

Endpoints: `GET /api/users/:userId/verify/:tokenId` — `authService.validateUser` (authService.ts:49).

Guards/auth: none (link-based).

Sequencing/effects: mount-only effect with empty deps `[]` (VerificationUser.tsx:44-51) + flag-driven redirect effect (VerificationUser.tsx:38-42). Note `executeRedirection` is called without await in the effect (fire-and-forget async).

Reuse notes: params-derived dual-mode page; localStorage write happens in the *service*, not the page — decide one layer for persistence in the port.

---

### ResetPassword (route: `/resetPassword/:userId?/:tokenId?`)
Purpose: dual-mode page — password-reset email request (no params) or set new password (both params present).

Use cases:
1. Mode switch: `isSettingNewPassword = userId !== undefined && tokenId !== undefined` (ResetPassword.tsx:52-54).
2. Request mode: user enters email → `dispatch(requestPasswordResetToken(email))` (ResetPassword.tsx:111-113); thunk → `POST /api/users/requestPasswordReset` with `{email}` (authService.ts:63-66). Email field visible only in this mode (`hidden={isSettingNewPassword}`, ResetPassword.tsx:173-190).
3. New-password mode: user enters password + confirm → `dispatch(updatePassword({userId, password, token: tokenId}))` (ResetPassword.tsx:103-110); thunk → `PUT /api/users/updatePassword` (authService.ts:58-61). Password/confirm fields hidden in request mode (ResetPassword.tsx:191-224).
4. Success effect (both modes): toast success — `passwordUpdated` vs `emailSent` message depending on mode — then `navigate("/")` (ResetPassword.tsx:87-94); effect always `dispatch(resetState())` (ResetPassword.tsx:95).
5. On error → toast message (ResetPassword.tsx:84-86).
6. "Already registered?" → `navigate("/login")` (ResetPassword.tsx:262-276).
7. Enter key submits in all three fields (ResetPassword.tsx:186-188, 203-205, 220-222); spinner while loading (ResetPassword.tsx:234).
8. Yup schema is mode-conditional: email required only when not setting new password; password/confirm required + match only when setting (ResetPassword.tsx:58-71; hardcoded English mismatch message "Passwords don't match" at :68).

Endpoints: `POST /api/users/requestPasswordReset` — `authService.requestPasswordResetToken` (authService.ts:64); `PUT /api/users/updatePassword` — `authService.updatePassword` (authService.ts:59).

Guards/auth: none.

Sequencing/effects: one flag-driven effect keyed `[isSettingNewPassword, isError, isSuccess, message, navigate, dispatch]` (ResetPassword.tsx:83-96). Shared `getAppTitle` banner (ResetPassword.tsx:118).

Reuse notes: canonical "one route, two forms" pattern — port as a mode derived from route params with per-mode validation schema; payload keys `{userId, password, token}` (token = tokenId from URL) are a contract to preserve.

---

### NotFound (route: `*` catch-all)
Purpose: 404 page; also drives header hiding via callback to MainView.

Use cases:
1. Render-time callback: `props.onHideHeader((user)!!)` is invoked **during render** (NotFound.tsx:27) — sets `displayToolbar` in MainView to whether a user exists in Redux. This is a render-phase parent state update (React anti-pattern, works because it happens on every render of the route).
2. Clicking the link text → `navigate('/')` (NotFound.tsx:29-31; click handler at NotFound.tsx:127-131).
3. Link label depends on auth state: logged-in shows `goToDashboard`, otherwise `goToLogin` (NotFound.tsx:139-142).
4. Static content: "404: not found" heading (NotFound.tsx:53-63), LaduLogo divider (NotFound.tsx:84-90), `SpinningText` cycling 4 hardcoded translations EN/ES/DE/EE "Nothing to see here..." (NotFound.tsx:102-108), responsive text variant from two media queries (NotFound.tsx:23-24, 109-115).

Endpoints: none.

Guards/auth: none.

Sequencing/effects: no effects; the only side channel is the render-time `onHideHeader` callback. Framer Motion route variants (NotFound.tsx:35-38).

Reuse notes: the callback-to-parent header toggling should be replaced by route-based header visibility in the reimplementation (MainView already has the regex table, see MainView below — NotFound's callback is a second, redundant mechanism).

---

### LoadingScreen (component, no route)
Purpose: static full-width "Loading..." + indeterminate linear progress placeholder.

Use cases: none interactive — pure presentational (LoadingScreen.tsx:8-56); fixed `height: '50vh'` column layout (LoadingScreen.tsx:17-19).

Endpoints: none. Guards/auth: none. Sequencing/effects: none.

Reuse notes: trivially portable; not referenced by any of the 11 target files (used elsewhere in app).

---

### management/MainView (root layout component)
Purpose: app shell — conditionally renders Header, hosts animated route outlet, JWT-expiry watcher, UI-language sync, notification polling.

Use cases:
1. Header visibility: on every `location` change, pathname is tested against `urlListNoToolbar` regexes — `^/login$`, `^/register$`, `^/user/.*/verify/.*$`, `^/resetPassword.*$` — hide header, otherwise show (MainView.tsx:30-35, 48-56). Render: `{(displayToolbar) && <ResponsiveAppBar/>}` (MainView.tsx:79-82).
2. NotFound override: `onRenderNotFoundHideHeader` callback (wired through RoutesWithAnimation, MainView.tsx:92) sets `displayToolbar = userExist` (MainView.tsx:63-65) — see NotFound above.
3. UI-language sync: effect on `currentUILanguage` (= `user.uiLanguage` or undefined, MainView.tsx:37) calls `i18n.changeLanguage(getLangKeyByLabel(currentUILanguage).toLowerCase())` when both lookups succeed (MainView.tsx:41-46). Comment notes this lives here (not authSlice) due to i18n import issues (MainView.tsx:39-40).
4. Notification polling: `useIntervalFunction(callback, 1000 * 90, true)` (MainView.tsx:67-75) — **actual interval is 90 000 ms (90 s); inline comment wrongly says "every 60 seconds"** (MainView.tsx:73). `runCallbackOnStart=true` fires immediately on mount (useInterval.tsx:19-22), then every 90 s via `setInterval` (useInterval.tsx:22-24). Callback: if `JSON.parse(localStorage.getItem("user")!)` is truthy → `dispatch(getNotifications())` (MainView.tsx:68-72).
5. JWT expiry: renders `<AuthVerify onLogOut={() => onLogOut()} key={'verify'}/>` (MainView.tsx:94-98); `onLogOut` = `dispatch(logout())` + toast "Your credentials have expired. Please login again." (MainView.tsx:58-61).
6. Content column renders `<LocationProvider><RoutesWithAnimation …/></LocationProvider>` with bottom margin spacing (MainView.tsx:83-100).

Endpoints: `GET /api/notifications/getNotifications` — `notificationService.getNotifications(token)`, Bearer header (notificationService.ts:17-25); thunk pulls token from `state.auth.user.token` (notificationSlice.ts:26-31). `logout()` itself is localStorage-only (authService.ts:43-45).

Guards/auth: none of its own; delegates to AuthVerify.

Sequencing/effects: three effects — language sync `[currentUILanguage]` (MainView.tsx:41-46), toolbar `[location]` (MainView.tsx:48-56), and the interval hook (MainView.tsx:67-75). Polling result feeds Header badge (`state.notifications`, Header.tsx:64).

Reuse notes: regex → route-config table is portable as-is; fix the 60s comment vs 90s reality; consider replacing the polling guard's raw localStorage parse with the Redux user.

---

### management/RoutesWithAnimation (route table)
Purpose: single `<Routes>` definition with Framer Motion keyed transitions.

Use cases (routes, RoutesWithAnimation.tsx:54-138):
1. `/` → `Dashboard` (:55-60)
2. `/addWord/:partOfSpeech?` → `AddWord` (:61-66)
3. `/review/:filtersURL?` → `Review` (:67-72)
4. `/login` → `Login` (:73-78)
5. `/register` → `Register` (:79-84)
6. `/practice` → `Practice` (:85-90)
7. `/resetPassword/:userId?/:tokenId?` → `ResetPassword` (:91-96)
8. `/user/:userId?/notifications` → `NotificationHub` (TODO comment about param order, :97-103)
9. `/user` → `Account` (:104-109)
10. `/user/:userId?/verify/:tokenId?` → `VerificationUser` (:110-115)
11. `/word/:wordId?` → `DisplayWord` (:116-121)
12. `/tag/:tagId?` → `DisplayTag` — **env-gated**: route only exists when `checkEnvironmentAndIterationToDisplay(2)` (:122-129)
13. `*` → `NotFound` with `onHideHeader` → `props.onRenderNotFound` (:130-137)

Endpoints: none. Guards/auth: none — no route guards at all; expiry handled globally by AuthVerify.

Sequencing/effects: `<Routes location={location} key={location.key}>` forces remount per navigation (RoutesWithAnimation.tsx:51-54). Exported animation variants: `routeVariantsAnimation` slides from `y: '100vh'` (RoutesWithAnimation.tsx:18-29), `childVariantsAnimation` fade+rise `y: 50px` (RoutesWithAnimation.tsx:30-43) — consumed by every page via `variants/initial/animate` props.

Reuse notes: all pages share the same two variant objects and the same `<motion.div variants … initial="initial" animate="final">` boilerplate — port as a layout wrapper. Optional params (`:id?`) mean all "detail" routes double as create modes.

---

### management/LocationProvider (component)
Purpose: wraps the outlet in `<AnimatePresence>` so route-exit animations run (LocationProvider.tsx:5-7). No props, no logic (`@ts-ignore` on untyped `children`, :4).

Endpoints: none. Guards/auth: none. Sequencing/effects: none beyond AnimatePresence. Reuse notes: 3-line component; port verbatim or inline.

---

### common/AuthVerify (component)
Purpose: global JWT-expiry watcher; logs out on route change when token expired.

Use cases:
1. On every `location` change (and every `props` change — MainView passes a fresh inline arrow each render, so effectively every render): reads `localStorage['user']`, parses `user.token` with `parseJwt` (`window.atob(token.split(".")[1])`), and if `decodedJwt.exp * 1000 < Date.now()` calls `props.onLogOut()` (AuthVerify.tsx:19-29).
2. `onLogOut` (MainView.tsx:58-61) dispatches `logout()` → `localStorage.removeItem('user')` (authService.ts:43-45) + expiry toast.
3. Renders nothing (`<></>`, AuthVerify.tsx:31).

Endpoints: none.

Guards/auth: this IS the only auth guard in the app. Known fragilities: `parseJwt` returns `null` on atob failure (AuthVerify.tsx:4-10) but the caller then dereferences `decodedJwt.exp` → TypeError on malformed tokens (AuthVerify.tsx:23-27); no base64url handling; expiry only checked on navigation/render, not on a timer.

Sequencing/effects: single effect `[location, props]` (AuthVerify.tsx:29).

Reuse notes: `localStorage['user']` shape = the **whole login response incl. token** (authService.ts:18-20; also overwritten with `{...response.data, token}` after profile updates, authService.ts:34-37; set to `response.data.user` after email verification, authService.ts:52-54). Port should define one typed session object and one expiry-check seam (timer + navigation hook).

---

### components/Header (ResponsiveAppBar; rendered by MainView when visible)
Purpose: top navigation — page menu, search (words/tags), UI-language selector, user menu with unread-notification badge.

Use cases:
1. Nav menu (mobile hamburger + desktop buttons) offers addWord/practice/review; active page gets text-shadow via pathname match (Header.tsx:44-48, 99-113, 328-343).
2. addWord/review clicks require `user.languages.length > 1`, else toast-with-button "Click here to go to Account" navigating `/user` (Header.tsx:117-141).
3. practice click first dispatches `resetWordsSelectedForExercises()` then navigates `/practice` (Header.tsx:142-146).
4. User menu: logout → `dispatch(logout())` + `dispatch(resetState())` + `navigate('/login')` (Header.tsx:169-174); dashboard → `/` (:175-178); account → `/user` (:179-182); notifications → **env-gated** `checkEnvironmentAndIterationToDisplay(3)`, then `navigate('/user/'+user._id+'/notifications')`, else "not implemented" toast (Header.tsx:183-190). Note double `toast.error(toast.error(...))` bug at :187.
5. UI-language menu (EN/ES/DE/EE, Header.tsx:55-60): selecting a language dispatches `updateUser({...user, uiLanguage: option})` (Header.tsx:156-164) → `PUT /api/users/updateUser` with Bearer token from Redux (authService.ts:26-40; token sourced at authSlice.ts:62-66), which **rewrites `localStorage['user']`** as `{...response.data, token}` (authService.ts:34-37); reducer merges new payload under old token (authSlice.ts:175-182). MainView's language effect then applies `i18n.changeLanguage` (MainView.tsx:41-46). Language button shows current key via `getLangKeyByLabel(user?.uiLanguage)` or spinner while `isLoadingAuth` (Header.tsx:407-417).
6. Search (desktop only, **env-gated** `checkEnvironmentAndIterationToDisplay(2)`, Header.tsx:344-394): `MaterialUISwitch` toggles `isWordSearch` word↔tag mode (:365-374); `AutocompleteSearch` options are `searchResults` or `searchResultTags` with mode-specific placeholder (:377-392); typing dispatches `searchWordByAnyTranslation(value)` or `searchTagsByLabel({query, includeOtherUsersTags: true})` (:208-217); selecting navigates `/word/:id` or `/tag/:id` (tag mode also dispatches `clearSearchResultTags()`) (:219-227).
7. Notification badge: avatar wrapped in `<Badge>` whose `badgeContent`/`invisible` derive from `notifications.filter(n => !n.dismissed).length` (Header.tsx:200-206, 425-443) — data supplied by MainView's 90 s polling.
8. Logo (large desktop + small mobile variants) navigates `/` on click (Header.tsx:242-253, 310-324).
9. Avatar shows initials via `stringAvatar(user.name)`, `"-"` when no user (Header.tsx:438-443).

Endpoints: `PUT /api/users/updateUser` — `authService.updateUser` (authService.ts:32) via `updateUser` thunk (authSlice.ts:62-77); `searchWordByAnyTranslation` (wordSlice, Header.tsx:20); `searchTagsByLabel` (tagSlice, Header.tsx:26); `resetWordsSelectedForExercises` (exerciseSlice, Header.tsx:32); `clearSearchResultTags` (Header.tsx:26).

Guards/auth: none of its own; rendered only per MainView's toolbar rules.

Sequencing/effects: no `useEffect` — all state is menu anchors (`anchorElNav/User/Language`, Header.tsx:85-87) + `isWordSearch` (:66); menus closed by passing `null`/`""` to the close handlers (:152, 163, 197, 288, 487-489). Selecting a menu item compares against **translated** labels (`t('header…')`) — string-compare dispatch is locale-coupled (Header.tsx:115-198).

Reuse notes: replace translated-string menu dispatch with stable ids; keep the badge/unread computation (count of non-dismissed) and the languages>1 gates as business rules; search mode switch + env gate are config-driven-feature-flag candidates.

---

### Cross-cutting: env gate
`checkEnvironmentAndIterationToDisplay(displayFromIterationNumber)` = `REACT_APP_ENVIRONMENT_NAME === 'dev' || displayFromIterationNumber <= parseInt(REACT_APP_ITERATION)` (commonFunctions.ts:61-69). Used in this slice at RoutesWithAnimation.tsx:122 (`/tag` route, iteration 2), Header.tsx:184 (notifications menu, iteration 3), Header.tsx:344 (search box, iteration 2). Any reimplementation needs an equivalent build-time feature-flag mechanism.
