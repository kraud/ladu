import type { RequestHandler } from 'msw';
import { makeAccessHandlers } from './accessHandlers';

/**
 * Base MSW handler set. With `onUnhandledRequest: 'error'` in `test/setup.ts`, any accidental
 * network call fails the test loudly. Per-feature handler factories (`authHandlers.ts`,
 * `wordHandlers.ts`, `metricsHandlers.ts`, …) are opted into per test via `server.use(...)`.
 * The one exception is `GET /api/access` (open): the register page asks for it on every render.
 */
export const handlers: RequestHandler[] = [...makeAccessHandlers()];
