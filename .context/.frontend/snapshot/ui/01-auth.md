# UI Spec 01 — Auth & public views

*Grounded in `snapshot/pages-auth-shell.md`. All pages: no header (route-config hides it), centered content, logo banner on top.*

---

## Login (`/login`)

```
        [Ladu logo banner]
   ┌──────────────────────────┐
   │  Email    [___________]  │
   │  Password [___________]  │
   │           [   Sign in  ] │
   │  Not registered? · Forgot password? │
   └──────────────────────────┘
```

- Single centered card (`max-w-sm`): email (format-validated, required), password (required).
- Submit: button + Enter key; disabled while submitting (inline spinner).
- Success → redirect `/`. Unverified account → warning toast "You need to verify your account" (fix: keep the user on Login, don't navigate). Error → error toast with message.
- Links: "Not registered?" → `/register`; "Forgot password?" → `/resetPassword`.

## Register (`/register`)

- Centered card: name, username, email (format), password, confirm password (must match — enforced client-side; `password2` is not sent to the API).
- Buttons: **Create account** (submit) + **Reset** (clears form). Loading disables both.
- Success → info toast "We sent an email to <email>. Please open it to verify your account." → redirect `/` (user is logged in but unverified; show a persistent "verify your email" banner in the shell until verified — improvement over the old silent state).
- Error → error toast (e.g. username/email taken).
- Link: "Already registered?" → `/login`.

## Email verification (`/user/:userId/verify/:tokenId`)

- Full-page status screen, no form. Three states driven by the request:
  1. **Validating**: spinner + "Validating your account…".
  2. **Success**: check icon + success message from the API + "Entering…" — auto-redirect to `/` after ~3s (clickable to skip).
  3. **Failure**: error icon + message + link to `/login`.
- Missing/invalid params → redirect to 404 with an error toast.

## Reset password (`/resetPassword/:userId?/:tokenId?`)

One route, two modes (mode = both params present):

- **Request mode** (no params): email field + "Send reset link". Success → success toast "Email sent" → redirect `/`.
- **Set mode** (both params): new password + confirm (must match) + "Update password". Success → success toast → redirect `/`.
- Mode-conditional yup schema (email required only in request mode; password/confirm only in set mode).
- Link: "Already registered?" → `/login`.

## 404 (`*`)

- Centered: "404 — page not found" heading, logo divider, playful cycling text (one line cycling through the 4 languages' "Nothing to see here…"), and a single link: "Go to dashboard" (logged in) or "Go to login" (not).
- No header (matches old behavior via route table).

## LoadingScreen (component)

- Full-width centered "Loading…" + indeterminate progress; used as Suspense fallback and full-page loader. Fixed ~50vh height, no interactivity.
