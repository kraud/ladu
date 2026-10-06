/**
 * The version of the Terms and Conditions a new account accepted.
 *
 * It is the "Last updated" date of `landing/terms.html`. The registration form
 * shows a note ("By creating an account you ... accept the Terms"), and the
 * server writes this value and the time on the new `users` row, as the record
 * of what applied when the account was made.
 *
 * Change this value in the same commit as the date on the Terms page, when the
 * Terms change in a meaningful way. Existing accounts keep the old value.
 * (.context/plans/landing-terms-licences-blog.md, section 2)
 */
export const TERMS_VERSION = "2026-10-06";

/** The two `users` columns that record acceptance, for an insert at account creation. */
export function termsAcceptance(now: Date = new Date()) {
  return { termsAcceptedAt: now, termsVersion: TERMS_VERSION };
}
