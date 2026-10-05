# Landing: Terms, licence study, Blog

Planned 2026-10-04. **No code was written.** This file is the plan for later, after the `sidebar-layout` branch is merged.

Three items:

1. A **Terms and Conditions** page on the landing site, and a consent step in the app's registration form.
2. A **licence study** of our dependencies: can we publish Ladu online, and what changes if we add a paid tier?
3. A **Blog** on the landing site. Posts are Markdown files in the repo. No editor.

This plan is not legal advice. Items marked **VERIFY** need a check before we rely on them.

---

## 0. What `landing/` is today

| Fact | Detail |
|---|---|
| Type | Plain static site. No build step. Not an npm workspace. |
| Files | `index.html`, `privacy.html`, `style.css`, `app.js`, `favicon.svg`, `brand/`, `flags/` |
| Server | Caddy (`landing/Caddyfile`): `file_server` and gzip. No SPA fallback. |
| Image | `landing/Dockerfile` copies a fixed list of files into `/srv`. A new page needs a new `COPY` line. |
| CI and deploy | CI builds and Trivy-scans `landing/Dockerfile` with `landing/` as context. The deploy pipeline builds the image on each commit (`deploy/compose/platform.yml`). |
| i18n | `app.js` holds a `STRINGS` table (en, es, de, ee). Elements use `data-i18n` / `data-i18n-attr`. |
| Legal pages | `privacy.html` is English only. Only the page chrome (header, footer) follows the chosen language. `main.legal` and `.prose` styles in `style.css` already say "(privacy, terms)". |
| Theme | An inline script in each `<head>` sets `data-theme`. Every new page must copy it. |
| Footer | `© Ladu` and a Privacy link. |

Known problem to fix in this work: `app.js` sets `<html lang>` to the chosen UI language. On an English-only page (privacy, terms, blog posts) this is wrong. Put `lang="en"` on the `<article>` and keep the page chrome translated.

---

## 1. Terms and Conditions

### 1.1 Rule

The privacy policy stays the **single source of truth for data facts**. The Terms state the promises in short form and link to the privacy page for the details. This way the numbers (90 days, 400 days, 30 days) exist in one place only.

### 1.2 Draft outline (`landing/terms.html`)

1. **Who we are, and acceptance.** One developer runs Ladu. Using Ladu means you accept these Terms and the Privacy Policy.
2. **Who can use Ladu.** Not directed at children under 13. You must not create an account if you are under 13. One person, one account. True information at sign-up.
3. **Your account.** Keep your password safe. You are responsible for what happens under your account.
4. **Your content.** Your words and translations stay yours. You give Ladu the right to store and show them to you, and to run your exercises. Nothing more.
5. **Acceptable use.** No attacks on the service, no automated scraping, no abuse of other users, no illegal content.
6. **What we promise.** Same promises as the Privacy Policy, in short form:
   - We do not sell or rent your data.
   - We do not run advertising.
   - We do not use tracking cookies or third-party analytics to profile you.
   - You can ask us to delete your account at any time. A deleted account can be restored for 30 days.
   - Staff can open a support tool only to help you. Every staff action is logged.
7. **Free service, no warranty.** Ladu is free today and is provided "as is". It can change, or stop. If we add paid features, we will change these Terms and tell you first.
8. **Third-party data and software.** Some word data and software come from open-source projects. See the credits page (section 3.6).
9. **Suspension and deletion.** We can suspend an account that breaks these Terms. You can delete yours at any time.
10. **Limit of liability.** Standard wording. **VERIFY** with a lawyer.
11. **Changes to the Terms.** The date at the top changes. For a material change, we show a notice in the app.
12. **Governing law.** Open question Q1.
13. **Contact.** Same address as the privacy page.

Add a "Last updated" date. Use the same value as the **terms version** sent by the app (section 2).

### 1.3 Landing changes

