/**
 * Which clicks on a table row count as "open this word". A click on a button, a link, an input,
 * a label, a checkbox or the checkbox cell is for that element itself (a cell label opens the
 * cell dialog, a checkbox selects), not for the row. Shared by `/words` (`ReviewTable`) and
 * `/tag/:id` (`TagWordsTable`).
 */
export const ROW_CLICK_IGNORED = 'button, a, input, label, [role="checkbox"], .select-cell';

/** True when the click that reached the row came from the row itself, not from one of its controls. */
export function isPlainRowClick(event: { target: EventTarget | null }): boolean {
    return !(event.target as HTMLElement | null)?.closest(ROW_CLICK_IGNORED);
}
