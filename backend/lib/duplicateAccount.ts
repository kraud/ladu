import { HttpError } from "./httpError";

// Sign-up checks "email in use" and "username in use", then inserts. Two requests at
// the same moment both pass the check, and the second insert hits the unique constraint
// of the `users` table. That is Postgres error 23505. Without this helper it reached the
// client as a 500 (and used to carry the SQL text with it).
const MESSAGE_BY_CONSTRAINT: Record<string, string> = {
  users_email_unique: "Email already in use",
  users_username_unique: "Username already in use",
};

/**
 * If `error` is the unique-violation of a sign-up insert, return the same 400 error
 * the "already in use" check gives. Any other error is returned unchanged.
 * Drizzle wraps the Postgres error, so its code and constraint name are on `.cause`.
 */
export const asDuplicateAccountError = (error: unknown): unknown => {
  const pgError = (error as any)?.cause ?? error;
  if (pgError?.code !== "23505") return error;
  const message = MESSAGE_BY_CONSTRAINT[pgError.constraint];
  return message ? new HttpError(400, message) : error;
};