| File | Change |
|---|---|
| `landing/terms.html` | New page. Copy the `<head>` and header of `privacy.html`. Use `main.legal` and `.prose`. |
| `landing/privacy.html` | Add a link to the Terms. Check that every promise in the Terms is true in the Privacy Policy. |
| `landing/index.html`, `privacy.html` | Footer: `© Ladu`, Privacy, Terms, (later) Blog, Credits. |
| `landing/app.js` | New `STRINGS` keys in 4 languages: `terms`, `blog`, `credits`. |
| `landing/Dockerfile` | Add the new files to `COPY`. |
| `landing/style.css` | Footer: allow 4 links and wrap on a phone. |

### 1.4 Check

Build the image, open `/terms.html` in light and dark theme, switch language, check the footer links on a phone width. Use `deploy/compose/docker-compose.local.yml` (it has a `landing` service).

---

## 2. Terms consent in the app registration form

### 2.1 Decision (recommended)

Use a **required checkbox**, not only a note. A checkbox is stronger proof that the user agreed. Text: "I accept the Terms and the Privacy Policy" with two links. Q2 asks the user to confirm.

### 2.2 Where

| Place | Change |
|---|---|
| `RegisterForm.tsx` step 2 | Checkbox above the "Create account" button. The button stays disabled until it is checked. |
| `OAuthSignupForm.tsx` | Same checkbox. Google sign-up creates an account too. |
| Login screen | Only a short note near the Google button is needed for users who already have an account. No checkbox. |
| `schemas.ts` | New field `acceptedTerms` (must be `true`) in the register and OAuth-signup schemas. |
| `loginRegister` locale (de, ee, en, es) | New keys: label, link texts, error text. |
| Links | They point to the landing site (`ladu.com.ar/terms.html`, `/privacy.html`). Read the landing origin from config, not hardcoded. Open in a new tab (`rel="noopener"`). |

### 2.3 Backend

- Store proof of consent: new columns on `users`: `terms_accepted_at` (timestamp) and `terms_version` (text). Drizzle migration through `npm run db:generate`.
- `POST /api/users` and the OAuth signup endpoint require `acceptedTerms: true`, and write both columns. Return a clear error if it is missing.
- `terms_version` comes from one constant (the date of the Terms). Keep the same value in the landing page and the backend. Add a comment in both places.
- Existing users: Q3.

### 2.4 Tests (same slice, not later)

- Unit: schema rejects without the checkbox. Form test: button disabled until checked.
- Backend: register without `acceptedTerms` returns 400. With it, the columns are filled.
- e2e: `phase-1-auth` and any spec or fixture that registers a user must tick the box. Search `e2e/` for the register helper. **The phase gate is a green Playwright run.** Run specs one at a time (see `sidebar-layout.md` notes).
- Known: the `oauth-2` to `oauth-5` specs already fail at the Google stub. They are not caused by this work. Do not count them against this slice.

### 2.5 Age note (Q4)

The privacy page says "under 13". In the EU, the age at which a person can consent to data processing is set per country. It is 16 in Germany, 14 in Spain, 13 in Estonia (**VERIFY**). Ladu targets DE, ES and EE users. Ask a lawyer whether "13" is safe, or whether the Terms should say "16" (or "13, or the age set by your country").

---

## 3. Licence study (research step, no code)

### 3.1 Goal

Know that we can publish Ladu online now (free) and keep the option of a paid tier later. This section holds the **first results**. Section 3.7 lists the work left.

### 3.2 Method used

- Read every `package.json` (root, backend, frontend, admin, e2e).
- Counted the licence field of every entry in `package-lock.json` (about 1,450 entries).
- Read the licence file of each language package in `node_modules`.
- Read `.context/plans/autocomplete-data-source-strategy.md` §2 and §8 (licence notes by earlier work).
- Web checks for the licences that were not clear.

### 3.3 Result: npm packages

| Licence | Count | Meaning for us |
|---|---|---|
| MIT, ISC, BSD-2/3, Apache-2.0, 0BSD, BlueOak, Unlicense, MIT-0, CC0, Python-2.0 and dual MIT/CC0 | ~1,430 | Permissive. Commercial use is allowed. Some need the copyright notice kept (see 3.5). |
| MPL-2.0 | 12 (all `lightningcss*`, dev only, comes with Tailwind) | Weak, file-level copyleft. Applies only if we change Lightning CSS source files. It does not change the licence of the CSS it produces. |
| CC-BY-4.0 | 1 (`caniuse-lite`, dev only) | Browser-data used by build tools. Not shipped to users. |
| "UNKNOWN" | 3 | Our own workspaces (`frontend`, `admin`, `e2e`) have no `license` field. See 3.4 item 1. |

