/**
 * What the backend reports to Sentry (api/index.js starts it, app.js wires the handler):
 * crashes only, and never what the person sent (passwords, login tokens, cookies, words).
 * The app has the same rules in `frontend/src/lib/sentry.ts`.
 */
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/node';

const Sentry = require('@sentry/node');

/** Text that can be in any part of a report, and what replaces it. */
const SECRETS: [RegExp, string][] = [
  // The token of an emailed link: `.../verify/:token`, `/resetPassword/:id/:token`.
  [/(\/verify\/|\/resetPassword\/[^/\s"'?#]+\/)[^/\s"'?#]+/gi, '$1[token]'],
  // The word in a dictionary address, ours and the Estonian dictionary's.
  [/(\/dictionary\/(?:translate\/)?[^/\s"'?#]+\/[^/\s"'?#]+\/)[^\s"'?#]+/gi, '$1[word]'],
  [/(\/api\/word\/ids\/)[^/\s"'?#]+/gi, '$1[word]'],
  // The values of a failed database query. Drizzle writes them after the SQL text.
  [/(Failed query:[\s\S]*?\nparams:)[\s\S]*$/, '$1 [removed]'],
];

const scrubText = (text: string): string =>
  SECRETS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);

/** Applies `scrubText` to every string of a report, in place. */
const scrub = (value: any, seen = new Set<object>()): any => {
  if (typeof value === 'string') return scrubText(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) {
    // The SDK's own working data (it holds the live request). It is never sent.
    if (key !== 'sdkProcessingMetadata') value[key] = scrub(value[key], seen);
  }
  return value;
};

/** Postgres quotes the refused value in its message (`invalid input syntax for type uuid: "x"`). */
const scrubDatabaseMessage = (message: string): string =>
  message.replace(/: "[\s\S]*$/, ': [removed]').replace(/^value "[\s\S]*" is out of range/, 'value [removed] is out of range');

/** True for an error that Postgres sent, also when another error wraps it. */
const isFromDatabase = (error: any): boolean => !!error && (typeof error.severity === 'string' || isFromDatabase(error.cause));

/** `Sentry.init` settings. By default the SDK collects almost everything about a request. */
export const sentryOptions = {
  // No bodies, cookies, query values, user data, database data or local variables. Headers
  // stay, and the SDK hides the sensitive ones (operator guide 04, "Sentry").
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    queues: false,
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
    frameContextLines: 7,
  },
  // The SDK would report a route error before `reportCrash` can tell a refusal from a crash.
  integrations: [Sentry.expressIntegration({ shouldHandleError: false })],
  // A console line can hold a word, an email address or the values of a query.
  beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    return breadcrumb.category === 'console' ? null : breadcrumb;
  },
  beforeSend(event: ErrorEvent, hint?: EventHint): ErrorEvent {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers?.authorization;
      delete event.request.headers?.cookie;
      const referer = event.request.headers?.referer;
      if (referer) event.request.headers!.referer = referer.split(/[?#]/)[0];
    }
    if (isFromDatabase(hint?.originalException)) {
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubDatabaseMessage(exception.value);
      }
    }
    return scrub(event);
  },
};

/**
 * The Express error handler that reports crashes. It runs before `errorHandler`.
 * A refusal is not a crash. It has a 4xx status on the response (`res.status(400)`) or on the
 * error (a body that is not valid JSON).
 */
export const reportCrash = (error: any, _req: any, res: any, next: (error: unknown) => void): void => {
  const status = error?.status ?? error?.statusCode ?? (res.statusCode >= 400 ? res.statusCode : 500);
  const refused = status < 500 || (res.statusCode >= 400 && res.statusCode < 500);
  if (!refused) Sentry.captureException(error, { mechanism: { type: 'express', handled: false } });
  next(error);
};
