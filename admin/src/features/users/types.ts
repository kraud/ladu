export type UserStatus = 'active' | 'banned' | 'deleted';

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    username: string;
    verified: boolean;
    status: UserStatus;
    createdAt: string;
    lastLoginAt: string | null;
    lastLoginCountry: string | null;
    lastSeenAt: string | null;
    bannedAt: string | null;
    deletedAt: string | null;
    hasPassword: boolean;
    hasGoogle: boolean;
    /** On the login allowed list? `null`: this staff role may not see it. */
    loginAllowed: boolean | null;
}

export interface UserListResponse {
    items: UserListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface UserDetail {
    id: string;
    name: string;
    email: string;
    username: string;
    languages: string[];
    uiLanguage: string | null;
    nativeLanguage: string | null;
    theme: string | null;
    verified: boolean;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    lastLoginCountry: string | null;
    lastSeenAt: string | null;
    bannedAt: string | null;
    banReason: string | null;
    deletedAt: string | null;
    deletedByStaffName: string | null;
    hasPassword: boolean;
    /** On the login allowed list? `null`: this staff role may not see it. */
    loginAllowed: boolean | null;
    identities: { provider: string; emailAtLink: string; linkedAt: string }[];
    counts: { words: number; translations: number; tags: number; friends: number; practiceSessions: number };
    recentLogins: { id: string; method: string; country: string | null; createdAt: string }[];
    /** `null`: this staff role may not read the audit log. `[]`: nothing recorded yet. */
    audit: { id: string; action: string; reason: string | null; staffName: string; createdAt: string }[] | null;
}
