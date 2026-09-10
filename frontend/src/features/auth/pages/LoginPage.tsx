import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';

const route = getRouteApi('/_public/login');

export function LoginPage() {
    const { t } = useTranslation();
    const { redirect } = route.useSearch();

    return (
        <AuthCard
            title={t('loginRegister:login.title')}
            subtitle={t('loginRegister:login.subtitle')}
            links={
                <>
                    <span>{t('loginRegister:switchSectionButtons.notRegistered')}</span>
                    <Link to="/register">{t('loginRegister:switchSectionButtons.createAccount')}</Link>
                    <span aria-hidden className="text-(--border)">
                        ·
                    </span>
                    <Link to="/resetPassword/{-$userId}/{-$tokenId}">
                        {t('loginRegister:switchSectionButtons.forgotPassword')}
                    </Link>
                </>
            }
        >
            <LoginForm redirectTo={redirect ?? '/'} />
        </AuthCard>
    );
}
