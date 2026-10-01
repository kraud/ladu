/** The error body the backend's errorHandler sends: `{ message }`. */
export interface ApiError {
    message?: string;
    /** Set only for a case the UI reacts to, for example `password_change_required`. */
    code?: string;
}

/** What `POST /api/admin/auth/login` returns. */
export interface StaffLoginResponse {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'support' | 'viewer';
    permissions: string[];
    mustChangePassword: boolean;
    environment: string;
    token: string;
}
