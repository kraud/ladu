/**
 * Shared wire primitives — the shapes every feature's `api.ts` builds on.
 *
 * Kept deliberately small: `backend/middleware/errorMiddleware.js` only ever
 * emits `{ message }`, so `ApiError` has exactly one field. Cursor pagination
 * lands in Phase 3 with the Review table (`getWordsSimplified` + a
 * `useInfiniteQuery`); `CursorPage` is declared now so the shape is fixed
 * before the first consumer.
 */

/** The error body the backend returns (errorMiddleware.js): a message, and sometimes a machine-readable code. */
export interface ApiError {
    message: string;
    /** Set only where the backend wants the client to react to a specific case (the access gates). */
    code?: string;
}

/**
 * A page of a cursor-paginated list. `nextCursor === null` means the end.
 * `total` is the count matching the filters alone (not the page) — computed
 * server-side before the cursor predicate is applied, so it stays constant
 * across pages of the same filter set (Phase 3 Slice 6, `getWordsSimplified`).
 */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
    total: number;
}

/** Every backend id is a Postgres UUID string. */
export type Id = string;

/**
 * Narrow an unknown thrown value to the backend error body.
 * Axios puts the parsed response body on `error.response.data`.
 */
export function getApiErrorMessage(error: unknown): string | null {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: unknown } }).response;
        const data = response?.data;
        if (typeof data === 'object' && data !== null && 'message' in data) {
            const message = (data as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
    }
    return null;
}

/** The machine-readable `code` of a backend error body, when it has one. */
export function getApiErrorCode(error: unknown): string | null {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const data = (error as { response?: { data?: unknown } }).response?.data;
        if (typeof data === 'object' && data !== null && 'code' in data) {
            const code = (data as { code?: unknown }).code;
            if (typeof code === 'string') return code;
        }
    }
    return null;
}
