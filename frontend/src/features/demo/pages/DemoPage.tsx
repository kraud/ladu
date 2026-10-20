import { useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon } from '@phosphor-icons/react';
import { Link, Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LanguageTiles } from '@/components/common/LanguageTiles';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCaptcha } from '@/features/captcha/useCaptcha';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { TermsNote } from '@/features/auth/components/TermsNote';
import { isTokenExpired } from '@/lib/jwt';
import { labelByI18nCode } from '@/lib/language';
import { themeForRequest } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { DemoIntro } from '../components/DemoIntro';
import { demoErrorKey } from '../errors';
import { useDemoStatus, useStartDemo } from '../hooks';
import { isLiveDemo } from '../session';

/**
 * `/demo` (demo-access.md D12, D14): the start screen behind the landing page's "Try the demo".
 * A button, not an automatic start, so the visitor sees the Terms note first. With a normal
 * session open, it warns that the demo logs the visitor out. A demo that is still running opens
 * the app at once. When the demo is off, it says so and points to sign-up.
 *
 * Two steps. Step 1 describes the demo (`DemoIntro`: the three things inside it) with "Get started".
 * Step 2 picks the languages, with the registration tiles (D16): Start waits for 2 or more, and the
 * demo account gets them in the order picked. The arrow before the step-2 title goes back to step 1
 * and keeps the picks. The log-out warning is on step 1; the Terms note and the errors are on step 2,
 * beside Start.
 */
export function DemoPage() {
    const { t, i18n } = useTranslation();
    const status = useDemoStatus();
    const start = useStartDemo();
    const captcha = useCaptcha('demo');
    const user = useAuthStore((s) => s.user);
    const token = useAuthStore((s) => s.token);
    const [step, setStep] = useState<1 | 2>(1);
    const [languages, setLanguages] = useState<string[]>([]);
    const enoughLanguages = languages.length >= 2;

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
            <AuthLayout blurb={t('demo:start.blurb')} links={links} wide>
                <DemoIntro off />

                <div className="demo-cta">
                    <div className="demo-off-note" role="status">
                        <h2>{t('demo:off.title')}</h2>
                        <p>{t('demo:off.text')}</p>
                    </div>
                    <Link to="/register" className={buttonVariants({ className: 'demo-start' })}>
                        {t('demo:off.createAccount')}
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    if (step === 1) {
        return (
            <AuthLayout blurb={t('demo:start.blurb')} links={links} wide>
                <DemoIntro />

                <div className="demo-cta">
                    {signedIn && (
                        <p className="banner warning mb-3" role="status">
                            {t('demo:start.logoutWarning')}
                        </p>
                    )}

                    <p className="demo-reset">
                        <ClockIcon size={13} aria-hidden="true" />
                        {t('demo:start.resetNote')}
                    </p>
                    <Button className="demo-start" disabled={status === 'loading'} onClick={() => setStep(2)}>
                        {status === 'loading' ? t('demo:start.loading') : t('demo:start.getStarted')}
                        {status !== 'loading' && <ArrowRightIcon size={15} weight="bold" aria-hidden="true" />}
                    </Button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout blurb={t('demo:start.blurb')} links={links}>
            <div className="flex flex-col gap-4">
                <div className="form-head -mb-1.5 flex items-center gap-1">
                    <button
                        type="button"
                        className="icon-btn -ml-2"
                        aria-label={t('demo:start.back')}
                        disabled={start.isPending}
                        onClick={() => setStep(1)}
                    >
                        <ArrowLeftIcon size={20} />
                    </button>
                    <h1 className="h2">{t('demo:start.languagesTitle')}</h1>
                </div>

                <section className="flex flex-col gap-2" aria-label={t('demo:start.languagesTitle')}>
                    <p className="hint">{t('demo:start.languagesHint')}</p>
                    <LanguageTiles value={languages} onChange={setLanguages} />
                    <span className="hint" aria-live="polite">
                        {languages.length === 0
                            ? t('demo:start.languageCountEmpty')
                            : t('demo:start.languageCountSelected', { count: languages.length })}
                    </span>
                </section>

                {captcha.widget}

                {start.isError && (
                    <p className="banner warning" role="alert">
                        {t(demoErrorKey(start.error))}
                    </p>
                )}

                <Button
                    className="w-full"
                    disabled={start.isPending || !enoughLanguages || !captcha.ready}
                    onClick={() =>
                        start.mutate(
                            {
                                uiLanguage: labelByI18nCode(i18n.language),
                                languages,
                                theme: themeForRequest(),
                                captchaToken: captcha.token,
                            },
                            // A token works once: ask for a new one after a refusal.
                            { onError: captcha.reset },
                        )
                    }
                >
                    {start.isPending
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
