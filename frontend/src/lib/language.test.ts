import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import {
    SUPPORTED_LANGUAGE_LABELS,
    bindHtmlLang,
    htmlLangByI18nCode,
    i18nCodeByLabel,
    labelByI18nCode,
    langKeyByLabel,
} from './language';

describe('language helpers', () => {
    it('exposes the four supported labels in display order', () => {
        expect(SUPPORTED_LANGUAGE_LABELS).toEqual(['English', 'Spanish', 'German', 'Estonian']);
    });

    it('maps label <-> i18n code both ways', () => {
        expect(i18nCodeByLabel('Spanish')).toBe('es');
        expect(labelByI18nCode('es')).toBe('Spanish');
        expect(langKeyByLabel('Estonian')).toBe('EE');
    });

    it('labelByI18nCode strips region variants', () => {
        expect(labelByI18nCode('de-DE')).toBe('German');
        expect(labelByI18nCode('EN-us')).toBe('English');
    });

    it('labelByI18nCode falls back to English for unknown / empty input', () => {
        expect(labelByI18nCode('fr')).toBe('English');
        expect(labelByI18nCode('')).toBe('English');
        expect(labelByI18nCode(undefined)).toBe('English');
    });
});

describe('htmlLangByI18nCode', () => {
    it('keeps en / es / de and maps the app\'s Estonian code `ee` to the HTML tag `et`', () => {
        expect(htmlLangByI18nCode('en')).toBe('en');
        expect(htmlLangByI18nCode('es')).toBe('es');
        expect(htmlLangByI18nCode('de')).toBe('de');
        expect(htmlLangByI18nCode('ee')).toBe('et');
    });

    it('strips region variants and ignores letter case', () => {
        expect(htmlLangByI18nCode('es-AR')).toBe('es');
        expect(htmlLangByI18nCode('DE')).toBe('de');
        expect(htmlLangByI18nCode('ee-EE')).toBe('et');
    });

    it('falls back to `en` for unknown / empty input', () => {
        expect(htmlLangByI18nCode('fr')).toBe('en');
        expect(htmlLangByI18nCode('')).toBe('en');
        expect(htmlLangByI18nCode(undefined)).toBe('en');
    });
});

describe('bindHtmlLang', () => {
    const resources = Object.fromEntries(
        ['en', 'es', 'de', 'ee'].map((code) => [code, { translation: {} }]),
    );

    it('sets <html lang> at start-up and on every language change', async () => {
        document.documentElement.setAttribute('lang', 'xx');
        const instance = createInstance();
        bindHtmlLang(instance);
        await instance.init({ lng: 'es', resources });
        expect(document.documentElement.getAttribute('lang')).toBe('es');

        await instance.changeLanguage('ee');
        expect(document.documentElement.getAttribute('lang')).toBe('et');

        await instance.changeLanguage('de');
        expect(document.documentElement.getAttribute('lang')).toBe('de');
    });

    it('applies the current language at once when bound after init', async () => {
        const instance = createInstance();
        await instance.init({ lng: 'de', resources });
        document.documentElement.setAttribute('lang', 'xx');

        bindHtmlLang(instance);

        expect(document.documentElement.getAttribute('lang')).toBe('de');
    });
});
