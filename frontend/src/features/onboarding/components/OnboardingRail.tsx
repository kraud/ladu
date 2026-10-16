import { BookOpenTextIcon, CheckIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { STEP_META } from '../steps';
import type { TopicId } from '../types';

/** What the user has answered so far; `words` is null until the count step. */
export interface OnboardingSummary {
    languages: string[];
    nativeLanguage: string | null;
    topics: TopicId[];
    words: number | null;
}

function LanguageMini({ label }: { label: string }) {
    return (
        <span className="ob-mini">
            <FlagIcon lang={label} width={16} height={12} />
            {languageByLabel(label)?.native ?? label}
        </span>
    );
}

/**
 * The left column on a wide screen (`MOCKUPS/onboarding.html`): the brand, the four steps with
 * done / current marks, and a live summary of the answers so far.
 * `step`: 0 = welcome, 1–4 = the questions; `finished` = the words are being created.
 */
export function OnboardingRail({
    step,
    finished,
    summary,
}: {
    step: number;
    finished: boolean;
    summary: OnboardingSummary;
}) {
    const { t } = useTranslation();
    const none = <span className="text-muted-foreground">{t('onboarding:summary.none')}</span>;

    return (
        <aside className="ob-rail" aria-label={t('onboarding:rail.label')}>
            <div className="ob-rail-inner">
                <div>
                    <BrandLogo variant="wordmark" height={24} title="Ladu" />
                    <p className="ob-rail-tag">{t('onboarding:rail.tagline')}</p>
                </div>

                <ol className="ob-steps" aria-label={t('onboarding:rail.steps')}>
                    {STEP_META.map(({ id }, index) => {
                        const done = finished || step > index + 1;
                        return (
                            <li
                                key={id}
                                className={done ? 'ob-step done' : 'ob-step'}
                                aria-current={step === index + 1 && !finished ? 'step' : undefined}
                            >
                                <span className="dot">{done ? <CheckIcon size={13} weight="bold" /> : index + 1}</span>
                                {t(`onboarding:steps.${id}`)}
                            </li>
                        );
                    })}
                </ol>

                <section className="ob-summary" aria-label={t('onboarding:summary.title')}>
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                        <BookOpenTextIcon size={15} className="text-(--accent)" />
                        {t('onboarding:summary.title')}
                    </div>
                    <dl className="m-0 flex flex-col gap-3">
                        <div className="ob-sum-item">
                            <dt>{t('onboarding:summary.languages')}</dt>
                            <dd>
                                {summary.languages.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {summary.languages.map((label) => (
                                            <LanguageMini key={label} label={label} />
                                        ))}
                                    </div>
                                ) : (
                                    none
                                )}
                            </dd>
                        </div>
                        <div className="ob-sum-item">
                            <dt>{t('onboarding:summary.native')}</dt>
                            <dd>
                                {summary.nativeLanguage ? (
                                    <LanguageMini label={summary.nativeLanguage} />
                                ) : (
                                    <span className="text-muted-foreground">{t('onboarding:summary.notSet')}</span>
                                )}
                            </dd>
                        </div>
                        <div className="ob-sum-item">
                            <dt>{t('onboarding:summary.interests')}</dt>
                            <dd>
                                {summary.topics.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {summary.topics.map((id) => (
                                            <span key={id} className="ob-mini">
                                                {t(`onboarding:topics.names.${id}`)}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    none
                                )}
                            </dd>
                        </div>
                        <div className="ob-sum-item">
                            <dt>{t('onboarding:summary.words')}</dt>
                            <dd>{summary.words ? <span className="ob-sum-words">{summary.words}</span> : none}</dd>
                        </div>
                    </dl>
                </section>
            </div>
        </aside>
    );
}
