// Localized strings for the two transactional emails (account confirmation +
// password reset). Keyed by the exact `Lang` enum label the frontend sends
// as `uiLanguage`/`languages` entries ("English" | "Spanish" | "German" |
// "Estonian" | "French" — the language table in lib/languages.ts). There is
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

    preheaderInvite: "You are invited to register in Ladu",
    eyebrowInvite: "Ladu · Invitation",
    subjectInvite: "Invitation to register in Ladu",
    titleInvite: "You are invited to Ladu",
    greetingInvite: "Hi,",
    bodyInvite: (email) =>
      `You are invited to create a Ladu account. Ladu is a vocabulary manager for people who speak several languages. Register with this email address: ${email}.`,
    ctaInvite: "Register in Ladu",
    ignoreInvite: "Did not expect this email? You can safely ignore it — nothing will happen.",

    footerNoteInvite: "You received this email because the Ladu team invited this address to register. Replies to this address are not monitored.",

    preheaderLoginAllowed: "You can sign in to Ladu now",
    eyebrowLoginAllowed: "Ladu · Access",
    subjectLoginAllowed: "You can sign in to Ladu now",
    titleLoginAllowed: "You can sign in now",
    bodyLoginAllowed:
      "Sign-in to Ladu was limited. The Ladu team has now allowed your account to sign in. Use your usual email and password.",
    ctaLoginAllowed: "Sign in to Ladu",
    ignoreLoginAllowed: "Did not ask for access? You can safely ignore this email — nothing will change.",
    footerNoteLoginAllowed: "You received this email because the Ladu team allowed your account to sign in. Replies to this address are not monitored.",
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

    preheaderInvite: "Estás invitado a registrarte en Ladu",
    eyebrowInvite: "Ladu · Invitación",
    subjectInvite: "Invitación para registrarte en Ladu",
    titleInvite: "Estás invitado a Ladu",
    greetingInvite: "Hola,",
    bodyInvite: (email) =>
      `Te invitamos a crear una cuenta en Ladu, un gestor de vocabulario para personas que hablan varios idiomas. Regístrate con este correo electrónico: ${email}.`,
    ctaInvite: "Registrarme en Ladu",
    ignoreInvite: "¿No esperabas este correo? Puedes ignorarlo sin problema — no pasará nada.",

    footerNoteInvite: "Recibiste este correo porque el equipo de Ladu invitó a esta dirección a registrarse. Las respuestas a esta dirección no se supervisan.",

    preheaderLoginAllowed: "Ya puedes iniciar sesión en Ladu",
    eyebrowLoginAllowed: "Ladu · Acceso",
    subjectLoginAllowed: "Ya puedes iniciar sesión en Ladu",
    titleLoginAllowed: "Ya puedes iniciar sesión",
    bodyLoginAllowed:
      "El inicio de sesión en Ladu estaba limitado. El equipo de Ladu ya permitió que tu cuenta inicie sesión. Usa tu correo y tu contraseña de siempre.",
    ctaLoginAllowed: "Iniciar sesión en Ladu",
    ignoreLoginAllowed: "¿No pediste acceso? Puedes ignorar este correo sin problema — no cambiará nada.",
    footerNoteLoginAllowed: "Recibiste este correo porque el equipo de Ladu permitió que tu cuenta inicie sesión. Las respuestas a esta dirección no se supervisan.",
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

    preheaderInvite: "Du bist eingeladen, dich bei Ladu zu registrieren",
    eyebrowInvite: "Ladu · Einladung",
    subjectInvite: "Einladung zur Registrierung bei Ladu",
    titleInvite: "Du bist zu Ladu eingeladen",
    greetingInvite: "Hallo,",
    bodyInvite: (email) =>
      `Du bist eingeladen, ein Ladu-Konto zu erstellen. Ladu ist ein Vokabelmanager für Menschen, die mehrere Sprachen sprechen. Registriere dich mit dieser E-Mail-Adresse: ${email}.`,
    ctaInvite: "Bei Ladu registrieren",
    ignoreInvite: "Diese E-Mail unerwartet erhalten? Du kannst sie einfach ignorieren — es passiert nichts.",

    footerNoteInvite: "Du hast diese E-Mail erhalten, weil das Ladu-Team diese Adresse zur Registrierung eingeladen hat. Antworten an diese Adresse werden nicht gelesen.",

    preheaderLoginAllowed: "Du kannst dich jetzt bei Ladu anmelden",
    eyebrowLoginAllowed: "Ladu · Zugang",
    subjectLoginAllowed: "Du kannst dich jetzt bei Ladu anmelden",
    titleLoginAllowed: "Du kannst dich jetzt anmelden",
    bodyLoginAllowed:
      "Die Anmeldung bei Ladu war eingeschränkt. Das Ladu-Team hat deinem Konto jetzt die Anmeldung erlaubt. Nutze deine gewohnte E-Mail-Adresse und dein Passwort.",
    ctaLoginAllowed: "Bei Ladu anmelden",
    ignoreLoginAllowed: "Du hast keinen Zugang angefragt? Du kannst diese E-Mail einfach ignorieren — es ändert sich nichts.",
    footerNoteLoginAllowed: "Du hast diese E-Mail erhalten, weil das Ladu-Team deinem Konto die Anmeldung erlaubt hat. Antworten an diese Adresse werden nicht gelesen.",
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

    preheaderInvite: "Sind on kutsutud Ladus registreeruma",
    eyebrowInvite: "Ladu · Kutse",
    subjectInvite: "Kutse Ladus registreeruma",
    titleInvite: "Sind on Ladusse kutsutud",
    greetingInvite: "Tere,",
    bodyInvite: (email) =>
      `Sind on kutsutud looma Ladu konto. Ladu on sõnavarahaldur inimestele, kes räägivad mitut keelt. Registreeru selle e-posti aadressiga: ${email}.`,
    ctaInvite: "Registreeru Ladus",
    ignoreInvite: "Ei oodanud seda kirja? Võid selle rahulikult tähelepanuta jätta — midagi ei juhtu.",

    footerNoteInvite: "Said selle kirja, sest Ladu meeskond kutsus selle aadressi registreeruma. Sellele aadressile saadetud vastuseid ei jälgita.",

    preheaderLoginAllowed: "Saad nüüd Ladusse sisse logida",
    eyebrowLoginAllowed: "Ladu · Ligipääs",
    subjectLoginAllowed: "Saad nüüd Ladusse sisse logida",
    titleLoginAllowed: "Saad nüüd sisse logida",
    bodyLoginAllowed:
      "Ladusse sisselogimine oli piiratud. Ladu meeskond on nüüd sinu kontole sisselogimise lubanud. Kasuta oma tavalist e-posti aadressi ja parooli.",
    ctaLoginAllowed: "Logi Ladusse sisse",
    ignoreLoginAllowed: "Ei palunud ligipääsu? Võid selle kirja rahulikult tähelepanuta jätta — midagi ei muutu.",
    footerNoteLoginAllowed: "Said selle kirja, sest Ladu meeskond lubas sinu kontol sisse logida. Sellele aadressile saadetud vastuseid ei jälgita.",
    footerTagline: "Mitmekeelse sõnavara looja",
    footerNote: "Said selle e-kirja oma Ladu konto tegevuse tõttu. Sellele aadressile vastamist ei jälgita.",
  },
  French: {
    preheaderVerify: "Confirme ton adresse e-mail pour activer ton compte Ladu",
    eyebrowVerify: "Ladu · Compte",
    subjectVerify: "Confirme ton e-mail",
    titleVerify: "Confirme ton e-mail",
    greeting: (name) => `Bonjour ${name},`,
    bodyVerify:
      "Merci d’avoir créé un compte Ladu. Confirme cette adresse e-mail pour activer ton compte et commencer à construire ton vocabulaire multilingue.",
    ctaVerify: "Confirmer l’adresse e-mail",
    fallbackLead: "Ou colle ce lien dans ton navigateur\u00a0:",
    ignoreVerify: "Tu n’as pas créé de compte Ladu\u00a0? Tu peux ignorer cet e-mail sans risque — rien ne sera activé.",

    preheaderReset: "Lien de réinitialisation pour ton compte Ladu",
    eyebrowReset: "Ladu · Réinitialisation du mot de passe",
    subjectReset: "Lien de réinitialisation du mot de passe",
    titleReset: "Réinitialise ton mot de passe",
    bodyReset: (email) =>
      `Nous avons reçu une demande de réinitialisation du mot de passe du compte Ladu ${email}. Clique ci-dessous pour choisir un nouveau mot de passe.`,
    ctaReset: "Choisir un nouveau mot de passe",
    expiryReset: "Ce lien expire dans 30 minutes et ne peut être utilisé qu’une seule fois.",
    ignoreReset: "Tu n’as pas demandé de réinitialisation\u00a0? Tu peux ignorer cet e-mail sans risque — ton mot de passe restera inchangé.",

    preheaderInvite: "Invitation à t’inscrire sur Ladu",
    eyebrowInvite: "Ladu · Invitation",
    subjectInvite: "Invitation à t’inscrire sur Ladu",
    titleInvite: "Rejoins Ladu",
    greetingInvite: "Bonjour,",
    bodyInvite: (email) =>
      `Tu peux créer un compte Ladu. Ladu est un gestionnaire de vocabulaire pour les personnes qui parlent plusieurs langues. Inscris-toi avec cette adresse e-mail\u00a0: ${email}.`,
    ctaInvite: "S’inscrire sur Ladu",
    ignoreInvite: "Tu n’attendais pas cet e-mail\u00a0? Tu peux l’ignorer sans risque — il ne se passera rien.",

    footerNoteInvite: "Tu as reçu cet e-mail parce que l’équipe de Ladu a invité cette adresse à s’inscrire. Les réponses à cette adresse ne sont pas lues.",

    preheaderLoginAllowed: "Tu peux maintenant te connecter à Ladu",
    eyebrowLoginAllowed: "Ladu · Accès",
    subjectLoginAllowed: "Tu peux maintenant te connecter à Ladu",
    titleLoginAllowed: "Tu peux maintenant te connecter",
    bodyLoginAllowed:
      "La connexion à Ladu était limitée. L’équipe de Ladu a maintenant autorisé ton compte à se connecter. Utilise ton e-mail et ton mot de passe habituels.",
    ctaLoginAllowed: "Se connecter à Ladu",
    ignoreLoginAllowed: "Tu n’as pas demandé d’accès\u00a0? Tu peux ignorer cet e-mail sans risque — rien ne changera.",
    footerNoteLoginAllowed: "Tu as reçu cet e-mail parce que l’équipe de Ladu a autorisé ton compte à se connecter. Les réponses à cette adresse ne sont pas lues.",
    footerTagline: "Le gestionnaire de vocabulaire multilingue",
    footerNote: "Tu as reçu cet e-mail à cause d’une activité sur ton compte Ladu. Les réponses à cette adresse ne sont pas lues.",
  },
};

/** `"Spanish"` → its strings; unrecognized/missing → English, so a send never fails on a bad language value. */
function stringsFor(language) {
  return STRINGS[language] || STRINGS.English;
}

module.exports = { stringsFor };
