/**
 * Shared wire primitives — the shapes every feature's `api.ts` builds on.
 *
 * Kept deliberately small: `backend/middleware/errorMiddleware.js` only ever
 * emits `{ message }`, so `ApiError` has exactly one field. Cursor pagination
 * lands in Phase 3 with the Review table (`getWordsSimplified` + a
 * `useInfiniteQuery`); `CursorPage` is declared now so the shape is fixed
 * before the first consumer.
 */

/** The only error body the backend returns (errorMiddleware.js). */
export interface ApiError {
    message: string;
}

/** A page of a cursor-paginated list. `nextCursor === null` means the end. */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
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
