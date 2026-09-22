import { Link } from '@tanstack/react-router';
import { Check, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Button, buttonVariants } from '@/components/ui/button';

type Status = 'pending' | 'success' | 'error';

/**
 * The three-state verification card (`MOCKUPS/auth/verify.html`): a spinning
 * ring while the request is in flight, a check + "Entering Ladu in Ns" countdown
 * on success, an × + "Back to sign in" on failure. Presentational only — the
 * page owns the request and the countdown.
 */
export function VerifyEmailStatus({
    status,
    secondsLeft,
    onEnterNow,
}: {
    status: Status;
    secondsLeft?: number;
    onEnterNow?: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="auth-shell page">
            <BrandLogo variant="outline" height={64} title="Ladu" className="auth-banner" />
            <div className="card w-[min(420px,100%)] px-7 py-10 text-center">
                {status === 'pending' && (
                    <>
                        <span
                            role="status"
                            aria-label={t('loginRegister:userVerification.validating')}
                            className="mx-auto mb-4 block size-13 animate-[spin_0.8s_linear_infinite] rounded-full border-[3px] border-(--fg-soft2) border-t-(--accent)"
                        />
                        <h1 className="h2 text-lg">
                            {t('loginRegister:userVerification.validating')}
                        </h1>
                        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                            {t('loginRegister:userVerification.validatingSubtitle')}
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <span className="mx-auto mb-4 grid size-13 place-items-center rounded-full bg-(--success-soft) text-(--success)">
                            <Check size={26} weight="bold" />
                        </span>
                        <h1 className="h2 text-lg">
                            {t('loginRegister:userVerification.validatingSuccess')}
                        </h1>
                        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                            {t('loginRegister:userVerification.enteringIn', {
                                seconds: Math.max(secondsLeft ?? 0, 0),
                            })}
                        </p>
                        <Button type="button" className="mt-4" onClick={onEnterNow}>
                            {t('loginRegister:userVerification.enterNow')}
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <span className="mx-auto mb-4 grid size-13 place-items-center rounded-full bg-(--danger-soft) text-(--danger)">
                            <X size={26} weight="bold" />
                        </span>
                        <h1 className="h2 text-lg">
                            {t('loginRegister:userVerification.errorValidation')}
                        </h1>
                        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                            {t('loginRegister:errors.linkError')}
                        </p>
                        <Link
                            to="/login"
                            className={buttonVariants({ variant: 'secondary', className: 'mt-4' })}
                        >
                            {t('loginRegister:userVerification.backToSignIn')}
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
