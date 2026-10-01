const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export const NONE = '—';

export function formatDateTime(value: string | null | undefined): string {
    return value ? dateTime.format(new Date(value)) : NONE;
}

export function formatDate(value: string | null | undefined): string {
    return value ? date.format(new Date(value)) : NONE;
}

/** "Mar 3, 2026, 10:15 (EE)" — the country is the two-letter code, or absent. */
export function formatDateTimeWithCountry(value: string | null | undefined, country: string | null | undefined): string {
    if (!value) return NONE;
    return country ? `${formatDateTime(value)} (${country})` : formatDateTime(value);
}
