// Every day in the statistics is a UTC day, so every date here is read in UTC. A day is shown
// as a day, never converted to the reader's time zone: "12 Sep" must be the same day the server counted.
// The names are written out, not taken from `Intl`: the abbreviation of a month ("Sep" or "Sept")
// differs between browsers and language-data versions, and a chart label must not.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** "12 Sep" */
export const formatDayShort = (day: string) => {
    const date = asDate(day);
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

/** "Sat, 12 Sep 2026" */
export const formatDayLong = (day: string) => {
    const date = asDate(day);
    return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

/** "Week of 7 Sep": a week starts on Monday. */
export const formatWeek = (weekStart: string) => `Week of ${formatDayShort(weekStart)}`;

const number = new Intl.NumberFormat('en-GB');
/** 1234 -> "1,234" */
export const formatCount = (value: number) => number.format(value);

/** "83%" of `part` in `whole`, or "–" when there is no whole. */
export function formatShare(part: number, whole: number): string {
    return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
}
