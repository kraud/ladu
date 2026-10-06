import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
    absolutizeHtml,
    applyShell,
    escapeHtml,
    formatDate,
    isValidDate,
    loadPosts,
    parseFrontMatter,
    parsePost,
    renderFeed,
    renderIndexPage,
    renderPostPage,
    renderSitemap,
} from './blog.mjs';

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHELL = `<!doctype html>
<html lang="en">
<head>
    <title>Shell</title>
    <meta name="description" content="Shell description" />
</head>
<body>
    <main class="legal">
        old content
    </main>
    <footer>footer</footer>
</body>
</html>`;

const source = (extra = '', body = 'Hello **world**.') =>
    `---\ntitle: A title\nsummary: A summary.\n${extra}---\n${body}\n`;

function postsDir(files) {
    const dir = mkdtempSync(path.join(tmpdir(), 'ladu-posts-'));
    for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
    return dir;
}

describe('isValidDate', () => {
    it('accepts real dates only', () => {
        assert.equal(isValidDate('2026-10-06'), true);
        assert.equal(isValidDate('2026-02-30'), false);
        assert.equal(isValidDate('2026-13-01'), false);
        assert.equal(isValidDate('26-10-06'), false);
    });
});

describe('parseFrontMatter', () => {
    it('reads keys and strips quotes', () => {
        const { data, body } = parseFrontMatter('---\ntitle: "Hello: world"\nsummary: Plain\n---\nText');
        assert.deepEqual(data, { title: 'Hello: world', summary: 'Plain' });
        assert.equal(body, 'Text');
    });

    it('reads Windows line endings', () => {
        const { data } = parseFrontMatter('---\r\ntitle: A\r\nsummary: B\r\n---\r\nText');
        assert.equal(data.title, 'A');
    });

    it('rejects a file with no front matter, an unknown key, a bad line and a repeated key', () => {
        assert.throws(() => parseFrontMatter('Just text'), /missing front matter/);
        assert.throws(() => parseFrontMatter('---\ntitel: x\n---\n'), /unknown front matter key "titel"/);
        assert.throws(() => parseFrontMatter('---\nnot a pair\n---\n'), /not "key: value"/);
        assert.throws(() => parseFrontMatter('---\ntitle: a\ntitle: b\n---\n'), /used twice/);
    });
});

describe('parsePost', () => {
    it('takes the date and the address from the file name', () => {
        const post = parsePost('2026-10-15-first-post.md', source());
        assert.equal(post.date, '2026-10-15');
        assert.equal(post.slug, 'first-post');
        assert.equal(post.updated, '2026-10-15');
        assert.equal(post.draft, false);
        assert.equal(post.markdown, 'Hello **world**.');
    });

    it('reads draft and updated', () => {
        const post = parsePost('2026-10-15-x.md', source('draft: true\nupdated: 2026-10-20\n'));
        assert.equal(post.draft, true);
        assert.equal(post.updated, '2026-10-20');
    });

    it('names the file in every error', () => {
        assert.throws(() => parsePost('first-post.md', source()), /first-post\.md: file name must be/);
        assert.throws(() => parsePost('2026-02-30-x.md', source()), /not a real date/);
        assert.throws(() => parsePost('2026-10-15-x.md', '---\nsummary: s\n---\nb'), /needs a "title"/);
        assert.throws(() => parsePost('2026-10-15-x.md', '---\ntitle: t\n---\nb'), /needs a "summary"/);
        assert.throws(() => parsePost('2026-10-15-x.md', source('draft: maybe\n')), /"draft" must be true or false/);
        assert.throws(() => parsePost('2026-10-15-x.md', source('updated: soon\n')), /"updated" must be a real date/);
    });
});

describe('loadPosts', () => {
    it('sorts newest first and skips drafts', () => {
        const dir = postsDir({
            '2026-01-01-old.md': source(),
            '2026-03-01-new.md': source(),
            '2026-02-01-hidden.md': source('draft: true\n'),
            'notes.txt': 'ignored',
        });
        assert.deepEqual(
            loadPosts(dir).map((p) => p.slug),
            ['new', 'old'],
        );
    });

    it('keeps drafts when asked to', () => {
        const dir = postsDir({ '2026-02-01-hidden.md': source('draft: true\n') });
        assert.equal(loadPosts(dir).length, 0);
        assert.equal(loadPosts(dir, { drafts: true }).length, 1);
    });

    it('refuses two posts with the same address', () => {
        const dir = postsDir({ '2026-01-01-same.md': source(), '2026-02-01-same.md': source() });
        assert.throws(() => loadPosts(dir), /share the address "same"/);
    });

    it('refuses a Markdown file with a wrong name, so a typo cannot hide a post', () => {
        const dir = postsDir({ 'my-post.md': source() });
        assert.throws(() => loadPosts(dir), /file name must be/);
    });
});

