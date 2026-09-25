import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Providers } from './app/Providers';
import { gitSha, sentryDsn } from './env';
import './i18n';
import './styles.css';
import { initTheme } from './lib/theme';

initTheme();

// One built image serves both staging and production (frontend/Dockerfile's
// own top comment), so `environment` can't be a build-time value the way
// `release` is below — it's read from the hostname at page-load time
// instead. No-ops harmlessly when sentryDsn is unset (local dev, CI).
Sentry.init({
    dsn: sentryDsn,
    environment: window.location.hostname.startsWith('staging.') ? 'staging' : 'production',
    release: gitSha,
});

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <Providers />
    </StrictMode>,
);
