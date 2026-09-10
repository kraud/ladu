/**
 * The four UI languages, in display order, with every representation the shell
 * needs: the enum **key** (`EN`), the stored **label** (`Lang` enum value the
 * `SessionUser.languages` / `uiLanguage` fields use), the **native** name, the
 * **i18n** code i18next is configured with, and the **flag** asset in `public/`.
 *
 * The old app scattered these lookups across `generalUseFunctions`
 * (`getLangKeyByLabel`, `getCurrentLangTranslated`) and hardcoded EN=GB flag
 * mappings — one table here replaces all of it.
 */
export interface UiLanguage {
    key: 'EN' | 'ES' | 'DE' | 'EE';
    /** the value stored in `SessionUser.uiLanguage` / `languages[]` (`Lang` enum value) */
    label: string;
    native: string;
    /** i18next language code (note: Estonian is `ee`, not the ISO `et` — carried over from v1) */
    i18n: 'en' | 'es' | 'de' | 'ee';
    /** file under `public/` — English shows the GB flag */
    flag: string;
}

export const UI_LANGUAGES: readonly UiLanguage[] = [
    { key: 'EN', label: 'English', native: 'English', i18n: 'en', flag: '/GB.svg' },
    { key: 'ES', label: 'Spanish', native: 'Español', i18n: 'es', flag: '/ES.svg' },
    { key: 'DE', label: 'German', native: 'Deutsch', i18n: 'de', flag: '/DE.svg' },
    { key: 'EE', label: 'Estonian', native: 'Eesti', i18n: 'ee', flag: '/EE.svg' },
] as const;

/** The four supported language labels, in display order (`Lang` enum values). */
export const SUPPORTED_LANGUAGE_LABELS: readonly string[] = UI_LANGUAGES.map((l) => l.label);

const byLabel = new Map(UI_LANGUAGES.map((l) => [l.label, l]));
const byKey = new Map(UI_LANGUAGES.map((l) => [l.key, l]));
const byI18n = new Map(UI_LANGUAGES.map((l) => [l.i18n, l]));

/** `"English"` → the `UiLanguage` row, or `undefined`. */
export function languageByLabel(label: string | null | undefined): UiLanguage | undefined {
    return label ? byLabel.get(label) : undefined;
}

/** `"English"` → `"EN"` (empty string when unknown — matches the old `getLangKeyByLabel`). */
export function langKeyByLabel(label: string | null | undefined): string {
    return languageByLabel(label)?.key ?? '';
}

/** `"English"` → `"en"`; unknown / missing → `"en"` (the i18next fallback). */
export function i18nCodeByLabel(label: string | null | undefined): UiLanguage['i18n'] {
    return languageByLabel(label)?.i18n ?? 'en';
}

/** `"EN"` → the `UiLanguage` row, or `undefined`. */
export function languageByKey(key: string): UiLanguage | undefined {
    return byKey.get(key as UiLanguage['key']);
}

/**
 * i18next language code → stored label. Region variants are stripped
 * (`"es-ES"` → `"Spanish"`); an unknown code falls back to `"English"` so a
 * login/register payload always carries a valid `uiLanguage`.
 */
export function labelByI18nCode(code: string | null | undefined): string {
    const base = (code ?? '').split('-')[0]!.toLowerCase();
    return byI18n.get(base as UiLanguage['i18n'])?.label ?? 'English';
}
