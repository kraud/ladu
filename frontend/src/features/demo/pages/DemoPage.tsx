import { Link, Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { TermsNote } from '@/features/auth/components/TermsNote';
import { isTokenExpired } from '@/lib/jwt';
import { labelByI18nCode } from '@/lib/language';
import { themeForRequest } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { demoErrorKey } from '../errors';
import { useDemoStatus, useStartDemo } from '../hooks';
import { isLiveDemo } from '../session';

/**
 * `/demo` (demo-access.md D12, D14): the start screen behind the landing page's "Try the demo".
 * A button, not an automatic start, so the visitor sees the Terms note first. With a normal
 * session open, it warns that the demo logs the visitor out. A demo that is still running opens
 * the app at once. When the demo is off, it says so and points to sign-up.
 */
export function DemoPage() {
    const { t, i18n } = useTranslation();
    const status = useDemoStatus();
    const start = useStartDemo();
    const user = useAuthStore((s) => s.user);
    const token = useAuthStore((s) => s.token);

    if (isLiveDemo(user, token)) return <Navigate to="/" />;

    // A real account is open: the start replaces it, so warn first. A demo that has ended is not one.
    const signedIn = user !== null && user.isDemo !== true && !isTokenExpired(token);
    const links = (
        <>
            <span>{t('demo:start.haveAccount')}</span> <Link to="/login">{t('demo:start.signIn')}</Link>
        </>
    );

    if (status === 'off') {
        return (
            <AuthLayout blurb={t('demo:start.blurb')} title={t('demo:off.title')} links={links}>
                <p className="mb-4">{t('demo:off.text')}</p>
                <Link to="/register" className={buttonVariants({ className: 'w-full' })}>
                    {t('demo:off.createAccount')}
                </Link>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout blurb={t('demo:start.blurb')} title={t('demo:start.title')} links={links}>
            <div className="flex flex-col gap-4">
                <p>{t('demo:start.intro')}</p>

                {signedIn && (
                    <p className="banner warning" role="status">
                        {t('demo:start.logoutWarning')}
                    </p>
                )}

                {start.isError && (
                    <p className="banner warning" role="alert">
                        {t(demoErrorKey(start.error))}
                    </p>
                )}

                <Button
                    className="w-full"
                    disabled={status === 'loading' || start.isPending}
                    onClick={() => start.mutate({ uiLanguage: labelByI18nCode(i18n.language), theme: themeForRequest() })}
                >
                    {status === 'loading'
                        ? t('demo:start.loading')
                        : start.isPending
                          ? t('demo:start.starting')
                          : signedIn
                            ? t('demo:start.buttonLogout')
                            : t('demo:start.button')}
                </Button>

                <TermsNote i18nKey="demo:start.termsNote" />
            </div>
        </AuthLayout>
    );
}
