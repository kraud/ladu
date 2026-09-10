import type { RequestHandler } from 'msw';

/**
 * Base MSW handler set. Empty in Slice 2 — with `onUnhandledRequest: 'error'`
 * in `test/setup.ts`, any accidental network call fails the test loudly.
 * Auth handlers arrive in Slice 3, metrics in Phase 3.5; per-test overrides go
 * through `server.use(...)`.
 */
export const handlers: RequestHandler[] = [];
