/**
 * Builds the blog into landing/dist/ (run by `npm run build`, and by the
 * landing Dockerfile). Nothing else in landing/ is generated.
 *
 *   dist/blog/index.html          the list of posts
 *   dist/blog/<slug>.html         one page per post
 *   dist/blog/feed.xml            Atom feed
 *   dist/blog/images/*            copied from landing/blog/images/
 *   dist/sitemap.xml
 *
 * `--drafts` keeps posts marked `draft: true`, to preview them locally. The
 * Docker build never passes it.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPosts, postPath, renderFeed, renderIndexPage, renderPostPage, renderSitemap } from './blog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const drafts = process.argv.includes('--drafts');

const shell = readFileSync(path.join(root, 'privacy.html'), 'utf8');
const posts = loadPosts(path.join(root, 'blog', 'posts'), { drafts });

rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, 'blog'), { recursive: true });

const write = (urlPath, content) => {
    const target = path.join(dist, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
    writeFileSync(target, content);
};

write('/blog/', renderIndexPage(shell, posts));
for (const post of posts) write(postPath(post.slug), renderPostPage(shell, post));
write('/blog/feed.xml', renderFeed(posts));
write('/sitemap.xml', renderSitemap(posts));

const images = path.join(root, 'blog', 'images');
if (existsSync(images)) cpSync(images, path.join(dist, 'blog', 'images'), { recursive: true });

console.log(`Blog built: ${posts.length} post${posts.length === 1 ? '' : 's'}${drafts ? ' (drafts included)' : ''} -> dist/`);
