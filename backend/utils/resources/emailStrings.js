// Localized strings for the two transactional emails (account confirmation +
// password reset). Keyed by the exact `Lang` enum label the frontend sends
// as `uiLanguage`/`languages` entries ("English" | "Spanish" | "German" |
// "Estonian" — the SUPPORTED_LANGUAGES list in userController.ts). There is
// no i18n library on the backend and this is its only localized surface, so
// a plain dictionary is enough — do not read the frontend's
// `public/locales/*` bundles here, the Docker image only copies `backend/`.
//
// Each send resolves its language from data already on hand at the call
// site (the freshly-registered account's `uiLanguage`, or the stored
// `users.uiLanguage` for a reset) — never from the request itself.
"use strict";

const STRINGS = {
  English: {
    preheaderVerify: "Confirm your email address to activate your Ladu account",
    eyebrowVerify: "Ladu · Account",
    subjectVerify: "Confirm your email",
    titleVerify: "Confirm your email",
    greeting: (name) => `Hi ${name},`,
    bodyVerify:
      "Thanks for creating a Ladu account. Confirm this email address to activate your account and start building your multilingual vocabulary.",
    ctaVerify: "Confirm email address",
    fallbackLead: "Or paste this link into your browser:",
    ignoreVerify: "Didn't create a Ladu account? You can safely ignore this email — nothing will be activated.",

    preheaderReset: "Reset link for your Ladu account",
    eyebrowReset: "Ladu · Password reset",
    subjectReset: "Password reset link",
    titleReset: "Reset your password",
    bodyReset: (email) =>
      `We received a request to reset the password for the Ladu account ${email}. Click below to choose a new password.`,
    ctaReset: "Choose a new password",
    expiryReset: "This link expires in 30 minutes and can be used only once.",
    ignoreReset: "Didn't request a password reset? You can safely ignore this email — your password will stay unchanged.",

    footerTagline: "Multilingual vocabulary builder",
    footerNote: "You received this email because of activity on your Ladu account. Replies to this address are not monitored.",
  },
  Spanish: {
    preheaderVerify: "Confirma tu correo electrónico para activar tu cuenta de Ladu",
    eyebrowVerify: "Ladu · Cuenta",
    subjectVerify: "Confirma tu correo electrónico",
    titleVerify: "Confirma tu correo electrónico",
    greeting: (name) => `Hola ${name},`,
    bodyVerify:
      "Gracias por crear una cuenta en Ladu. Confirma este correo electrónico para activar tu cuenta y empezar a construir tu vocabulario multilingüe.",
    ctaVerify: "Confirmar correo electrónico",
    fallbackLead: "O copia este enlace en tu navegador:",
    ignoreVerify: "¿No creaste una cuenta en Ladu? Puedes ignorar este correo sin problema — no se activará nada.",

    preheaderReset: "Enlace de restablecimiento para tu cuenta de Ladu",
    eyebrowReset: "Ladu · Restablecer contraseña",
    subjectReset: "Enlace para restablecer tu contraseña",
    titleReset: "Restablece tu contraseña",
    bodyReset: (email) =>
      `Recibimos una solicitud para restablecer la contraseña de la cuenta de Ladu ${email}. Haz clic abajo para elegir una nueva contraseña.`,
    ctaReset: "Elegir una nueva contraseña",
    expiryReset: "Este enlace expira en 30 minutos y solo puede usarse una vez.",
    ignoreReset: "¿No solicitaste restablecer tu contraseña? Puedes ignorar este correo sin problema — tu contraseña no cambiará.",

    footerTagline: "Constructor de vocabulario multilingüe",
    footerNote: "Recibiste este correo por actividad en tu cuenta de Ladu. Las respuestas a esta dirección no se supervisan.",
  },
  German: {
    preheaderVerify: "Bestätige deine E-Mail-Adresse, um dein Ladu-Konto zu aktivieren",
    eyebrowVerify: "Ladu · Konto",
    subjectVerify: "Bestätige deine E-Mail",
    titleVerify: "Bestätige deine E-Mail",
    greeting: (name) => `Hallo ${name},`,
    bodyVerify:
      "Danke, dass du ein Ladu-Konto erstellt hast. Bestätige diese E-Mail-Adresse, um dein Konto zu aktivieren und mit dem Aufbau deines mehrsprachigen Wortschatzes zu beginnen.",
    ctaVerify: "E-Mail-Adresse bestätigen",
    fallbackLead: "Oder füge diesen Link in deinen Browser ein:",
    ignoreVerify: "Kein Ladu-Konto erstellt? Du kannst diese E-Mail einfach ignorieren — es wird nichts aktiviert.",

    preheaderReset: "Link zum Zurücksetzen für dein Ladu-Konto",
    eyebrowReset: "Ladu · Passwort zurücksetzen",
    subjectReset: "Link zum Zurücksetzen des Passworts",
    titleReset: "Setze dein Passwort zurück",
    bodyReset: (email) =>
      `Wir haben eine Anfrage erhalten, das Passwort für das Ladu-Konto ${email} zurückzusetzen. Klicke unten, um ein neues Passwort zu wählen.`,
    ctaReset: "Neues Passwort wählen",
    expiryReset: "Dieser Link ist 30 Minuten gültig und kann nur einmal verwendet werden.",
    ignoreReset: "Kein Zurücksetzen des Passworts angefordert? Du kannst diese E-Mail einfach ignorieren — dein Passwort bleibt unverändert.",

    footerTagline: "Mehrsprachiger Wortschatz-Aufbau",
    footerNote: "Du hast diese E-Mail aufgrund einer Aktivität in deinem Ladu-Konto erhalten. Antworten an diese Adresse werden nicht überwacht.",
  },
  Estonian: {
    preheaderVerify: "Kinnita oma e-posti aadress, et aktiveerida oma Ladu konto",
    eyebrowVerify: "Ladu · Konto",
    subjectVerify: "Kinnita oma e-post",
    titleVerify: "Kinnita oma e-post",
    greeting: (name) => `Tere ${name},`,
    bodyVerify:
      "Täname, et lõid Ladu konto. Kinnita see e-posti aadress, et konto aktiveerida ja alustada oma mitmekeelse sõnavara kogumist.",
    ctaVerify: "Kinnita e-posti aadress",
    fallbackLead: "Või kleebi see link oma brauserisse:",
    ignoreVerify: "Ei loonud Ladu kontot? Võid selle e-kirja rahulikult ignoreerida — midagi ei aktiveerita.",

    preheaderReset: "Sinu Ladu konto lähtestamise link",
    eyebrowReset: "Ladu · Parooli lähtestamine",
    subjectReset: "Parooli lähtestamise link",
    titleReset: "Lähtesta oma parool",
    bodyReset: (email) =>
      `Saime taotluse lähtestada Ladu konto ${email} parool. Vajuta allpool, et valida uus parool.`,
    ctaReset: "Vali uus parool",
    expiryReset: "See link aegub 30 minuti pärast ja seda saab kasutada ainult üks kord.",
    ignoreReset: "Ei taotlenud parooli lähtestamist? Võid selle e-kirja rahulikult ignoreerida — sinu parool jääb samaks.",

    footerTagline: "Mitmekeelse sõnavara looja",
    footerNote: "Said selle e-kirja oma Ladu konto tegevuse tõttu. Sellele aadressile vastamist ei jälgita.",
  },
};

/** `"Spanish"` → its strings; unrecognized/missing → English, so a send never fails on a bad language value. */
function stringsFor(language) {
  return STRINGS[language] || STRINGS.English;
}

module.exports = { stringsFor };
