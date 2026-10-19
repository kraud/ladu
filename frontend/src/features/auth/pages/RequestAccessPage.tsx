import { useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/AuthLayout';
import { RequestAccessForm } from '../components/RequestAccessForm';

const route = getRouteApi('/_public/request');

/**
 * `/request` (access-requests.md R1-R3): a visitor asks for access while a gate is limited or
 * closed. The checkbox picks the kind; the form handles a gate that is open for the ticked kind.
 * After a send, the page shows one message, the same for every email (the server never tells more).
 */
export function RequestAccessPage() {
    const { t } = useTranslation();
    const { account } = route.useSearch();
    const [sent, setSent] = useState(false);

    return (
        <AuthLayout
            blurb={t('loginRegister:request.blurb')}
            title={t('loginRegister:request.title')}
            subtitle={sent ? undefined : t('loginRegister:request.intro')}
            links={
                <>
                    <Link to="/login">{t('loginRegister:switchSectionButtons.signIn')}</Link>
                    {' · '}
                    <Link to="/register">{t('loginRegister:switchSectionButtons.createAccount')}</Link>
                </>
            }
        >
            {sent ? (
                <div className="banner info items-start" role="status">
                    <div>
                        <p className="font-semibold">{t('loginRegister:request.sentTitle')}</p>
                        <p className="mt-1">{t('loginRegister:request.sentBody')}</p>
                    </div>
                </div>
            ) : (
                <RequestAccessForm initialHasAccount={account ?? false} onSent={() => setSent(true)} />
            )}
        </AuthLayout>
    );
}
