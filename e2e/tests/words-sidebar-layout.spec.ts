import { test, expect, type Page } from '@playwright/test';
import { closePool, deleteUsersByEmail } from '../fixtures/db';
import { createdEmails, registerAndVerify, signIn, type Account } from '../fixtures/practice';

/**
 * The Words page and its filter sidebar (`sidebar-layout.md`): the sidebar starts collapsed, and the
 * content column lines up with the header content both while it is collapsed and while it is open.
 *
 * The column is centred in the window, not in the space right of the sidebar: the sidebar is a
 * docked panel (3.5rem collapsed, 16rem open), and a column centred in what is left of it would sit
 * half the panel's width to the right of the header's content.
 */

const SHOT_DIR = process.env.E2E_SHOT_DIR;

test.afterAll(async () => {
    await deleteUsersByEmail(createdEmails);
    await closePool();
});

/** Left edge of the header's content (the logo) and of the page title, in pixels. */
async function edges(page: Page): Promise<{ header: number; title: number }> {
    const header = await page.locator('.app-header-inner').first().locator('a').first().boundingBox();
    const title = await page.locator('main h1').first().boundingBox();
    return { header: header!.x, title: title!.x };
}

test('the filter sidebar starts collapsed, and the content stays aligned with the header open or closed', async ({ page, request }) => {
    const user: Account = await registerAndVerify(request, 'Sidebar Layout User');
    await page.setViewportSize({ width: 1600, height: 900 });
    await signIn(page, user);
    await page.goto('/words');

    // Collapsed by default: the toggle offers to expand it.
    const toggle = page.getByRole('button', { name: /^(Expand|Collapse) sidebar$/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('main h1').first()).toBeVisible();
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/words-collapsed.png` });
    const collapsed = await edges(page);
    expect(Math.abs(collapsed.title - collapsed.header)).toBeLessThan(2);

    // Open: the panel is wider, the column stays where the header content is.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(400); // the panel and the column animate for 150 ms
    if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/words-open.png` });
    const open = await edges(page);
    expect(Math.abs(open.title - open.header)).toBeLessThan(2);
});
