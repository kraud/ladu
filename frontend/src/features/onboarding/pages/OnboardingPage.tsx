import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Button } from '@/components/ui/button';
import { useSkipOnboarding } from '../hooks';

/**
 * `/onboarding` (onboarding.md D27): full screen, outside the app shell — no header, no navigation.
 * Slice 4b shows the welcome and Skip only; the steps come in 4c.
 */
export function OnboardingPage() {
    const { t } = useTranslation();
    const skip = useSkipOnboarding();

    return (
        <div className="page flex min-h-screen flex-col px-4 py-4">
            <header className="flex items-center justify-between">
                <BrandLogo variant="wordmark" height={40} title="Ladu" />
                <Button variant="ghost" disabled={skip.isPending} onClick={() => skip.mutate()}>
                    {skip.isPending ? t('onboarding:skipping') : t('onboarding:skip')}
                </Button>
            </header>

            <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4">
                <h1 className="h1">{t('onboarding:welcome.title')}</h1>
                <p>{t('onboarding:welcome.text')}</p>
                {skip.isError && (
                    <p className="banner warning" role="alert">
                        {t('common:errors.somethingWrong')}
                    </p>
                )}
            </main>
        </div>
    );
}
