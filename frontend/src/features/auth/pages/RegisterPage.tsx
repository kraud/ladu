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
                    <p>
                        <span>{t('loginRegister:switchSectionButtons.alreadyRegistered')}</span>{' '}
                        <Link to="/login">{t('loginRegister:switchSectionButtons.signIn')}</Link>
                    </p>
                    {/* For a visitor who is not ready to register: the demo, under a small separator. */}
                    <hr className="auth-foot-sep" />
                    <p className="auth-foot-small">
                        <span>{t('loginRegister:switchSectionButtons.notSureYet')}</span>{' '}
                        <Link to="/demo">{t('loginRegister:switchSectionButtons.tryDemo')}</Link>.
                    </p>
                </>
            }
        >
            <AccessBanner gate="registration" status={registration} />
            <fieldset disabled={closed} className="m-0 min-w-0 border-0 p-0">
                <RegisterForm oauthSlot={<OAuthButtons disabled={closed} separator="below" />} />
            </fieldset>
        </AuthLayout>
    );
}
