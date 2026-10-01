import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AccessBanner } from '@/features/access/components/AccessBanner';
import { useAccess } from '@/features/access/hooks';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';
import { OAuthButtons } from '../components/OAuthButtons';

const route = getRouteApi('/_public/login');

export function LoginPage() {
    const { t } = useTranslation();
    const { redirect } = route.useSearch();
    const { login } = useAccess();
    // `closed`: nobody can sign in, so the form and the Google button are off (a disabled fieldset turns
    // off every control inside it). `limited` only adds a note: the server decides by account. Either way
    // the server enforces the gate, and an open session is not affected.
    const closed = login.mode === 'closed';

    return (
        <AuthLayout
            blurb={t('loginRegister:brand.subLogin')}
            title={t('loginRegister:login.title')}
            subtitle={t('loginRegister:login.subtitle')}
            links={
                <>
                    <span>{t('loginRegister:switchSectionButtons.notRegistered')}</span>{' '}
                    <Link to="/register">{t('loginRegister:switchSectionButtons.createAccount')}</Link>
                </>
            }
        >
            <AccessBanner gate="login" status={login} />
            <OAuthButtons disabled={closed} />
            <fieldset disabled={closed} className="m-0 min-w-0 border-0 p-0">
                <LoginForm redirectTo={redirect ?? '/'} />
            </fieldset>
        </AuthLayout>
    );
}
