/** Small helpers the admin controllers share for reading a request and answering an error. */
const { HttpError }: typeof import('./httpError') = require('./httpError');

export const MAX_REASON_LENGTH = 500;

/** The optional (or required) `reason` text of an admin action. */
export const readReason = (body: unknown, required = false): string => {
  const raw = (body as { reason?: unknown } | undefined)?.reason;
  if (raw !== undefined && typeof raw !== 'string') throw new HttpError(400, 'Reason must be text');
  const reason = (raw ?? '').trim();
  if (required && !reason) throw new HttpError(400, 'A reason is required');
  if (reason.length > MAX_REASON_LENGTH) throw new HttpError(400, `Reason must be at most ${MAX_REASON_LENGTH} characters`);
  return reason;
};

/** Runs `work`; an `HttpError` becomes the response status (the shared error handler reads it from `res`). */
export const withStatus = async <T>(res: any, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) res.status(error.status);
    throw error;
  }
};
