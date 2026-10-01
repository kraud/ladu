/**
 * Access gates (.context/plans/access-gates.md): the owner switches registration
 * and login between 'open', 'closed' and 'limited'. This file reads the settings row and
 * holds both gates: the two registration checks that `registerUser` and the Google
 * `signupComplete` share, and the login check that every sign-in path runs after the
 * password and ban checks. The server always enforces the gate; the banner in the
 * learner app (`GET /api/access`) is only a courtesy. Staff never pass through a gate:
 * they sign in through their own routes (`staff_accounts`), so an owner can always reopen it.
 */
const { eq } = require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const { accessSettings, registrationInvites, loginAllowedUsers, auditLog } = require("../src/db/schema");
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
  loginClosed: "login_closed",
  loginNotAllowed: "login_not_allowed",
} as const;

export type LoginBlockCode = typeof GATE_CODE.loginClosed | typeof GATE_CODE.loginNotAllowed;

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

const LOGIN_MESSAGES: Record<LoginBlockCode, string> = {
  login_closed: "Sign-in is closed for now",
  login_not_allowed: "Sign-in is limited right now",
};

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

/**
 * Why this account may not sign in right now, or `null` if it may. `open`: always allowed.
 * `closed`: nobody. `limited`: only an account on `login_allowed_users` (by user id). Read
 * on each call, with no cache, so a change works at once and an account that is added to
 * the list can sign in on its next try.
 *
 * Call it only AFTER the password and ban checks, so a refusal never confirms that an
 * account exists: a wrong password still says "Invalid credentials".
 */
export const getLoginBlock = async (userId: string, executor: GateExecutor = db): Promise<LoginBlockCode | null> => {
  const { loginMode } = await getAccessSettings(executor);
  if (loginMode === "open") return null;
  if (loginMode === "closed") return GATE_CODE.loginClosed;

  const [allowed] = await executor
    .select({ userId: loginAllowedUsers.userId })
    .from(loginAllowedUsers)
    .where(eq(loginAllowedUsers.userId, userId))
    .limit(1);
  return allowed ? null : GATE_CODE.loginNotAllowed;
};

/** `getLoginBlock`, as a refusal: puts 403 on `res` and throws an error that carries the code. */
export const enforceLoginGate = async (res: any, userId: string): Promise<void> => {
  const code = await getLoginBlock(userId);
  if (!code) return;
  res.status(403);
  throw new AccessGateError(code, LOGIN_MESSAGES[code]);
};

/** The message for a block code, for a path that answers it without an error (a verified email, a new account). */
export const loginBlockMessage = (code: LoginBlockCode): string => LOGIN_MESSAGES[code];
