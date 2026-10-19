/**
 * Access requests (.context/plans/access-requests.md): people who asked for access from the
 * public /request page while a gate was limited or closed. A request is not a permission; the
 * owner approves it in the admin panel, and only then does the email reach the invite list
 * (kind `registration`) or the allowed accounts (kind `login`).
 */
const { and, eq, inArray } = require("drizzle-orm");
const { accessRequests } = require("../src/db/schema");
const { HttpError }: typeof import("./httpError") = require("./httpError");

export type AccessRequestKind = "registration" | "login";

/** The gate for this kind is open, so a request is not needed (409). The state is public: the banner shows it. */
export class AccessRequestError extends HttpError {
  constructor(
    status: number,
    readonly apiCode: string,
    message: string,
  ) {
    super(status, message);
  }
}

/** The most pending requests for each kind. A flood of fake emails cannot grow the table without end. */
export const MAX_PENDING_REQUESTS = 1000;

/**
 * Deletes the requests of one kind for these emails (lowercase). Called whenever someone gets
 * access by any path, so a request never stays after the answer. Takes `db` or a transaction.
 */
export const clearAccessRequests = async (
  executor: { delete: (table: any) => any },
  kind: AccessRequestKind,
  emails: string[],
): Promise<void> => {
  if (emails.length === 0) return;
  await executor.delete(accessRequests).where(and(eq(accessRequests.kind, kind), inArray(accessRequests.email, emails)));
};
