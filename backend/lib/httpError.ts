/**
 * An error that carries the HTTP status to answer with. A controller catches it,
 * puts the status on `res` (the shared error handler reads `res.statusCode`), and
 * rethrows. Used where the check happens deep inside a transaction.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
