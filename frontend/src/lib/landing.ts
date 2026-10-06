/**
 * Where the public pages live. The Terms and the Privacy Policy are pages of
 * the landing site (`landing/terms.html`, `landing/privacy.html`), not of the
 * app. One address serves staging and production: the legal text is the same.
 *
 * The landing site hardcodes the app's address the same way
 * (`APP_ORIGIN` in `landing/app.js`). See `lib/handoff.ts` for the other
 * direction.
 */
export const LANDING_ORIGIN = 'https://ladu.com.ar';

export const termsUrl = `${LANDING_ORIGIN}/terms.html`;
export const privacyUrl = `${LANDING_ORIGIN}/privacy.html`;
