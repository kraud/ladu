import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';
import { OAuthButtons } from '../components/OAuthButtons';

const route = getRouteApi('/_public/login');

export function LoginPage() {
    const { t } = useTranslation();
    const { redirect } = route.useSearch();

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
            <OAuthButtons />
            <LoginForm redirectTo={redirect ?? '/'} />
        </AuthLayout>
    );
}