**There is no GPL, AGPL or LGPL package in the npm tree.** That is the main result.

### 3.4 Items that need a decision or action

1. **Our own licence field.** Root and `backend` say `"license": "MIT"`. While the repo is private this has no effect. If the repo becomes public, MIT would let anyone use Ladu commercially. If you want a paid tier with closed code, change it to `"UNLICENSED"` (or your choice) in all `package.json` files. Add the missing field to `frontend`, `admin`, `e2e`.
2. **German word data (CC BY-SA 4.0).** `german-verbs-dict` and `german-words-dict` are labelled Apache-2.0 on npm. Their data comes from LanguageTool's `german-pos-dict`, which is CC BY-SA 4.0 (the licence allows commercial use). Duties: credit the source, and share-alike for "adapted" data. We use the data on the server and return word forms through the API. Whether that is "adapted material that we share" is a legal question (this is Q5, the same as §8 of the autocomplete plan). Risk is low. A credit line is needed in any case.
3. **`is-word` word lists.** The npm code is ISC. The word lists in `node_modules/is-word/dictionary/` have no stated source or licence. The German list (`ngerman`) matches the `igerman98` project, which is GPL v2 or v3 (search result: Debian copyright files). The other lists are probably from similar spell-check projects. **VERIFY the source of each list we use** (en, es, de). The backend runs on our server and is not given to users, so the GPL duty to share source is not triggered. It would be triggered if we ever give the backend to anyone. Best fix: replace `is-word` with the planned lexicon (autocomplete plan, slice work) built from a source with a clear licence.
4. **`api.sonapi.ee`.** A community service, not run by the Institute of the Estonian Language (EKI). The data (EKI / Ekilex) is CC BY 4.0, which allows commercial use with credit. The risk is the service itself: no key, no stated terms, no promise it stays online. Option: use the official Ekilex API with a free key (**VERIFY** its terms for commercial use). Credit "Sõnaveeb / EKI" on the credits page.
5. **`spanish-verbs`.** Marked Apache-2.0. The plan says it is a fork of HealthTap's `conjugator`. **VERIFY** the upstream licence file.
6. **`colors` 1.4.0.** MIT. Keep it pinned at 1.4.0 (a later version of this package was sabotaged by its author in 2022). Check whether it is still used. If not, remove it.
7. **Terraform.** Used in `deploy/terraform`. Since 2023, Terraform is under the Business Source Licence. Using it for our own infrastructure is allowed. The limit is on products that compete with HashiCorp. No action. Mention in the study. **VERIFY** the current licence of the version we use.

### 3.5 Duties that apply even to free use

- **Notices.** MIT, BSD, ISC and Apache-2.0 require us to keep the copyright and licence text when we give the software to others. The frontend JavaScript goes to every visitor's browser, so this counts. Vite removes comments from the bundle. **Plan:** generate a `THIRD-PARTY-NOTICES.txt` at build time and serve it from the app (and link it from the credits page).
- **Apache-2.0 NOTICE files.** The RosaeNLG packages are server-side only. Keep their `LICENSE` and `NOTICE` in the notices file anyway.
- **Credit lines for data.** CC BY and CC BY-SA need a visible credit: German (LanguageTool german-pos-dict, via RosaeNLG), Estonian (EKI / Sõnaveeb), and any Wiktionary-based data if we add it.
- **Icons.** `@phosphor-icons/react` is MIT. The landing page copies some SVG paths that look like Phosphor icons (moon, sun, check). **VERIFY** and add the Phosphor notice.
- **Flags** (`landing/flags/*.svg`). Source not stated. **VERIFY** where they came from. Most country flags are public domain, but the file author's licence counts.
- **Brand files and fonts.** Brand SVGs are ours. We use system fonts only, so there is no font licence.

### 3.6 Credits page

