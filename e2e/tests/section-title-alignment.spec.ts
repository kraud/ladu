import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn } from '../fixtures/practice';

/**
 * On a phone, the title of a main section (Words, Tags, Practice) lines up with the header above it: the
 * title's icon is centred under the hamburger button's icon, and the title text starts where the Ladu
 * logo starts. On a desktop the title keeps the plain row (its left edge is the column's, as the logo's).
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

test('section titles line up with the hamburger button and the logo on a phone', async ({ page, request }) => {
    const user = await registerAndVerify(request, 'Align User', ['English', 'German']);
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page, user);

    for (const path of ['/words', '/tags', '/practice']) {
        await page.goto(path);
        const title = page.locator('main h1').first();
        await expect(title).toBeVisible();
        await page.waitForTimeout(500); // the page fades in

        const burger = await box(page, '.app-header-inner button svg'); // the hamburger's icon
        const logo = await box(page, '.app-header-inner a[aria-label] svg, .app-header-inner a[aria-label] img');
        const icon = await box(page, 'main h1 svg');
        const label = await box(page, 'main h1 > span:last-child');

        // The icons share one vertical axis; the text and the logo share their left edge.
        expect(Math.abs(icon.x + icon.width / 2 - (burger.x + burger.width / 2)), `${path} icon axis`).toBeLessThan(2);
        expect(Math.abs(label.x - logo.x), `${path} label edge`).toBeLessThan(2);
        if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/align-${path.slice(1)}.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
    }
});
