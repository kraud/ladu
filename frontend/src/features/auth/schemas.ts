/**
 * yup schemas for the auth forms, ported from the old app's per-page schemas.
 *
 * Each is a **factory** taking a translate function so validation messages are
 * localised (the old app hard-coded English — snapshot `pages-auth-shell.md`).
 * The message strings are resolved at build time and rendered verbatim by
 * `<FormMessage>`; unit tests pass an identity `t` and assert on the keys.
 *
 * `password2` (register + set-password) is enforced here and **never sent to
 * the API** — the request builders in `hooks.ts` drop it.
 */
import * as yup from 'yup';

/** Just enough of i18next's `t` for message lookup — no interpolation needed. */
export type TranslateFn = (key: string) => string;

const PASSWORD_MIN = 8;

/** RFC-lite email check — matches the old app's `.email()` usage. */
function emailField(t: TranslateFn) {
    return yup
        .string()
        .trim()
        .required(t('loginRegister:errors.emailRequired'))
        .email(t('loginRegister:errors.invalidEmail'));
}

function newPasswordField(t: TranslateFn) {
    return yup
        .string()
        .required(t('loginRegister:errors.passwordRequired'))
        .min(PASSWORD_MIN, t('loginRegister:errors.passwordMin'));
}

function confirmPasswordField(t: TranslateFn) {
    return yup
        .string()
        .required(t('loginRegister:errors.passwordRepeatRequired'))
        .oneOf([yup.ref('password')], t('loginRegister:errors.passwordRepeatMustMatch'));
}

export interface LoginValues {
    email: string;
    password: string;
}

export function buildLoginSchema(t: TranslateFn): yup.ObjectSchema<LoginValues> {
    return yup.object({
        email: emailField(t),
        password: yup.string().required(t('loginRegister:errors.passwordRequired')),
    });
}

export interface RegisterValues {
    name: string;
    username: string;
    email: string;
    password: string;
    password2: string;
}

export function buildRegisterSchema(t: TranslateFn): yup.ObjectSchema<RegisterValues> {
    return yup.object({
        name: yup.string().trim().required(t('loginRegister:errors.nameRequired')),
        username: yup.string().trim().required(t('loginRegister:errors.usernameRequired')),
        email: emailField(t),
        password: newPasswordField(t),
        password2: confirmPasswordField(t),
    });
}

export interface ResetRequestValues {
    email: string;
}

export function buildResetRequestSchema(t: TranslateFn): yup.ObjectSchema<ResetRequestValues> {
    return yup.object({ email: emailField(t) });
}

export interface ResetSetValues {
    password: string;
    password2: string;
}

export function buildResetSetSchema(t: TranslateFn): yup.ObjectSchema<ResetSetValues> {
    return yup.object({
        password: newPasswordField(t),
        password2: confirmPasswordField(t),
    });
}

/**
 * The reset-password route is one page, two modes: "set" when both the `userId`
 * and `tokenId` route params are present, "request" otherwise (snapshot
 * `pages-auth-shell.md` — ResetPassword §1).
 */
export function buildResetSchema(t: TranslateFn, isSetMode: boolean) {
    return isSetMode ? buildResetSetSchema(t) : buildResetRequestSchema(t);
}