Add `landing/credits.html` ("Credits and licences"): data sources with their licences and links, a link to the generated notices file, and a short line on open-source use. Link it from the footer and from the Terms (§8).

### 3.7 External services (outside npm)

These have their own terms. None is a code licence. Check the **commercial-use** line of each, because that is what changes with a paid tier.

| Service | Use | What to check |
|---|---|---|
| Google Sign-In | OAuth login | "Google API Services User Data Policy", button branding rules, consent-screen verification for production, a public privacy link (we have one). |
| Sentry | Error reports | Plan limits and terms for a commercial product. Data-processing terms. |
| Resend (through SMTP) | Account emails | Plan limits. Sending-domain rules. |
| Cloudflare | DNS, proxy | Free-plan terms. |
| UptimeRobot | Monitors (phase E-c) | **VERIFY** whether the free plan allows commercial use. I believe the free plan was limited to non-commercial use in late 2024. |
| GitHub / GHCR | Code, images | Free-tier terms. |
| Hosting provider (VPS) | Server | Acceptable-use policy. |
| Tools: Ansible (GPL-3), Caddy (Apache-2.0), PostgreSQL (PostgreSQL licence), Playwright (Apache-2.0), Trivy (Apache-2.0) | Tooling and runtime | Using a GPL tool does not make our own code GPL. No action. |

### 3.8 What changes if we add a paid tier

- **npm permissive packages:** nothing changes.
- **CC BY-SA data:** the share-alike question (Q5) matters more once we sell access. Decide before the paid tier, or use data with a CC0 / CC BY licence only.
- **Service plans:** upgrade any free plan that bans commercial use.
- **Terms:** add price, renewal, refunds, and the consumer withdrawal right (EU). Privacy: add the payment provider as a recipient.
- **Taxes and company form:** outside this study. Ask an accountant.

### 3.9 Deliverables and work left

1. **Done in this plan:** first results (3.3 to 3.7).
2. **To do (research only):** open the items marked **VERIFY**. Check the source and licence of the `is-word` lists, `spanish-verbs`, the flags and the icons. Read the commercial-use terms of each service in 3.7.
3. **To do (tool):** run a licence report (for example `npx license-checker --production --summary`) in each workspace, and keep the result with the study. Re-run it in CI later to catch a new copyleft package.
4. **Output:** a final study file `.context/licence-study.md` (table per dependency: licence, use, duty, risk) and a short "can we publish?" answer at the top.
5. **Lawyer questions:** Q4 and Q5, plus the liability and governing-law text of the Terms.

---

## 4. Blog

### 4.1 Decision (recommended): build step, not browser rendering

Posts are Markdown files in the repo. A small Node script turns them into **static HTML pages at image-build time**. Reasons:

- The page works without JavaScript and is easy for search engines to read.
- No third-party script runs in the visitor's browser. This keeps the privacy promise (no tracking, no third-party code).
- The runtime stays the same: Caddy serving files.

Rejected: fetching a `posts.json` and rendering Markdown in the browser. It needs JavaScript, hides content from search engines, and ships a Markdown library to every visitor.

### 4.2 Post format

`landing/blog/posts/2026-10-15-first-post.md`:

```md
---
title: Ladu is open for early users
date: 2026-10-15
summary: One short sentence for the list page and the feed.
draft: false
---

Body in Markdown.
```

- The file name gives the slug (`first-post`). The `date` field gives the order (newest first).
- `draft: true` posts are skipped by the build.
- Images go in `landing/blog/images/` and are copied as they are.
- Posts are English only, like the legal pages. The page chrome follows the chosen language. (Q6)

### 4.3 Pieces

