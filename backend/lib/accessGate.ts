/**
 * Access gates (.context/plans/access-gates.md): the owner switches registration
 * and login between 'open', 'closed' and 'limited'. This file holds the registration
 * side: reading the settings row, and the two checks `registerUser` and the Google
 * `signupComplete` share. The server always enforces the gate; the banner in the
 * learner app (`GET /api/access`) is only a courtesy.
 */
const { eq } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { accessSettings, registrationInvites, auditLog } = require("../src/db/schema");
const { HttpError }: typeof import("./httpError") = require("./httpError");

export type AccessMode = "open" | "closed" | "limited";

export interface AccessSettings {
  registrationMode: AccessMode;
  registrationNote: string;
  loginMode: AccessMode;
  loginNote: string;
}

/** Both `db` and a transaction can run these queries. */
export type GateExecutor = Pick<typeof db, "select" | "delete" | "insert">;

/** Machine-readable codes (HTTP 403). The learner app maps them to translated messages. */
export const GATE_CODE = {
  registrationClosed: "registration_closed",
  registrationNotInvited: "registration_not_invited",
} as const;

/** A refusal by a gate: 403 with an `apiCode` that the error middleware sends as `code`. */
export class AccessGateError extends HttpError {
  constructor(
    readonly apiCode: string,
    message: string,
  ) {
    super(403, message);
  }
}

const CLOSED_MESSAGE = "Sign-ups are closed for now";
// One message for every unlisted email: it must not reveal which emails are on the list.
const NOT_INVITED_MESSAGE = "Sign-ups are by invitation only right now";

/** One primary-key read, no cache: a change made in the admin panel works at once. */
export const getAccessSettings = async (executor: GateExecutor = db): Promise<AccessSettings> => {
  const [row] = await executor.select().from(accessSettings).where(eq(accessSettings.id, 1)).limit(1);
  // The migration inserts the row. Without it, act as open (never lock people out by accident).
  return {
    registrationMode: (row?.registrationMode ?? "open") as AccessMode,
    registrationNote: row?.registrationNote ?? "",
    loginMode: (row?.loginMode ?? "open") as AccessMode,
    loginNote: row?.loginNote ?? "",
  };
};

/** Invites are stored trimmed and lowercase, so the unique constraint ignores case. */
export const normalizeInviteEmail = (email: string): string => email.trim().toLowerCase();

/**
 * First check, before the "email already in use" check, so a closed or limited gate
 * does not leak which emails exist. Read only: the invite itself is taken inside the
 * transaction by `consumeInvite`.
 */
export const assertRegistrationAllowed = async (email: string): Promise<AccessMode> => {
  const { registrationMode } = await getAccessSettings();
  if (registrationMode === "closed") {
    throw new AccessGateError(GATE_CODE.registrationClosed, CLOSED_MESSAGE);
  }
  if (registrationMode === "limited") {
    const [invite] = await db
      .select({ id: registrationInvites.id })
      .from(registrationInvites)
      .where(eq(registrationInvites.email, normalizeInviteEmail(email)))
      .limit(1);
    if (!invite) throw new AccessGateError(GATE_CODE.registrationNotInvited, NOT_INVITED_MESSAGE);
  }
  return registrationMode;
};

/**
 * Second check, inside the transaction that inserts the user. Deletes the invite for
 * this email in the same transaction, so two parallel sign-ups with one invite cannot
 * both pass (the second finds no row). If the transaction rolls back, the invite stays.
 * `limited` with no invite row rolls back with `registration_not_invited`. `open` also
 * takes a matching invite (it was used), but never needs one. Each use writes an audit
 * row with no staff member, so the audit page shows it.
 */
export const consumeInvite = async (tx: GateExecutor, email: string, mode: AccessMode): Promise<void> => {
  const normalized = normalizeInviteEmail(email);
  const [taken] = await tx
    .delete(registrationInvites)
    .where(eq(registrationInvites.email, normalized))
    .returning({ id: registrationInvites.id });

  if (!taken) {
    if (mode === "limited") throw new AccessGateError(GATE_CODE.registrationNotInvited, NOT_INVITED_MESSAGE);
    return;
  }

  await tx.insert(auditLog).values({
    staffId: null,
    action: "access.invite_used",
    targetType: "registration_invite",
    targetId: taken.id,
    metadata: { email: normalized },
  });
};
