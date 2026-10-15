import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/components/AuthLayout';

/**
 * `/demo/ended` (demo-access.md D13): where a demo goes when its time is over — from the
 * countdown, or from a 401 on a demo session. The session is already cleared by then. A visitor
 * never needs `/login` here, so the two ways on are sign-up and a new demo.
 */
export function DemoEndedPage() {
    const { t } = useTranslation();

    return (
        <AuthLayout blurb={t('demo:ended.blurb')} title={t('demo:ended.title')}>
            <p className="mb-4">{t('demo:ended.text')}</p>
            <div className="flex flex-col gap-2">
                <Link to="/register" className={buttonVariants({ className: 'w-full' })}>
                    {t('demo:ended.signUp')}
                </Link>
                <Link to="/demo" className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
                    {t('demo:ended.tryAgain')}
                </Link>
            </div>
        </AuthLayout>
    );
}
