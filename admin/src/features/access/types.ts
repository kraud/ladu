export type AccessMode = 'open' | 'closed' | 'limited';

export interface Invite {
    id: string;
    email: string;
    createdAt: string;
    /** The staff member who added it; null if that account was removed. */
    addedBy: string | null;
}

/** An account on the login allowed list. */
export interface AllowedAccount {
    userId: string;
    name: string;
    email: string;
    status: 'active' | 'banned' | 'deleted';
    addedAt: string;
    /** The staff member who added it; null if that account was removed. */
    addedBy: string | null;
}

/** A request from the public /request page (access-requests.md), waiting for the owner. */
export interface AccessRequest {
    id: string;
    email: string;
    createdAt: string;
}

/** A `login` request carries the account with the same email; `null` when none exists (Approve is off). */
export interface LoginRequest extends AccessRequest {
    account: { userId: string; name: string; status: 'active' | 'banned' | 'deleted' } | null;
}

export type GateName = 'registration' | 'login';

/** The demo gate and its caps (demo-access.md). Independent of the registration and login gates. */
export interface DemoSettings {
    enabled: boolean;
    durationMinutes: number;
    maxWords: number;
    maxTags: number;
    /** The most demos that may be live at one time. */
    maxLive: number;
}

/** The same bounds as the server (`DEMO_BOUNDS` in backend/lib/accessGate.ts) and the database `CHECK`s. */
export const DEMO_BOUNDS = {
    durationMinutes: { min: 1, max: 1440 },
    maxWords: { min: 0, max: 500 },
    maxTags: { min: 0, max: 50 },
    maxLive: { min: 1, max: 1000 },
} as const;

/** `GET /api/admin/access` */
export interface AccessState {
    registration: { mode: AccessMode; note: string };
    login: { mode: AccessMode; note: string };
    demo: DemoSettings;
    /** The first-login onboarding switch (onboarding.md D26). Independent of the gates above. */
    onboarding: { enabled: boolean };
    /** Accounts by onboarding status; accounts without one (older, demo) are not counted. */
    onboardingCounts: { pending: number; done: number; skipped: number };
    /** The Turnstile captcha switch (captcha.md C2). `configured`: both keys are set on the server. */
    captcha: { enabled: boolean; configured: boolean };
    /** One row holds every gate, so this is the last change to any of them. */
    updatedAt: string | null;
    updatedBy: string | null;
    invites: Invite[];
    loginAllowed: AllowedAccount[];
    /** Requests from the public /request page, by the list that approval adds them to. */
    requests: { registration: AccessRequest[]; login: LoginRequest[] };
    /** `liveDemos`: demos running now (not expired), to compare with `demo.maxLive`. */
    counts: { invites: number; loginAllowed: number; requestsRegistration: number; requestsLogin: number; liveDemos: number };
}

export type SkipReason = 'invalid' | 'duplicate_in_request' | 'already_listed' | 'has_account';

/** `POST /api/admin/access/invites`: what happened to each email, then the new state. */
export interface AddInvitesResult extends AccessState {
    added: string[];
    skipped: { email: string; reason: SkipReason }[];
}

export const MODES: Record<GateName, { value: AccessMode; label: string; description: string }[]> = {
    registration: [
        { value: 'open', label: 'Open', description: 'Anybody can register.' },
        { value: 'closed', label: 'Closed', description: 'Nobody can register. A banner tells visitors.' },
        {
            value: 'limited',
            label: 'Limited',
            description: 'Only emails on the invite list can register. An email leaves the list when that person registers.',
        },
    ],
    login: [
        { value: 'open', label: 'Open', description: 'Anybody with an account can sign in.' },
        { value: 'closed', label: 'Closed', description: 'Nobody can sign in. A banner tells visitors.' },
        { value: 'limited', label: 'Limited', description: 'Only accounts on the allowed list can sign in.' },
    ],
};

export const SKIP_REASONS: Record<SkipReason, string> = {
    invalid: 'not a valid email',
    duplicate_in_request: 'repeated in this list',
    already_listed: 'already on the invite list',
    has_account: 'already has an account',
};

export type AllowSkipReason = 'invalid' | 'duplicate_in_request' | 'unknown' | 'deleted' | 'already_allowed';

/** `POST /api/admin/access/login-allowed`: what happened to each entry, then the new state. */
export interface AllowLoginResult extends AccessState {
    added: { userId: string; email: string }[];
    skipped: { value: string; reason: AllowSkipReason }[];
}

/** `POST /api/admin/access/login-allowed/remove` */
export interface DisallowManyResult extends AccessState {
    removed: number;
    skipped: number;
}

export const ALLOW_SKIP_REASONS: Record<AllowSkipReason, string> = {
    invalid: 'not a valid email or id',
    duplicate_in_request: 'repeated in this list',
    unknown: 'no account with this email or id',
    deleted: 'the account is deleted',
    already_allowed: 'already on the allowed list',
};

/** The owner must type this to sign every learner out. The server checks it too. */
export const SIGN_OUT_PHRASE = 'SIGN OUT EVERYONE';

export const MAX_NOTE_LENGTH = 300;
export const MAX_EMAILS_PER_REQUEST = 500;

/** A demo account on the DB now (`GET /api/admin/access/demo/users`, demo-access.md D19). */
export interface DemoUserRow {
    id: string;
    /** Live: time left. Expired: the nightly purge has not deleted it yet. */
    status: 'live' | 'expired';
    startedAt: string;
    expiresAt: string;
    languages: string[];
    uiLanguage: string | null;
    /** What the visitor added on top of the sample data. Null for a demo started before the start log. */
    wordsAdded: number | null;
    tagsAdded: number | null;
    configsAdded: number | null;
    translationsPractised: number | null;
    /** The word and tag caps of this demo (frozen when it started). */
    maxWords: number | null;
    maxTags: number | null;
}

export interface DemoUsers {
    /** Every demo on the DB; `rows` holds the newest, at most `DEMO_USERS_LIMIT`. */
    total: number;
    rows: DemoUserRow[];
}

export const DEMO_USERS_LIMIT = 200;

export type DemoRefusalCode = 'demo_disabled' | 'demo_rate_limited' | 'demo_busy' | 'demo_unavailable' | 'captcha_failed';

/** `GET /api/admin/access/demo/stats` (D20). */
export interface DemoStats {
    starts: { last24h: number; last7d: number; last30d: number; total: number };
    runningNow: number;
    /** The engagement, cap and language numbers cover the starts of these last days. */
    windowDays: number;
    engagement: { demos: number; avgWordsAdded: number; avgTagsAdded: number; avgTranslationsPractised: number; addedAWord: number };
    caps: { wordCapDemos: number; reachedWordCap: number; tagCapDemos: number; reachedTagCap: number };
    refusalWindowDays: number;
    refusals: Record<DemoRefusalCode, number>;
    languages: { language: string; count: number }[];
    uiLanguages: { language: string; count: number }[];
}

