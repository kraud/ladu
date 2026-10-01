const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}

/** 93784 -> "1d 2h 3m". Seconds are dropped above one minute; the largest two parts are enough. */
export function formatUptime(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const parts = [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`].filter(Boolean);
    return parts.join(' ');
}

/** "3 hours ago". `now` is a parameter so a test does not depend on the clock. */
export function formatAgo(iso: string, now: number = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const units: [number, string][] = [
        [86_400, 'day'],
        [3_600, 'hour'],
        [60, 'minute'],
    ];
    for (const [size, name] of units) {
        if (seconds >= size) {
            const n = Math.floor(seconds / size);
            return `${n} ${name}${n === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

/** The table names from the API as labels. */
export const TABLE_LABELS: Record<string, string> = {
    users: 'Users',
    words: 'Words',
    translations: 'Translations',
    tags: 'Tags',
    practiceSessions: 'Saved practice sessions',
    loginEvents: 'Login events',
    auditLog: 'Audit log entries',
};
