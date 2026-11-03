/**
 * yup schemas for the two Account edit forms. **Factories** taking a translate
 * function so validation messages are localised — same pattern as the auth
 * schemas (`features/auth/schemas.ts`). Message keys are reused from
 * registration so the forms fail identically.
 *
 * - `buildDetailsSchema`: the account card — name and username. Email is read-only (managed separately).
 * - `buildLanguagesSchema`: the languages card — languages, native language, mastered language pairs.
 */
import * as yup from 'yup';
import type { TranslateFn } from '@/features/auth/schemas';
import { coversEveryPair } from './masteredPairs';

/** The native-language select's "no native language" value. */
export const NO_NATIVE_LANGUAGE = 'none';

export interface DetailsValues {
    name: string;
    username: string;
}

export interface LanguagesValues {
    /** language *labels* ("English", …) — selection order preserved, >= 2 required */
    languages: string[];
    /** a language *label* out of `languages`, or `NO_NATIVE_LANGUAGE` */
    nativeLanguage: string;
    /** pairs of language *labels* Practice never combines; they can never cover every pair of `languages` */
    masteredLanguagePairs: string[][];
}

export function buildDetailsSchema(t: TranslateFn): yup.ObjectSchema<DetailsValues> {
    return yup.object({
        name: yup.string().trim().required(t('loginRegister:errors.nameRequired')),
        username: yup.string().trim().required(t('loginRegister:errors.usernameRequired')),
    });
}

export function buildLanguagesSchema(t: TranslateFn): yup.ObjectSchema<LanguagesValues> {
    return yup.object({
        languages: yup
            .array(yup.string().required())
            .min(2, t('common:userData.errors.notEnoughLanguages'))
            .required(t('common:userData.errors.notEnoughLanguages')),
        nativeLanguage: yup.string().required(),
        masteredLanguagePairs: yup
            .array(yup.array(yup.string().required()).length(2).required())
            .required()
            .test(
                'leaves-a-pair-open',
                t('account:masteredPairs.errors.allMastered'),
                function (pairs) {
                    return !coversEveryPair(pairs, this.parent.languages ?? []);
                },
            ),
    });
}
