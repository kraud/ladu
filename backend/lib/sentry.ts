/**
 * What the backend reports to Sentry (api/index.js starts it, app.js wires the handler):
 * crashes only, and never what the person sent (passwords, login tokens, cookies, words).
 */
import type { ErrorEvent } from '@sentry/node';

/** `Sentry.init` settings. The SDK attaches the whole request to a report by default. */
export const sentryOptions = {
  beforeSend(event: ErrorEvent): ErrorEvent {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers?.authorization;
      delete event.request.headers?.cookie;
    }
    return event;
  },
};

/**
 * Runs before Sentry's error handler. A refusal sets the status on the response
 * (`res.status(400)`), and Sentry reads it from the error only: without this it reports every
 * refusal, such as a wrong password, as a crash.
 */
export const markRefusal = (error: any, _req: any, res: any, next: (error: unknown) => void): void => {
  if (error && res.statusCode >= 400 && res.statusCode < 500) error.status ??= res.statusCode;
  next(error);
};
