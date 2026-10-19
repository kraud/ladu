/**
 * Captcha (.context/plans/captcha.md): the server side of Cloudflare Turnstile.
 *
 * The browser widget gives the page a one-time token. The routes that do costly work for anyone
 * (demo start, registration, password reset) send that token in `captchaToken`; `assertCaptcha`
 * asks Cloudflare's `siteverify` endpoint if it is good. Only the server holds the secret key.
 *
 * - The check runs only while the admin switch is on AND both keys are set (C2, C3). Else it is a
 *   no-op, so a missing key can never lock people out.
 * - A token that Cloudflare refuses is always a 400 `captcha_failed` (C7).
 * - When Cloudflare cannot be reached, each route chooses (C6): the demo refuses with 503
 *   `captcha_unavailable`; registration and password reset go on and a warning goes to Sentry.
 */
const Sentry = require("@sentry/node");
const { getAccessSettings }: typeof import("./accessGate") = require("./accessGate");
const { HttpError }: typeof import("./httpError") = require("./httpError");

/** The `action` each widget sends. The token is only good for the route that it was made for (C8). */
export type CaptchaAction = "demo" | "register" | "password_reset";

export const CAPTCHA_CODE = {
  failed: "captcha_failed",
  unavailable: "captcha_unavailable",
} as const;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;
/** Turnstile tokens are at most 2048 characters. A longer value is junk: refuse it without a call. */
const MAX_TOKEN_LENGTH = 2048;

/** A captcha refusal: an HTTP status plus an `apiCode` that the error middleware sends as `code`. */
export class CaptchaError extends HttpError {
  constructor(
    status: number,
    readonly apiCode: string,
    message: string,
  ) {
    super(status, message);
  }
}

/** Both keys, read on each call (a test can change them), or `null` when one is missing. */
export const captchaKeys = (): { siteKey: string; secretKey: string } | null => {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
};

export type CaptchaResult = "ok" | "failed" | "unreachable";

/** Asks Cloudflare if a token is good for this action. Never throws. */
export const verifyCaptcha = async (
  token: unknown,
  secretKey: string,
  action: CaptchaAction,
  remoteIp?: string,
): Promise<CaptchaResult> => {
  if (typeof token !== "string" || token === "" || token.length > MAX_TOKEN_LENGTH) return "failed";

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return "unreachable";
    const result = (await response.json()) as { success?: boolean; action?: string };
    // A token made by another form (another `action`) is refused (C8). Test keys answer with no action.
    if (result.success === true && (result.action === undefined || result.action === action)) return "ok";
    return "failed";
  } catch {
    return "unreachable";
  }
};

/** The "keys are not set" warning goes to the log once per start, not on every request (C3). */
let warnedNoKeys = false;

export interface AssertCaptchaOptions {
  /** What to do when Cloudflare cannot be reached (C6). */
  onUnreachable: "refuse" | "allow";
}

/**
 * Refuses the request unless it carries a good token. Call it after the cheap input checks and
 * before any database write or counter (C9). It does not touch `res`: the caller maps the error
 * (`withStatus` for a controller that throws `HttpError`).
 */
export const assertCaptcha = async (
  req: { body?: { captchaToken?: unknown }; ip?: string },
  action: CaptchaAction,
  { onUnreachable }: AssertCaptchaOptions,
): Promise<void> => {
  const { captcha } = await getAccessSettings();
  if (!captcha.enabled) return;
  const keys = captchaKeys();
  if (!keys) {
    if (!warnedNoKeys) {
      warnedNoKeys = true;
      console.warn("The captcha switch is on, but the Turnstile keys are not set: the check is skipped.");
    }
    return;
  }

  const result = await verifyCaptcha(req.body?.captchaToken, keys.secretKey, action, req.ip);
  if (result === "ok") return;
  if (result === "failed") throw new CaptchaError(400, CAPTCHA_CODE.failed, "The captcha check failed");

  if (onUnreachable === "refuse") {
    throw new CaptchaError(503, CAPTCHA_CODE.unavailable, "The captcha check is not available right now");
  }
  Sentry.captureMessage(`Turnstile could not be reached: the ${action} request went on without the check`, "warning");
};
