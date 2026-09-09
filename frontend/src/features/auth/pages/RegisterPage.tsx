import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '../components/AuthCard';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
    const { t } = useTranslation();

    return (
        <AuthCard
            title={t('loginRegister:register.title')}
            subtitle={t('loginRegister:register.subtitle')}
            links={
                <>
                    <span>{t('loginRegister:switchSectionButtons.alreadyRegistered')}</span>
                    <Link to="/login">{t('loginRegister:switchSectionButtons.signIn')}</Link>
                </>
            }
        >
            <RegisterForm />
        </AuthCard>
    );
}
