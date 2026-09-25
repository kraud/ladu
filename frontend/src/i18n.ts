import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { takeHandoffParams } from '@/lib/handoff';

// The first app module to run at boot, so the landing page's `?lng=&theme=` is
// read before i18next's detector or the router see the address (lib/handoff.ts).
const handoff = takeHandoffParams();

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        // A handoff language beats the detector (saved choice / browser language);
        // undefined leaves the detector in charge.
        lng: handoff.lng,
        fallbackLng: 'en',
        fallbackNS: 'common',
        defaultNS: 'common',
        ns: [
            'account',
            'caseDescription',
            'common',
            'dashboard',
            'friendship',
            'loginRegister',
            'notifications',
            'practice',
            'review',
            'tags',
            'translation',
            'wordRelated',
        ],
        supportedLngs: ['en', 'es', 'de', 'ee'],
        nonExplicitSupportedLngs: true,
        backend: {
            load: 'languageOnly',
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
