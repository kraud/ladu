import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn } from '../fixtures/practice';

/**
 * On a phone, the title of a main section (Words, Tags, Practice) lines up with the header above it: the
 * title's icon starts where the Ladu logo starts. The phone also has no menu button in the header; the
 * navigation is the fixed bottom bar, and the page content ends above it.
 */

const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

async function box(page: Page, selector: string) {
    const b = await page.locator(selector).first().boundingBox();
    expect(b, selector).not.toBeNull();
    return b!;
}

test('section titles line up with the logo, and the bottom nav stays clear of the content, on a phone', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Align User', ['English', 'German']);
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page, user);

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(page.locator('.app-header-inner button').first()).not.toHaveAttribute('aria-label', 'Menu');

    for (const path of ['/words', '/tags', '/practice']) {
        await page.goto(path);
        const title = page.locator('main h1').first();
        await expect(title).toBeVisible();
        await page.waitForTimeout(500); // the page fades in

        const logo = await box(page, '.app-header-inner a[aria-label] svg, .app-header-inner a[aria-label] img');
        const icon = await box(page, 'main h1 svg');
        expect(Math.abs(icon.x - logo.x), `${path} left edge`).toBeLessThan(2);

        // The bar sits at the bottom of the window, and the page does not scroll behind it.
        const bar = (await nav.boundingBox())!;
        expect(Math.round(bar.y + bar.height), `${path} bar at the bottom`).toBe(800);
        const main = await box(page, 'main');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const mainAfter = await box(page, 'main');
        expect(mainAfter.y + mainAfter.height, `${path} content above the bar`).toBeLessThanOrEqual(bar.y + 1);
        void main;
        // The current page's item is in the accent colour; the others are muted.
        const colours = await nav.locator('a').evaluateAll((links) => links.map((a) => getComputedStyle(a).color));
        const activeIndex = ['/words', '/tags', '/', '/practice'].indexOf(path);
        expect(colours[activeIndex], `${path} active colour`).not.toBe(colours[(activeIndex + 1) % 4]);
        if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/align-${path.slice(1)}.png` });
    }

    // The More drawer opens from the bottom and closes with its X.
    await nav.getByRole('button', { name: 'More' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Random practice' })).toBeVisible();
    await page.waitForTimeout(500); // the drawer slides in
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/more.png` });
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
});

test('the word editor bar sits right above the bottom nav on a phone', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Editor Nav User', ['English', 'German']);
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page, user);

    await page.goto('/addWord/noun');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    await page.waitForTimeout(500);
    const bar = page.locator('.fixed.bottom-\\(--bottom-nav-h\\)').first();
    await expect(bar).toBeVisible();
    const barBox = (await bar.boundingBox())!;
    const navBox = (await nav.boundingBox())!;
    expect(Math.round(barBox.y + barBox.height)).toBe(Math.round(navBox.y));
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/editor.png` });
});
