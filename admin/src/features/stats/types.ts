export interface WindowCount {
    /** `null`: no data for this day (the history had not started yet). */
    count: number | null;
    /** True when the window includes the first, incomplete day of the history: the count is a lower bound. */
    partial: boolean;
}

export interface ActivityPoint {
    day: string;
    daily: WindowCount;
    /** Users active in the 7 days that end on `day`. */
    weekly: WindowCount;
    /** Users active in the 30 days that end on `day`. */
    monthly: WindowCount;
}

export interface StatsResponse {
    generatedAt: string;
    /** The current day in UTC, `YYYY-MM-DD`. */
    today: string;
    totals: {
        users: number;
        verified: number;
        unverified: number;
        banned: number;
        pendingDeletion: number;
        words: number;
        translations: number;
        tags: number;
        savedSessions: number;
        practisedTranslations: number;
    };
    signups: {
        daily: { day: string; count: number }[];
        weekly: { weekStart: string; count: number }[];
    };
    active: {
        /** The first day with a recorded row, or `null` while nothing has been recorded. */
        since: string | null;
        points: ActivityPoint[];
    };
    languages: { language: string; users: number }[];
}
