import type { ReactNode } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Button } from '@/components/ui/button';
import { STEP_META } from '../steps';
import { OnboardingRail, type OnboardingSummary } from './OnboardingRail';

interface Action {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

/**
 * The frame of every onboarding screen (`MOCKUPS/onboarding.html`, onboarding.md D27): a rail with the
 * progress and a summary (a sticky top bar on a narrow screen), and a panel with the step label, Skip,
 * the content, and Back / Next. No app header. `step`: 0 = welcome, 1–4 = the questions; `building`
 * hides Back / Next while the words are created.
 */
export function OnboardingShell({
    step,
    building = false,
    summary,
    skip,
    back,
    next,
    children,
}: {
    step: number;
    building?: boolean;
    summary: OnboardingSummary;
    skip: Action;
    back?: Action;
    next: Action;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const total = STEP_META.length;

    const eyebrow = building
        ? t('onboarding:almostDone')
        : step === 0
          ? t('onboarding:welcomeEyebrow')
          : t('onboarding:progress', { step, total });

    const parts = [
        summary.languages.length ? t('onboarding:summary.languagesCount', { count: summary.languages.length }) : null,
        summary.topics.length ? t('onboarding:summary.topicsCount', { count: summary.topics.length }) : null,
        summary.words ? t('onboarding:summary.wordsCount', { count: summary.words }) : null,
    ].filter(Boolean);
    const progress = building ? 100 : (step / total) * 100;

    return (
        <div className="ob-wrap page">
            <div className="ob-shell">
                <OnboardingRail step={step} finished={building} summary={summary} />

                <section className="ob-panel">
                    <div className="ob-mobilebar">
                        <div className="ob-mobilebar-top">
                            <BrandLogo variant="wordmark" height={22} title="Ladu" />
                            <span className="ob-mobilebar-step">{eyebrow}</span>
                        </div>
                        <div className="ob-mobilebar-progress" aria-hidden="true">
                            <span style={{ width: `${progress}%` }} />
                        </div>
                        <div className="ob-mobilebar-sum">
                            {parts.length && step > 0 ? parts.join(' · ') : t('onboarding:rail.tagline')}
                        </div>
                    </div>

                    <div className="ob-panel-head">
                        <span className="ob-eyebrow" aria-live="polite">
                            {eyebrow}
                        </span>
                        <Button variant="ghost" size="sm" disabled={skip.disabled} onClick={skip.onClick}>
                            {skip.label}
                            <CaretRightIcon size={14} weight="bold" />
                        </Button>
                    </div>

                    <div className="ob-content">
                        <div className="ob-content-inner">{children}</div>
                    </div>

                    {!building && (
                        <div className="ob-foot">
                            {back ? (
                                <Button variant="secondary" disabled={back.disabled} onClick={back.onClick}>
                                    <CaretLeftIcon size={15} weight="bold" />
                                    {back.label}
                                </Button>
                            ) : (
                                <span />
                            )}
                            <Button className="h-11 px-5 text-[15px]" disabled={next.disabled} onClick={next.onClick}>
                                {next.label}
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