| Piece | Detail |
|---|---|
| `landing/package.json` | New, **outside** the root workspaces. Own `package-lock.json`. One runtime dependency: `marked` (MIT). Parse the front matter with a small own function, so we do not add `gray-matter`. Add the new packages to the licence study. |
| `landing/scripts/build-blog.mjs` | Reads `blog/posts/*.md`. Writes `blog/index.html`, one page per post, `blog/feed.xml` (RSS/Atom) and `sitemap.xml`. Uses one HTML template with the same `<head>` (theme script), header and footer as the other pages. Escapes the title and summary. Fails the build on a bad date or a missing title. |
| Output folder | `landing/dist/` (not committed). Add it and `node_modules` to `.gitignore` and `landing/.dockerignore`. |
| `landing/Dockerfile` | Two stages. Stage 1: `node:24-alpine` runs `npm ci` and the build script. Stage 2: `caddy:alpine` copies the static files and `dist/blog`. The fixed `COPY` list gets the new files. |
| `landing/Caddyfile` | Probably no change: `file_server` serves `blog/index.html` for `/blog/`. Post URL: `/blog/<slug>.html`, the same style as `privacy.html`. **VERIFY** that `/blog` (no slash) redirects. |
| `landing/style.css` | New classes: post list, post meta (date), code block, image inside `.prose`. Reuse the tokens. |
| `landing/app.js` | `STRINGS` keys for "Blog", "Back to the blog", "Published on". Header: add a Blog link. |
| Tests | A small `node:test` file for the parser and the build (slug, order, draft, bad date). Run it in CI before the image build. |
| Docs | `landing/README.md`, or a section in `.context/README.md`: "How to publish a post" (create file, open a PR, merge, deploy). |

### 4.4 Workflow for a new post

1. Create the `.md` file in `landing/blog/posts/`.
2. Preview: `npm run build && npx serve dist` inside `landing/` (or the local compose).
3. Open a PR. Merge. The deploy pipeline builds the new landing image.

### 4.5 Notes

- The date format on the page is fixed at build time (English). Localised dates are a later option.
- No comments, no share buttons, no analytics. All would need a privacy-policy change.
- A post must not claim a data promise that is not in the Privacy Policy.
- Landing has no staging split (see `deploy/ansible/roles/platform/defaults/main.yml`), so a merged post is live on the next deploy. Use `draft: true` while writing.

---

## 5. Slices and order

Small vertical slices. Each one ends with something runnable and its docs.

| # | Slice | Why this order | Ends with |
|---|---|---|---|
| 1 | **Licence study, finish and write up** (section 3.9) | No code. It can change what the Terms and the credits say. | `.context/licence-study.md` |
| 2 | **Landing: Terms page, credits page, footer, i18n keys, `lang` fix** (1, 3.6) | Static work. Needs the study for the credits. | Image builds. Pages checked in 4 languages and 2 themes. |
| 3 | **Third-party notices file** in the frontend build (3.5) | Legal duty for the shipped JavaScript. | Build output contains the notices file. |
| 4 | **App: consent checkbox, schema, backend columns, migration, tests** (2) | Needs the final Terms text and version. | Green unit tests and green `phase-1-auth` e2e (one spec at a time). |
| 5 | **Landing: Blog** (4) | Independent of the rest. | Image builds. One sample post. Parser test in CI. |

Slices 2 and 5 can swap. Slice 4 must come after slice 2.

---

## 6. Open questions for you

- **Q1. Governing law and company form.** Who is the "operator" in the Terms (you as a person, or a company)? Which country's law applies? The domain is `.com.ar`, and you may live elsewhere.
- **Q2. Checkbox or note?** I recommend a required checkbox (2.1). A note only ("By continuing you agree...") is simpler but is weaker proof.
- **Q3. Existing users.** Do they need to accept the Terms? Options: (a) do nothing now, (b) show a one-time notice with "Accept" on next login, (c) ask only at the next Terms change. Option (b) needs one more screen and a backend endpoint.
- **Q4. Age limit.** Keep 13, or move to 16 (or "13 or your country's age")? A lawyer should answer.
- **Q5. Share-alike data.** Is it acceptable to rely on CC BY-SA data (credit plus the share-alike duty)? Or do we prefer CC0 / CC BY only?
- **Q6. Blog language.** English only, or each post in up to 4 languages? (Four languages need a `lang` field and one file per language.)
- **Q7. Contact address.** The privacy page uses a personal Gmail address. Do you want a project address (for example on `ladu.com.ar`) before the Terms go live?
- **Q8. Own licence.** Which licence do you want for your own code (3.4 item 1)? This depends on the plan for a paid tier.
