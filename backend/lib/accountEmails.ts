/**
 * The two account emails (verification and password reset), shared by the
 * public handlers (`userController.ts`) and the admin actions. Each function
 * writes the token row with the executor it is given (a transaction, for the
 * admin actions) and returns a function that sends the email. The caller runs
 * that function only after the write is committed, so no email is sent for a
 * change that rolled back.
 *
 * `sendMail` never rejects and its result is not awaited: delivery is unknown.
 */
const crypto = require("crypto");
const { eq } = require("drizzle-orm");
const { tokens, passwordResetTokens } = require("../src/db/schema");
const sendMail = require("../utils/sendEmail");

/** Both `db` and a transaction can run queries. */
type Executor = Pick<typeof import("../src/db").db, "select" | "insert">;

export interface MailRecipient {
  id: string;
  email: string;
  name: string;
  uiLanguage: string | null;
}

export type SendEmail = () => void;

const dispatch = (
  user: MailRecipient,
  type: "verifyEmail" | "resetPassword",
  url: string,
  failureMessage: string,
): SendEmail => () => {
  sendMail({
    email: user.email,
    url,
    name: user.name,
    type,
    language: user.uiLanguage,
  }).catch((error: unknown) => console.error(failureMessage, error));
};

/**
 * Reuses the user's outstanding verification token (`tokens.userId` is unique and
 * the link never expires, so every email stays valid) or creates one.
 */
export const issueVerificationEmail = async (user: MailRecipient, executor: Executor): Promise<SendEmail> => {
  const [existing] = await executor.select().from(tokens).where(eq(tokens.userId, user.id)).limit(1);
  let token = existing?.token;
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    await executor.insert(tokens).values({ userId: user.id, token });
  }

  const url = `${process.env.BASE_URL}/user/${user.id}/verify/${token}`;
  return dispatch(user, "verifyEmail", url, "Failed to send verification email:");
};

/**
 * Always a new row: a user may have several outstanding reset requests (for
 * example one per device) until one is used.
 */
export const issuePasswordResetEmail = async (user: MailRecipient, executor: Executor): Promise<SendEmail> => {
  const token = crypto.randomBytes(32).toString("hex");
  await executor.insert(passwordResetTokens).values({ userId: user.id, token });

  const url = `${process.env.BASE_URL}/resetPassword/${user.id}/${token}`;
  return dispatch(user, "resetPassword", url, "Failed to send password reset email:");
};
