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

## Storage notice: who sees it

The notice is shown only in the EU, the other EEA states (IS, LI, NO) and the UK. Switzerland is not in the list.

1. Cloudflare adds the visitor's country to each request (`CF-IPCountry`). The option "IP Geolocation" must be on in the Cloudflare dashboard.
2. The `/region` path in the `Caddyfile` returns that code as plain text. It is never cached.
3. `region.js` checks the code against the list. An unknown or invalid code, or a failed request, shows the notice.

`app.js` builds the notice and shows it. The visitor presses "Got it", and the choice is saved in `localStorage` under `ladu.notice.v1`. To show the notice to everyone again, change `v1` to `v2` in `app.js`. A new page needs `<script src="/region.js">` before `app.js` (a test checks the existing pages). The blog follows `privacy.html`.

To change the list, edit `NOTICE_COUNTRIES` in `region.js` and the tests.

To test on your computer, add `?region=DE` (notice) or `?region=AR` (no notice) to a local address. This works on `localhost` only. On the real site the parameter does nothing.
