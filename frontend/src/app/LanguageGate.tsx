import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { LoadingScreen } from '@/components/common/LoadingScreen';

/**
 * Shows the loading screen until i18next has loaded the first language files.
 *
 * The app must not use `<Suspense>` for this first wait: React 19 keeps a Suspense
 * fallback on screen for at least 300 ms, also when the files arrive much sooner.
 * A normal state change has no such delay.
 */
export function LanguageGate({ i18n, children }: { i18n: I18nInstance; children: ReactNode }) {
    const subscribe = useCallback(
        (onChange: () => void) => {
            i18n.on('initialized', onChange);
            return () => i18n.off('initialized', onChange);
        },
        [i18n],
    );
    const ready = useSyncExternalStore(subscribe, () => Boolean(i18n.isInitialized));

    return ready ? children : <LoadingScreen />;
}
