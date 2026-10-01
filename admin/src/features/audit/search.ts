/**
 * The audit page keeps its filters and page in the URL, like the users list.
 * Dates are plain days (YYYY-MM-DD) in the URL, and become exact times for the
 * API in the person's own time zone (`apiRange`).
 */
export interface AuditSearch {
    /** A staff id, or `system` for rows written by the nightly job. */
    staff?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ACTION_LENGTH = 64;

const validDay = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !DAY.test(value)) return undefined;
    // `2026-02-31` has the right shape and is not a day.
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
};

/** Anything malformed in the URL is dropped, never an error page. */
export function validateAuditSearch(search: Record<string, unknown>): AuditSearch {
    const page = Number(search.page);
    const staff = typeof search.staff === 'string' && (search.staff === 'system' || UUID.test(search.staff)) ? search.staff : undefined;
    const action =
        typeof search.action === 'string' && search.action.trim() && search.action.length <= MAX_ACTION_LENGTH ? search.action.trim() : undefined;
    return {
        staff,
        action,
        from: validDay(search.from),
        to: validDay(search.to),
        page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
}

/** The first moment of a local day, as an ISO instant. */
const startOfLocalDay = (day: string, plusDays = 0): string => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d + plusDays).toISOString();
};

/**
 * The API takes `from` (included) and `to` (not included) as exact times. A
 * person who picks "from 1 Oct to 3 Oct" means all of 3 Oct, so `to` is the
 * start of the day after.
 */
export function apiRange(search: Pick<AuditSearch, 'from' | 'to'>): { from?: string; to?: string } {
    return {
        from: search.from ? startOfLocalDay(search.from) : undefined,
        to: search.to ? startOfLocalDay(search.to, 1) : undefined,
    };
}
