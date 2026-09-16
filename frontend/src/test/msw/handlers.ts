import type { RequestHandler } from 'msw';

/**
 * Base MSW handler set. Empty — with `onUnhandledRequest: 'error'` in
 * `test/setup.ts`, any accidental network call fails the test loudly.
 * Per-feature handler factories (`authHandlers.ts`, `wordHandlers.ts`,
 * `metricsHandlers.ts`, …) are opted into per test via `server.use(...)`.
 */
export const handlers: RequestHandler[] = [];
