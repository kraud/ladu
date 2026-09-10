import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { createInstance, type i18n as I18nInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { ToastContainer } from 'react-toastify';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { useAuthStore, type RawUser } from '@/stores/authStore';

// Real English locale bundles, so a missing key fails a test rather than
// silently rendering the key name. Kept in sync with `public/locales/en/`.
import account from '../../public/locales/en/account.json';
import caseDescription from '../../public/locales/en/caseDescription.json';
import common from '../../public/locales/en/common.json';
import dashboard from '../../public/locales/en/dashboard.json';
import friendship from '../../public/locales/en/friendship.json';
import loginRegister from '../../public/locales/en/loginRegister.json';
import notifications from '../../public/locales/en/notifications.json';
import practice from '../../public/locales/en/practice.json';
import review from '../../public/locales/en/review.json';
import tags from '../../public/locales/en/tags.json';
import translation from '../../public/locales/en/translation.json';
import wordRelated from '../../public/locales/en/wordRelated.json';

const enResources = {
    account,
    caseDescription,
    common,
    dashboard,
    friendship,
    loginRegister,
    notifications,
    practice,
    review,
    tags,
    translation,
    wordRelated,
};

/** A synchronous i18next instance (no http-backend, no Suspense) for tests. */
export function createTestI18n(): I18nInstance {
    const instance = createInstance();
    void instance.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        ns: Object.keys(enResources),
        defaultNS: 'common',
        resources: { en: enResources },
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
    });
    return instance;
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
    /** Seed the session store before rendering (default: cleared). Token may ride on `session.token`. */
    session?: RawUser;
}

/**
 * Render `ui` inside the app's providers, each fresh per call:
 * a retry-off QueryClient, a synchronous i18n instance, and a reset session.
 * Routing context is not included here — tests that need it build a router
 * with `createAppRouter(createMemoryHistory(...))` directly.
 */
export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
    const { session, ...renderOptions } = options;

    useAuthStore.getState().clearSession();
    if (session) {
        useAuthStore.getState().setSession(session);
    }

    const queryClient = createQueryClient();
    const i18n = createTestI18n();

    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
            </QueryClientProvider>
        );
    }

    return {
        queryClient,
        i18n,
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    };
}

/**
 * Mount the *whole app* — the real route tree from `createAppRouter` on an
 * in-memory history — inside fresh providers. For the Phase-1 integration
 * suite that walks register → verify → login → logout across real routes.
 * Install MSW auth handlers with `server.use(...makeAuthHandlers().handlers)`
 * before calling.
 */
export async function renderApp(options: { initialEntry?: string; session?: RawUser } = {}) {
    const { initialEntry = '/', session } = options;

    useAuthStore.getState().clearSession();
    if (session) useAuthStore.getState().setSession(session);

    const queryClient = createQueryClient();
    const i18n = createTestI18n();
    const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
    // Resolve the initial match (incl. any `beforeLoad` redirect) before we
    // assert on `router.state` — mirrors `router.test.tsx`.
    await router.load();

    const utils = render(
        <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
                <RouterProvider router={router} />
                <ToastContainer position="bottom-center" autoClose={false} />
            </I18nextProvider>
        </QueryClientProvider>,
    );

    return { queryClient, i18n, router, ...utils };
}
