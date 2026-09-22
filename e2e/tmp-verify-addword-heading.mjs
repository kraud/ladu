/**
 * Throwaway verification for the /addWord heading responsive layout:
 * at 390px the h1 and subtitle must be stacked (no horizontal overlap,
 * subtitle below the title); at 1280px they must share a row (subtitle
 * starts to the right of the title) — i.e. unchanged desktop behaviour.
 * Screenshots land in /tmp/addword-{mobile,desktop}.png.
 */
import { chromium } from '@playwright/test';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';

const API = 'http://localhost:5001';
const APP = 'http://localhost:5173';

const dbUrl = /DATABASE_URL\s*=\s*"([^"]+)"/.exec(
    readFileSync('/Users/kraud/Documents/Repositories/Laduus/keelapp-v2/.env', 'utf8'),
)[1];

const run = Date.now();
const email = `e2e-visual-${run}@ladu.test`;
const password = 'password123';

const res = await fetch(`${API}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Kai Rebane',
        username: `kaivis${run}`,
        email,
        password,
        languages: ['English', 'Spanish'],
        uiLanguage: 'English',
    }),
});
if (res.status !== 201) throw new Error(`register failed ${res.status} ${await res.text()}`);

const db = new Client({ connectionString: dbUrl });
await db.connect();
const { rows } = await db.query(
    `SELECT u.id AS "userId", t.token FROM users u JOIN tokens t ON t.user_id = u.id
      WHERE lower(u.email) = lower($1)`,
    [email],
);
const verify = await fetch(`${API}/api/users/${rows[0].userId}/verify/${rows[0].token}`);
if (!verify.ok) throw new Error(`verify failed ${verify.status}`);

const browser = await chromium.launch();
const results = {};

for (const [label, viewport] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1280, height: 800 }],
]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${APP}/login`);
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('login'));
    await page.goto(`${APP}/addWord`);
    const h1 = page.locator('h1').first();
    await h1.waitFor();
    const sub = h1.locator('xpath=following-sibling::p[1]');
    const [title, subtitle] = [await h1.boundingBox(), await sub.boundingBox()];
    results[label] = {
        title: { x: Math.round(title.x), y: Math.round(title.y), w: Math.round(title.width), h: Math.round(title.height) },
        subtitle: { x: Math.round(subtitle.x), y: Math.round(subtitle.y), w: Math.round(subtitle.width), h: Math.round(subtitle.height) },
        stacked: subtitle.y >= title.y + title.height - 1,
        sameRow: subtitle.x >= title.x + title.width,
        titleText: (await h1.textContent())?.trim(),
        subtitleText: (await sub.textContent())?.trim(),
    };
    await page.waitForTimeout(1200);
    await page.locator("h1").first().locator("xpath=..").screenshot({ path: `/tmp/addword-${label}.png` });
    await page.close();
}

await db.query(`DELETE FROM users WHERE lower(email) = lower($1)`, [email]);
await db.end();
await browser.close();
console.log(JSON.stringify(results, null, 2));
