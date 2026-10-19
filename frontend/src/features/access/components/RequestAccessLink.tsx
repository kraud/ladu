import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';

/**
 * "Request access" under the banner on `/login` and `/register`, while that gate is limited or
 * closed (access-requests.md R1). It opens `/request`; from the login page the box "I have an
 * account" is already ticked (R2). Keep it OUTSIDE the disabled `<fieldset>`: it must still work
 * when the gate is closed. Nothing for an open gate.
 */
export function RequestAccessLink({ gate, mode }: { gate: 'registration' | 'login'; mode: 'open' | 'closed' | 'limited' }) {
    const { t } = useTranslation();
    if (mode === 'open') return null;

    return (
        <Link
            to="/request"
            search={{ account: gate === 'login' ? true : undefined }}
            className={buttonVariants({ variant: 'secondary', className: 'mb-4 w-full' })}
        >
            {t('loginRegister:request.button')}
        </Link>
    );
}