describe('pages', () => {
    const post = parsePost('2026-10-15-first-post.md', source('', 'Cost: $& and $1 stay as text.\n\n![alt](images/a.png)'));

    it('applyShell replaces title, description and main, and adds head tags', () => {
        const html = applyShell(SHELL, { title: 'T & <b>', description: 'D "q"', path: '/blog/x.html', main: '<p>new</p>' });
        assert.match(html, /<title>T &amp; &lt;b&gt;<\/title>/);
        assert.match(html, /content="D &quot;q&quot;"/);
        assert.match(html, /<main class="legal">\n<p>new<\/p>\n    <\/main>/);
        assert.doesNotMatch(html, /old content/);
        assert.match(html, /<link rel="canonical" href="https:\/\/ladu\.com\.ar\/blog\/x\.html" \/>/);
        assert.match(html, /<link rel="alternate" type="application\/atom\+xml"/);
        assert.match(html, /<footer>footer<\/footer>/);
    });

    it('applyShell fails loudly when the shell lost a marker', () => {
        assert.throws(() => applyShell('<html></html>', { title: 't', description: 'd', path: '/', main: '' }), /shell page has no/);
    });

    it('the real privacy.html still has every marker the build needs', () => {
        const shell = readFileSync(path.join(landingDir, 'privacy.html'), 'utf8');
        assert.doesNotThrow(() => applyShell(shell, { title: 't', description: 'd', path: '/', main: '' }));
    });

    it('renderPostPage escapes the title, keeps the body, and does not read "$&" as a pattern', () => {
        const evil = parsePost('2026-10-15-evil.md', '---\ntitle: <script>x</script>\nsummary: s\n---\nBody $& here');
        const html = renderPostPage(SHELL, evil);
        assert.match(html, /<h1>&lt;script&gt;x&lt;\/script&gt;<\/h1>/);
        assert.doesNotMatch(html, /<script>x/);
        assert.ok(html.includes('Body $&amp; here'), 'the text "$&" must appear as written, not as a replacement pattern');
        assert.match(html, /<time datetime="2026-10-15">15 October 2026<\/time>/);
        assert.match(html, /lang="en"/);
    });

    it('renderPostPage shows the update date only when it differs', () => {
        const same = renderPostPage(SHELL, post);
        const changed = renderPostPage(SHELL, { ...post, updated: '2026-10-20' });
        assert.doesNotMatch(same, /updated/);
        assert.match(changed, /updated <time datetime="2026-10-20">20 October 2026<\/time>/);
    });

    it('renderIndexPage lists posts, or says there are none', () => {
        const list = renderIndexPage(SHELL, [post]);
        assert.match(list, /<a class="post-title" href="\/blog\/first-post\.html">A title<\/a>/);
        assert.match(list, /A summary\./);
        assert.match(renderIndexPage(SHELL, []), /No posts yet\./);
    });
});

describe('feed and sitemap', () => {
    const posts = [
        parsePost('2026-10-15-first-post.md', source('', 'See ![alt](images/a.png) and [home](/).')),
        parsePost('2026-09-01-older.md', source('updated: 2026-09-05\n')),
    ];

    it('absolutizeHtml makes relative and root-relative links absolute, and leaves others', () => {
        const out = absolutizeHtml('<img src="images/a.png"><a href="/privacy.html">p</a><a href="https://x.test/">x</a><a href="#top">t</a>');
        assert.match(out, /src="https:\/\/ladu\.com\.ar\/blog\/images\/a\.png"/);
        assert.match(out, /href="https:\/\/ladu\.com\.ar\/privacy\.html"/);
        assert.match(out, /href="https:\/\/x\.test\/"/);
        assert.match(out, /href="#top"/);
    });

    it('renderFeed has one entry per post, absolute links, and escaped HTML content', () => {
        const feed = renderFeed(posts);
        assert.equal((feed.match(/<entry>/g) ?? []).length, 2);
        assert.match(feed, /<id>https:\/\/ladu\.com\.ar\/blog\/first-post\.html<\/id>/);
        assert.match(feed, /<updated>2026-10-15T00:00:00Z<\/updated>\n  <author>/);
        assert.match(feed, /&lt;img src=&quot;https:\/\/ladu\.com\.ar\/blog\/images\/a\.png&quot;/);
        assert.doesNotMatch(feed, /<img/);
    });

    it('renderFeed works with no posts', () => {
        assert.match(renderFeed([]), /<updated>1970-01-01T00:00:00Z<\/updated>/);
    });

    it('renderSitemap lists the static pages, the blog and every post', () => {
        const map = renderSitemap(posts);
        for (const loc of ['/', '/privacy.html', '/terms.html', '/credits.html', '/impressum.html', '/blog/', '/blog/first-post.html', '/blog/older.html']) {
            assert.ok(map.includes(`<loc>https://ladu.com.ar${loc}</loc>`), loc);
        }
        assert.match(map, /<loc>https:\/\/ladu\.com\.ar\/blog\/older\.html<\/loc><lastmod>2026-09-05<\/lastmod>/);
    });
});

describe('helpers', () => {
    it('escapeHtml and formatDate', () => {
        assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
        assert.equal(formatDate('2026-01-05'), '5 January 2026');
    });
});
