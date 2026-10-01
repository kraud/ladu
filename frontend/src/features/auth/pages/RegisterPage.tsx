import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AccessBanner } from '@/features/access/components/AccessBanner';
import { useAccess } from '@/features/access/hooks';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';
import { OAuthButtons } from '../components/OAuthButtons';

export function RegisterPage() {
    const { t } = useTranslation();
    const { registration } = useAccess();
    // `closed`: nobody can register, so the form and the Google button are off (a disabled
    // fieldset turns off every control inside it). `limited` only adds a note: the server
    // decides by email. Either way the server enforces the gate.
    const closed = registration.mode === 'closed';

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
            <AccessBanner gate="registration" status={registration} />
            <OAuthButtons disabled={closed} />
            <fieldset disabled={closed} className="m-0 min-w-0 border-0 p-0">
                <RegisterForm />
            </fieldset>
        </AuthLayout>
    );
}
