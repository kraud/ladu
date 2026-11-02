# Landing site and legal pages

## Summary

The public landing site (`ladu.com.ar`) is a static website. Besides the home page it holds the legal pages (Terms, Privacy Policy, Impressum, Credits for third-party data) and a Markdown blog that is built into static pages when the image is built. A new account gets a short note under "Create account" that links to the Terms and the Privacy Policy, and the server records when and which version was accepted. The licence study that backs these pages is `research/licence-study.md`.

Live spec. It replaces a finished plan (archive record: `.context/archive/2026-10-landing-and-legal.md`). Built 2026-10-06 (slices 1 to 5). Gate: `e2e/tests/phase-1-auth.spec.ts` checks that the registration note shows.

Code map: `landing/` (`index.html`, `privacy.html`, `terms.html`, `impressum.html`, `credits.html`, `style.css`, `app.js`, `Caddyfile`, `Dockerfile`, `blog/`, `scripts/` with the blog build library and CLI, its own `package.json`); app `frontend/src/features/auth/components/TermsNote.tsx`, `RegisterForm.tsx`, `OAuthSignupForm.tsx`; backend columns `users.terms_accepted_at` and `users.terms_version` (`lib/terms.ts` holds the version constant); build notices `frontend/third-party-notices.ts` and `admin/third-party-notices.ts`; repo files `LICENSE`.

## 1. Decisions (taken with the user on 2026-10-06)

| ID | Decision |
|---|---|
| Q1 | The operator is one private person in Germany, and the VPS is in Germany. GDPR applies. The Terms use German law and keep the mandatory consumer rights of the user's country. So the site has an Impressum page, and the Privacy Policy names the controller. |
| Q2 | The registration consent is a **note only, no checkbox**. A note is weaker proof than a checkbox, so the server stamps the time and the Terms version at account creation (email and Google sign-up). |
| Q3 | Existing users are ignored. The two columns are nullable, with no backfill. |
| Q4 | The age limit stays **13**. The Terms and the note add: "If you are under 16, you need your parent's or guardian's permission." |
| Q5 | CC BY-SA data (the Wiktionary-based lexicon) is accepted in a separate table with `source` and `licence` columns, credited on the credits page, with no lexicon download for users (option C, `research/licence-study.md`). Re-check before any paid tier. |
| Q6 | The blog is English only. The page chrome follows the chosen language. |
| Q7 | The contact address is `info@ladu.com.ar`. |
| Q8 | The repository is **public under MIT** (revised 2026-10-06; the first idea of a source-available licence was dropped). A root `LICENSE` file and `"license": "MIT"` in `frontend`, `admin` and `e2e`. The backend and admin images are private on GHCR, because the backend holds a GPL-licensed German word list. |
| Q9 | The Impressum and the Privacy Policy show "Kevin Raud, 04155 Leipzig, Germany" only. A full postal address is **not added** (user decision 2026-11-02: ignore for now). |

## 2. Contract

- **Rule:** the Privacy Policy is the single source of truth for data facts (90 days, 400 days, 30 days). The Terms state promises in short form and link to it. A blog post must not claim a data promise that is not in the Privacy Policy.
- **Legal pages are English only** (chrome translated). Put `lang="en"` on the `<article>`, because `app.js` sets `<html lang>` to the chosen UI language.
- **Every new landing page** copies the `<head>` of an existing page, including the inline script that sets `data-theme`. `landing/Dockerfile` lists files by name, so a new file needs a `COPY` line. There is no SPA fallback in the Caddyfile.
- **Footer:** `© Ladu`, Privacy, Terms, Credits, Blog; it wraps on a phone.
- **Registration note:** `TermsNote` under the submit button of `RegisterForm` step 2 and in `OAuthSignupForm`, with links to `ladu.com.ar/terms.html` and `/privacy.html` (the origin is read from config, not hard-coded; links open in a new tab). `terms_version` comes from one constant (the date of the Terms); keep the landing page and the backend in step.
- **Third-party notices:** a Vite plugin in `frontend/` and `admin/` writes the notices file into the build output. The build fails on a copyleft dependency that is not reviewed (it names `research/licence-study.md`).
- **Blog:** posts are Markdown files in `landing/blog/posts/YYYY-MM-DD-slug.md` with front matter (`title`, `date`, `summary`, `draft`). A Node build script (`landing/scripts`, with `marked` as the only runtime dependency and an own front-matter parser) writes `blog/index.html`, one page per post, a feed and `sitemap.xml` at image-build time. Two-stage `landing/Dockerfile`. No JavaScript runs in the visitor's browser for posts; no comments, share buttons or analytics. A `draft: true` post is skipped. The landing has no staging split, so a merged post is live on the next deploy. 22 `node:test` tests run in a CI job. Dependabot has an entry for `/landing`.
- **To publish a post:** create the `.md` file, preview with `npm run build && npx serve dist` in `landing/`, open a PR, merge.

## 3. Traps

- The English-only legal pages and the translated chrome need the `lang` fix above.
- A new page without the theme script flashes the wrong theme.
- The licence study must be re-run when dependencies change (`research/licence-study.md` §8).

## 4. Open items

Closed 2026-11-02 (confirmed by the user): the full postal address (ignored for now, Q9). Moved to `backlog/deferred-ideas.md`: the one-time lawyer check of the liability wording (I-3), which does not block anything. The `LAWYER-CHECK` marker in `landing/terms.html` stays until then.
