export type AccessMode = 'open' | 'closed' | 'limited';

export interface Invite {
    id: string;
    email: string;
    createdAt: string;
    /** The staff member who added it; null if that account was removed. */
    addedBy: string | null;
}

/** `GET /api/admin/access` */
export interface AccessState {
    registration: { mode: AccessMode; note: string };
    /** Read only until the login gate exists. */
    login: { mode: AccessMode; note: string };
    updatedAt: string | null;
    updatedBy: string | null;
    invites: Invite[];
    counts: { invites: number };
}

export type SkipReason = 'invalid' | 'duplicate_in_request' | 'already_listed' | 'has_account';

/** `POST /api/admin/access/invites`: what happened to each email, then the new state. */
export interface AddInvitesResult extends AccessState {
    added: string[];
    skipped: { email: string; reason: SkipReason }[];
}

export const MODES: { value: AccessMode; label: string; description: string }[] = [
    { value: 'open', label: 'Open', description: 'Anybody can register.' },
    { value: 'closed', label: 'Closed', description: 'Nobody can register. A banner tells visitors.' },
    {
        value: 'limited',
        label: 'Limited',
        description: 'Only emails on the invite list can register. An email leaves the list when that person registers.',
    },
];

export const SKIP_REASONS: Record<SkipReason, string> = {
    invalid: 'not a valid email',
    duplicate_in_request: 'repeated in this list',
    already_listed: 'already on the invite list',
    has_account: 'already has an account',
};

export const MAX_NOTE_LENGTH = 300;
export const MAX_EMAILS_PER_REQUEST = 500;
