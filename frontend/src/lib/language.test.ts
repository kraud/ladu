import { describe, expect, it } from 'vitest';
import {
    SUPPORTED_LANGUAGE_LABELS,
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
