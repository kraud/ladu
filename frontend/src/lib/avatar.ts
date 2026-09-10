/**
 * Deterministic avatar initials + background colour.
 *
 * Ported from the old `generalUseFunctions.ts` `stringToColor` (`:130-153`) +
 * `stringAvatar` (`:155-185`), minus the MUI `sx` wrapper: a djb2-ish hash of
 * the name → a stable `#rrggbb`, and up to three uppercased word initials.
 */

const MAX_INITIALS = 3;

/** Stable `#rrggbb` derived from `value`; `#000000` for an empty string. */
export function avatarColor(value: string): string {
    if (!value) return '#000000';

    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
        hash &= hash; // keep it a 32-bit int
    }

    let color = '#';
    for (let i = 0; i < 3; i += 1) {
        const channel = (hash >> (i * 8)) & 0xff;
        color += channel.toString(16).padStart(2, '0');
    }
    return color;
}

/** First letter of each word, uppercased, max 3; `"-"` when `name` is blank. */
export function avatarInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '-';
    return words
        .slice(0, MAX_INITIALS)
        .map((w) => w[0]!.toUpperCase())
        .join('');
}
