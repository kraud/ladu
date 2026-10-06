/**
 * Blog library: turns Markdown posts into HTML pages, an Atom feed and a sitemap.
 * Pure functions, no network. `build.mjs` calls them; `blog.test.mjs` tests them.
 *
 * A post is a file `landing/blog/posts/YYYY-MM-DD-slug.md`:
 *
 *   ---
 *   title: Ladu is open for early users
 *   summary: One short sentence for the list page and the feed.
 *   draft: true          (optional; a draft is not published)
 *   updated: 2026-10-20  (optional; shown in the feed)
 *   ---
 *   Body in Markdown.
 *
 * The date and the address come from the file name. The posts are written by
 * the owner and merged by pull request, so the Markdown body is trusted
 * content (raw HTML in a post is passed through). Titles and summaries are
 * escaped anyway.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { marked } from 'marked';

export const SITE_ORIGIN = 'https://ladu.com.ar';

/** Pages that exist without the blog build; listed in the sitemap. */
export const STATIC_PATHS = ['/', '/privacy.html', '/terms.html', '/credits.html', '/impressum.html'];

const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ['title', 'summary', 'draft', 'updated'];

export function isValidDate(text) {
    if (!DATE.test(text)) return false;
    const date = new Date(`${text}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

function unquote(value) {
    const first = value[0];
    if (value.length >= 2 && (first === '"' || first === "'") && value.at(-1) === first) {
        return value.slice(1, -1);
    }
    return value;
}

/** Splits `---` front matter from the body. Throws on anything unexpected. */
export function parseFrontMatter(source) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(source);
    if (!match) throw new Error('missing front matter (a block between two "---" lines at the top of the file)');

    const data = {};
    match[1].split(/\r?\n/).forEach((line, index) => {
        if (!line.trim() || line.trim().startsWith('#')) return;
        const pair = /^([a-z]+):\s*(.*)$/.exec(line);
        if (!pair) throw new Error(`front matter line ${index + 1} is not "key: value": ${line}`);
        const [, key, raw] = pair;
        if (!KEYS.includes(key)) {
            throw new Error(`unknown front matter key "${key}" (allowed: ${KEYS.join(', ')})`);
        }
        if (key in data) throw new Error(`front matter key "${key}" is used twice`);
        data[key] = unquote(raw.trim());
    });
    return { data, body: match[2] };
}

/** Reads one post file. The error message names the file. */
export function parsePost(fileName, source) {
    try {
        const name = FILE_NAME.exec(fileName);
        if (!name) {
            throw new Error('file name must be YYYY-MM-DD-slug.md (lower case letters, digits and single hyphens)');
        }
        const [, date, slug] = name;
        if (!isValidDate(date)) throw new Error(`"${date}" in the file name is not a real date`);

        const { data, body } = parseFrontMatter(source);
        if (!data.title) throw new Error('front matter needs a "title"');
        if (!data.summary) throw new Error('front matter needs a "summary"');
        if (data.draft !== undefined && data.draft !== 'true' && data.draft !== 'false') {
            throw new Error('"draft" must be true or false');
        }
        if (data.updated !== undefined && !isValidDate(data.updated)) {
            throw new Error('"updated" must be a real date, YYYY-MM-DD');
        }
        return {
            slug,
            date,
            updated: data.updated ?? date,
            title: data.title,
            summary: data.summary,
            draft: data.draft === 'true',
            markdown: body.trim(),
        };
    } catch (error) {
        throw new Error(`${fileName}: ${error.message}`);
    }
}

/** All published posts, newest first. `drafts: true` keeps drafts (preview only). */
export function loadPosts(dir, { drafts = false } = {}) {
    const posts = readdirSync(dir)
        .filter((file) => file.endsWith('.md'))
        .sort()
        .map((file) => parsePost(file, readFileSync(`${dir}/${file}`, 'utf8')))
        .filter((post) => drafts || !post.draft);

    const seen = new Map();
    for (const post of posts) {
        if (seen.has(post.slug)) {
            throw new Error(`two posts share the address "${post.slug}" (${seen.get(post.slug)} and ${post.date})`);
        }
        seen.set(post.slug, post.date);
    }
    return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function renderMarkdown(markdown) {
    return marked.parse(markdown, { async: false, gfm: true });
}

export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatDate(isoDate) {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${isoDate}T00:00:00Z`),
    );
}

export const postPath = (slug) => `/blog/${slug}.html`;

function replaceOnce(html, pattern, replacement, what) {
    if (!pattern.test(html)) {
        throw new Error(`shell page has no ${what}: the blog build reuses privacy.html, so keep that marker in it`);
    }
    // A function, so "$&" or "$1" inside a post is never read as a replacement pattern.
    return html.replace(pattern, () => replacement);
}

