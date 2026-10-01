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

export type GateName = 'registration' | 'login';

/** `GET /api/admin/access` */
export interface AccessState {
    registration: { mode: AccessMode; note: string };
    login: { mode: AccessMode; note: string };
    /** One row holds both gates, so this is the last change to either one. */
    updatedAt: string | null;
    updatedBy: string | null;
    invites: Invite[];
    loginAllowed: AllowedAccount[];
    counts: { invites: number; loginAllowed: number };
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
