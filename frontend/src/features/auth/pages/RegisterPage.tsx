import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
    const { t } = useTranslation();

    return (
        <AuthLayout
            blurb={t('loginRegister:brand.subRegister')}
            links={
                <>
                    <span>{t('loginRegister:switchSectionButtons.alreadyRegistered')}</span>{' '}
                    <Link to="/login">{t('loginRegister:switchSectionButtons.signIn')}</Link>
                </>
            }
        >
            <RegisterForm />
        </AuthLayout>
    );
}
