/**
 * yup schema for the Account profile-edit form. A **factory** taking a translate
 * function so validation messages are localised — same pattern as the auth
 * schemas (`features/auth/schemas.ts`). Message keys are reused from
 * registration so the two forms fail identically.
 *
 * Scope: name, username, languages. Email is read-only (managed separately);
 * `nativeLanguage` is passed through untouched by the caller and is not a field
 * here.
 */
import * as yup from 'yup';
import type { TranslateFn } from '@/features/auth/schemas';

export interface ProfileValues {
    name: string;
    username: string;
    /** language *labels* ("English", …) — selection order preserved, >= 2 required */
    languages: string[];
}

export function buildProfileSchema(t: TranslateFn): yup.ObjectSchema<ProfileValues> {
    return yup.object({
        name: yup.string().trim().required(t('loginRegister:errors.nameRequired')),
        username: yup.string().trim().required(t('loginRegister:errors.usernameRequired')),
        languages: yup
            .array(yup.string().required())
            .min(2, t('common:userData.errors.notEnoughLanguages'))
            .required(t('common:userData.errors.notEnoughLanguages')),
    });
}