/**
 * The page frame (head, theme script, header, footer) is the privacy page, so the
 * blog always matches the rest of the site. Only the title, the description, the
 * extra head tags and the content of <main> are replaced.
 */
export function applyShell(shell, { title, description, path, type = 'website', main }) {
    const url = `${SITE_ORIGIN}${path}`;
    const headExtra = [
        `    <link rel="canonical" href="${url}" />`,
        `    <link rel="alternate" type="application/atom+xml" title="Ladu blog" href="/blog/feed.xml" />`,
        `    <meta property="og:title" content="${escapeHtml(title)}" />`,
        `    <meta property="og:description" content="${escapeHtml(description)}" />`,
        `    <meta property="og:type" content="${type}" />`,
        `    <meta property="og:url" content="${url}" />`,
        '',
    ].join('\n');

    let html = shell;
    html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`, '<title>');
    html = replaceOnce(
        html,
        /<meta name="description" content="[^"]*" \/>/,
        `<meta name="description" content="${escapeHtml(description)}" />`,
        'meta description',
    );
    html = replaceOnce(html, /<main class="legal">[\s\S]*<\/main>/, `<main class="legal">\n${main}\n    </main>`, '<main class="legal">');
    html = replaceOnce(html, /<\/head>/, `${headExtra}</head>`, '</head>');
    return html;
}

export function renderIndexPage(shell, posts) {
    const items = posts
        .map(
            (post) => `            <li>
                <time datetime="${post.date}">${formatDate(post.date)}</time>
                <a class="post-title" href="${postPath(post.slug)}">${escapeHtml(post.title)}</a>
                <p>${escapeHtml(post.summary)}</p>
            </li>`,
        )
        .join('\n');
    const list = posts.length > 0 ? `        <ul class="post-list">\n${items}\n        </ul>` : '        <p>No posts yet.</p>';
    const main = `        <article class="prose" lang="en">
            <h1>Blog</h1>
            <p class="note">News and small updates about Ladu. <a href="/blog/feed.xml">Atom feed</a></p>
${list}
        </article>`;
    return applyShell(shell, {
        title: 'Blog — Ladu',
        description: 'News and small updates about Ladu.',
        path: '/blog/',
        main,
    });
}

export function renderPostPage(shell, post) {
    const updated =
        post.updated !== post.date
            ? ` · updated <time datetime="${post.updated}">${formatDate(post.updated)}</time>`
            : '';
    const main = `        <article class="prose post" lang="en">
            <p class="post-back"><a href="/blog/" data-i18n="blogBack">Back to the blog</a></p>
            <h1>${escapeHtml(post.title)}</h1>
            <p class="note"><time datetime="${post.date}">${formatDate(post.date)}</time>${updated}</p>
${renderMarkdown(post.markdown)}
        </article>`;
    return applyShell(shell, {
        title: `${post.title} — Ladu`,
        description: post.summary,
        path: postPath(post.slug),
        type: 'article',
        main,
    });
}

export function escapeXml(text) {
    return escapeHtml(text);
}

/** Relative and root-relative links in post HTML, made absolute for feed readers. */
export function absolutizeHtml(html) {
    return html
        .replace(/\b(src|href)="(?![a-z][a-z0-9+.-]*:|\/|#)([^"]*)"/gi, (_m, attr, url) => `${attr}="${SITE_ORIGIN}/blog/${url}"`)
        .replace(/\b(src|href)="\/(?!\/)([^"]*)"/gi, (_m, attr, url) => `${attr}="${SITE_ORIGIN}/${url}"`);
}

export function renderFeed(posts) {
    const updated = posts.length > 0 ? posts.map((p) => p.updated).sort().at(-1) : '1970-01-01';
    const entries = posts
        .map((post) => {
            const url = `${SITE_ORIGIN}${postPath(post.slug)}`;
            return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${url}" />
    <id>${url}</id>
    <published>${post.date}T00:00:00Z</published>
    <updated>${post.updated}T00:00:00Z</updated>
    <summary>${escapeXml(post.summary)}</summary>
    <content type="html">${escapeXml(absolutizeHtml(renderMarkdown(post.markdown)))}</content>
  </entry>`;
        })
        .join('\n');
    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ladu blog</title>
  <subtitle>News and small updates about Ladu.</subtitle>
  <link href="${SITE_ORIGIN}/blog/feed.xml" rel="self" />
  <link href="${SITE_ORIGIN}/blog/" />
  <id>${SITE_ORIGIN}/blog/</id>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>Ladu</name></author>
${entries}
</feed>
`;
}

export function renderSitemap(posts) {
    const urls = [
        ...STATIC_PATHS.map((p) => ({ loc: p })),
        { loc: '/blog/', lastmod: posts[0]?.updated },
        ...posts.map((post) => ({ loc: postPath(post.slug), lastmod: post.updated })),
    ]
        .map(({ loc, lastmod }) => `  <url><loc>${SITE_ORIGIN}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
