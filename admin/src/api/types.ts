/** The error body the backend's errorHandler sends: `{ message }`. */
export interface ApiError {
    message?: string;
}

/** What `POST /api/admin/auth/login` returns. */
export interface StaffLoginResponse {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'support' | 'viewer';
    token: string;
}
