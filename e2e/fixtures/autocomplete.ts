import { expect, type Page } from '@playwright/test';

/**
 * Helpers for the type-ahead list on the autocomplete query field.
 *
 * The list does not close by itself when the user has typed a whole word that is in the list
 * (decision D34): it stays open so the word can be clicked. While it is open it covers the card
 * footer and hides the rest of the page from the accessibility tree, so a spec that types a listed
 * word and then goes on to another element closes the list first, with a click outside it (on the
 * page heading), like a user would.
 */

/** The list request waits 150 ms after typing, the lookup 500 ms. After this the list (if any) has arrived. */
const SETTLE_MS = 700;

/** Closes the type-ahead list if the typed word has one; does nothing when it has none. */
export async function closeTypeAheadList(page: Page): Promise<void> {
    await page.waitForTimeout(SETTLE_MS);
    if ((await page.getByRole('listbox').count()) > 0) {
        await page.locator('h1').first().click();
        await expect(page.getByRole('listbox')).toHaveCount(0);
    }
}

/**
 * Clicks "Use autocomplete values" (the card footer button) for the word just typed. The short wait
 * first makes sure the button belongs to that word's lookup: during the pause the footer can still
 * show the previous word's lookup.
 */
export async function clickUseValues(page: Page): Promise<void> {
    await page.waitForTimeout(SETTLE_MS);
    // `includeHidden`: while the list is open the rest of the page is hidden from the accessibility tree.
    await expect(page.getByRole('button', { name: 'Use autocomplete values', includeHidden: true })).toBeVisible();
    await closeTypeAheadList(page);
    await page.getByRole('button', { name: 'Use autocomplete values' }).click();
}
