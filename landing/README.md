# Landing site

The public site at `ladu.com.ar`: the home page, the Privacy Policy, the Terms, the credits page, the legal notice (Impressum) and the blog.

- The pages are plain HTML, CSS and one script (`app.js`). There is no build step for them.
- The **blog** is built from Markdown files when the Docker image is built. The result is plain HTML. No script runs in the visitor's browser for it.
- `landing/` is **not** an npm workspace. It has its own `package.json` and `package-lock.json`, and its own Docker build context.

## Write a blog post

1. Create a file in `landing/blog/posts/`. The name is `YYYY-MM-DD-slug.md`, for example `2026-10-15-ladu-is-open.md`.
   - The date comes from the file name. The web address is `/blog/<slug>.html`.
   - Use lower-case letters, digits and single hyphens in the slug.
2. Start the file with a header between two `---` lines, then write the post in Markdown:

   ```md
   ---
   title: Ladu is open for early users
   summary: One short sentence for the list page and the feed.
   ---

   The text of the post. Use `##` for headings (the title is already the main heading).
   ```

   | Key | Needed | Meaning |
   |---|---|---|
   | `title` | yes | Page title and heading |
   | `summary` | yes | Shown on the list page, in the feed and in link previews |
   | `draft` | no | `draft: true` keeps the post out of the site |
   | `updated` | no | A later date, `YYYY-MM-DD`. Shown on the post and in the feed |

   A wrong key, a bad date or a wrong file name stops the build with a message that names the file.

3. Images: put the file in `landing/blog/images/` and write `![A short description](images/name.png)`.
4. Preview and test (see below), then open a pull request.

Posts are English only. Write only what the Privacy Policy and the Terms allow: the blog has no analytics, no comments and no share buttons.

## Preview on your machine

```bash
cd landing
npm ci               # once
npm test             # unit tests of the build
npm run build -- --drafts   # builds into landing/dist/, drafts included
```

`dist/` holds only the generated files (`blog/`, `sitemap.xml`). To see the whole site, build the image and open it:

```bash
docker build -f landing/Dockerfile -t ladu-landing:local landing/
docker run --rm -p 8080:80 ladu-landing:local     # http://localhost:8080/blog/
```

The image never includes drafts. To look at a draft, use `npm run build -- --drafts` and serve `dist/` together with the static files, or turn `draft` off while you check.

## Publish

1. Merge the pull request to `main`. `deploy.yml` builds the `ladu-landing` image and moves its `latest` tag.
2. Run `ansible-playbook site.yml` from `deploy/ansible/`. The landing page does **not** deploy with the app: this step pulls the new image. See `.dev-context/infrastructure-guide/01-architecture-overview.md`, "Publishing a change to the landing page".

A merged post is live after step 2. Use `draft: true` while you write.

## What the build makes

| File | Content |
|---|---|
| `dist/blog/index.html` | List of posts, newest first |
| `dist/blog/<slug>.html` | One page per post |
| `dist/blog/feed.xml` | Atom feed |
| `dist/blog/images/*` | Copied from `blog/images/` |
| `dist/sitemap.xml` | All pages and posts |

The page frame (head, theme script, header, footer) is **`privacy.html`**. The build replaces only its title, description and main content. Change the header or footer in the static pages and the blog follows. If `privacy.html` loses one of the markers the build needs, the build fails with a message (and a unit test checks it).

`robots.txt` is a static file.

## Files

| Path | Role |
|---|---|
| `scripts/blog.mjs` | The library: reads posts, renders pages, feed and sitemap |
| `scripts/build.mjs` | The command that writes `dist/` |
| `scripts/blog.test.mjs` | Unit tests (`npm test`, run in CI) |
| `scripts/region.test.mjs` | Unit tests of `region.js` |
| `scripts/notice.test.mjs` | Checks that the notice texts exist in all four languages and that every page loads `region.js` before `app.js` |
| `region.js` | Decides if the storage notice is shown. The country comes from `/region` (see below) |
| `blog/posts/`, `blog/images/` | Your content |

## The home page

- **Example word:** four rows (EN, ES, DE, EE) inside the logo's message bubble. The bubble is drawn by CSS masks of two brand files with the same path, the bubble of `Ladu_title_with_icon.svg` without the letters: `brand/Ladu_bubble_surface.svg` (its fill, the card colour) and `brand/Ladu_bubble_outline.svg` (a thin stroke of it, the accent colour; the stroke is 1.2 of the 62 units of height). Both follow the theme. The rows are sized in `cqw` (a hundredth of the bubble's width), so they fill the bubble at any size.
- **Rolling words:** `app.js` (`WORDS`, `rollWords`) changes the words every 5 seconds on the phone (`ROLL_MS`; on desktop see below; the longest card is answered about 2 seconds after it appears), in this order: dance, house, pretty, very (each with its translations). The old word moves up and out, the new one comes in from below. All rows change together; set `ROLL_ROWS_TOGETHER = false` in `app.js` for one row after the other. Without script, or with "reduce motion" set in the system, the first word stays. The words are fixed examples; they are not translated into the interface language.
- **Phone** (`max-width: 52rem`): the home page has **no header** (the legal pages and the blog keep theirs). The hero is a grid; its rows, top to bottom: the logo `Ladu_title_with_icon.svg` (wordmark and bubble), centred, with 2rem above it; the title on one line (its size follows the window) with a separator under it; the **first sentence** of the hint; **feature 1**: the second sentence with the small bubble beside it (its tail points at the text); **feature 2**: the exercise card (60%) with the third sentence beside it; **feature 3**: the hint of the tags with the tag card (60%); free space; the Open button; the list of languages (as on the desktop), centred; and, at the bottom above the footer, the language and theme switches.
- **Phone-only parts:** the phone shows the hint in separate sentences (`.m-lead`, `.m-text`; strings `leadA` to `leadD`), each beside its preview. The desktop shows the same four strings in one paragraph (`.lead`, four `<span>`s) and none of the `.m-*` elements. They are in the same page and hidden by CSS; the logo, Open button and switches are shared, so the script has one picker and one theme button. There is no separate `lead` string: change a sentence once, in `leadA` to `leadD`.
- **Desktop: three previews, one place** (`.bubble`, `.exercise`, `.tagcard`, the same elements as on the phone). They share the right column; the one of the current feature has `.is-current`, the others are invisible but keep their room, so nothing jumps. Each feature shows all four of its states (FEATURE_STEPS beats of `ROLL_MS`) while its part of the hint (`.feat`, `data-feat` 0, 1, 2) is highlighted. When the next feature comes, the shown preview rolls out, all three go back to their first state, and the next one rolls in (`rollWords` in `app.js`). The data of each preview is the one the phone shows (casa - la, Haus - das included). The phone ignores `.is-current`: all three are always shown.
- **Desktop: the parts of the hint are buttons and a progress bar.** `app.js` gives each `.feat` `role="button"` and `tabindex=0` (so without script they stay plain text). A click, Enter or Space shows its preview and starts the cycle again from there. The current part has a soft blue background (`--feat-track`) and a darker blue (`--feat-fill`, 30% of the accent) fills it along the text, line after line, in `FILL_MS` (10 s; `--feat-ms`, set by `app.js`). It stays full for `FILL_HOLD_MS` (0.5 s), then the next preview comes. A feature lasts `FILL_MS` + `FILL_HOLD_MS` + `OUT_MS` (the roll-out before the fill starts), and its four states share that time: on desktop a beat is `DESKTOP_ROLL_MS` (about 2.7 s); the phone keeps `ROLL_MS` (5 s). With "reduce motion" nothing turns or fills by itself and the current part is marked with the darker blue; the buttons are then the only way to see the other previews.
- **Desktop card sizes:** the texts of the exercise and tag cards are capped for the small cards of the phone, so the desktop block in `style.css` (`@media (min-width: 52.01rem)`, selectors with `.hero`) sets them in `cqw`, with no cap, so they fill the wider cards. Padding of these cards is in rem there (a card's own `cqw` counts the window).
- **Exercise cards:** simplified versions of the app's card, one for each word of the bubble and in the same order, so the card beside the third sentence always belongs to the word in the bubble above it: dance (typed answer, German "tanzen" to Estonian "tantsima"), house (multiple choice, the article of "Haus"), pretty (multiple choice, Spanish "bonito" to English: pretty, fast, scary), very (typed answer, English to German). In a typed answer the language of the answer is a badge at the start of the input, inside it. In the multiple-choice card that changes language (pretty), a small arrow points from the prompt to the badge of the answer's language beside it; a typed answer has its badge inside the input instead, so no arrow.
- **The cards are played** (`playPanel` in `app.js`), as if someone were answering. A card starts unanswered. Half a second after it appears: a multiple-choice card presses its option (`data-pick`, a blue highlight for a moment), a typed-answer card types its word letter by letter (`data-type`, 120 ms a letter, with a caret). Then the option or the input turns green or red (`data-result`: right or wrong; a tick or a cross in the input) and the fourth dot takes the same colour. The four dots are the word's answers: the first three are earlier answers (different for each card; set in `index.html`), the fourth is this answer. What is played: dance: types "tantsima", right; house: picks "das", right; pretty: picks "scary", wrong; very: types "ser", wrong. To change a card, change its `data-*` attributes and its first three dots. With "reduce motion" the first card shows its finished answer and nothing turns; without script the cards stay unanswered. Colours `--ok` and `--bad`, in light and dark. The card is in the left column and its sentence in the right one; for the bubble it is the other way round.
- **Feature 3, tags (phone):** a tag card as the Tags page of the app shows it, 60% of the row with its hint (`leadD`) on the left (the grid has ten columns: feature 1 uses 5 + 5, feature 2 6 + 4 with its card on the left, this one 4 + 6). It shows the tag's name with the tag icon; a badge "Yours" or "Following" (a tag of someone else that the user follows); a Public (green) or Private (lock) badge; four words, each with 3 or 4 of its translations in the colour of their language (no wrapping); and the number of words and of followers. Four tags (Travel: yours, public, 3 followers; Kitchen: following; Favourites: yours, private, 0 followers; Weather: following) turn on the same beat as the other features, and the words of the tag that comes in appear one after the other (`turnTags`). With "reduce motion" the first tag is shown with all its words. The card's texts are `tagCard`, `tagPrivate`, `tagPublic`, `tagYours`, `tagFollowing`, `tagWords`, `tagFollowers`; the tag names and words are fixed examples.
- **How the features change:** the bubble's words and the tag card roll upwards (the old one moves up and out, the new one comes in from below); the exercise card scrolls to the left (the old content goes out to the left, the new one comes in from the right; the `roll-x` class; the card `.exercise` clips it, so nothing shows outside the card).
- **Gender badges (phone):** when the bubble shows a noun (house), its Spanish and German rows get a small badge with the article: casa - la, Haus - das (`gender` in `WORDS`, `.gender`). The other words show none.
- **Top space (phone):** there is no header, so the logo has only 1rem above it.
- **Buttons:** "Log in" has a sign-in icon, "Open" an arrow-square-out icon (Phosphor, inline).
- Brand files are copied by the Dockerfile (`COPY brand/`), so a new file there needs no change in it.

## Storage notice: who sees it

The notice is shown only in the EU, the other EEA states (IS, LI, NO) and the UK. Switzerland is not in the list.

1. Cloudflare adds the visitor's country to each request (`CF-IPCountry`). The option "IP Geolocation" must be on in the Cloudflare dashboard.
2. The `/region` path in the `Caddyfile` returns that code as plain text. It is never cached.
3. `region.js` checks the code against the list. An unknown or invalid code, or a failed request, shows the notice.

`app.js` builds the notice and shows it. The visitor presses "Got it", and the choice is saved in `localStorage` under `ladu.notice.v1`. To show the notice to everyone again, change `v1` to `v2` in `app.js`. A new page needs `<script src="/region.js">` before `app.js` (a test checks the existing pages). The blog follows `privacy.html`.

To change the list, edit `NOTICE_COUNTRIES` in `region.js` and the tests.

To test on your computer, add `?region=DE` (notice) or `?region=AR` (no notice) to a local address. This works on `localhost` only. On the real site the parameter does nothing.
