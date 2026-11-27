import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { createInstance, type BackendModule } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { LanguageGate } from './LanguageGate';

/** An i18next instance, set up like the app's, whose language files arrive only when the test says so. */
function createSlowI18n() {
    const waiting: Array<() => void> = [];
    const backend: BackendModule = {
        type: 'backend',
        init: () => {},
        read: (_language, _namespace, callback) => {
            waiting.push(() => callback(null, { greeting: 'Hello' }));
        },
    };
    const i18n = createInstance();
    const initialized = i18n
        .use(backend)
        .use(initReactI18next)
        .init({ lng: 'en', fallbackLng: 'en', ns: ['common'], defaultNS: 'common' });

    return {
        i18n,
        async deliverFiles() {
            await expect.poll(() => waiting.length).toBeGreaterThan(0);
            waiting.splice(0).forEach((deliver) => deliver());
            await initialized;
        },
    };
}

function Greeting({ i18n }: { i18n: ReturnType<typeof createInstance> }) {
    const { t } = useTranslation('common', { i18n });
    return <p>{t('greeting')}</p>;
}

function renderGate(i18n: ReturnType<typeof createInstance>) {
    return render(
        <LanguageGate i18n={i18n}>
            <Suspense fallback={<p>Suspense fallback</p>}>
                <Greeting i18n={i18n} />
            </Suspense>
        </LanguageGate>,
    );
}

describe('LanguageGate', () => {
    it('shows the loading screen until the language files arrive, then the app, without Suspense', async () => {
        const { i18n, deliverFiles } = createSlowI18n();
        renderGate(i18n);

        expect(screen.getByRole('status')).toHaveTextContent('Loading…');
        expect(screen.queryByText('Suspense fallback')).not.toBeInTheDocument();

        await act(deliverFiles);

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByText('Suspense fallback')).not.toBeInTheDocument();
    });

    it('shows the app at once when the files are already loaded', async () => {
        const { i18n, deliverFiles } = createSlowI18n();
        await deliverFiles();
        renderGate(i18n);

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
