/**
 * yup schema for the Account profile-edit form. A **factory** taking a translate
 * function so validation messages are localised — same pattern as the auth
 * schemas (`features/auth/schemas.ts`). Message keys are reused from
 * registration so the two forms fail identically.
 *
 * Scope: name, username, languages, native language. Email is read-only
 * (managed separately).
 */
import * as yup from 'yup';
import type { TranslateFn } from '@/features/auth/schemas';

/** The native-language select's "no native language" value. */
export const NO_NATIVE_LANGUAGE = 'none';

export interface ProfileValues {
    name: string;
    username: string;
    /** language *labels* ("English", …) — selection order preserved, >= 2 required */
    languages: string[];
    /** a language *label* out of `languages`, or `NO_NATIVE_LANGUAGE` */
    nativeLanguage: string;
}

export function buildProfileSchema(t: TranslateFn): yup.ObjectSchema<ProfileValues> {
    return yup.object({
        name: yup.string().trim().required(t('loginRegister:errors.nameRequired')),
        username: yup.string().trim().required(t('loginRegister:errors.usernameRequired')),
        languages: yup
            .array(yup.string().required())
            .min(2, t('common:userData.errors.notEnoughLanguages'))
            .required(t('common:userData.errors.notEnoughLanguages')),
        nativeLanguage: yup.string().required(),
    });
}
