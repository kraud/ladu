import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { getApiErrorCode } from '@/api/types';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui/button';
import { useUpdateProfile } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';
import { BuildingStep } from '../components/BuildingStep';
import { CountStep } from '../components/CountStep';
import { LanguagesStep } from '../components/LanguagesStep';
import { LevelsStep } from '../components/LevelsStep';
import { OnboardingShell } from '../components/OnboardingShell';
import { TopicsStep } from '../components/TopicsStep';
import { WelcomeStep } from '../components/WelcomeStep';
import { useCapacity, useCreateOnboarding, useSkipOnboarding } from '../hooks';
import { learningLanguages, sliderRange } from '../learning';
import { MIN_TOPICS, type Level, type TopicId } from '../types';

/** 0 = welcome; 1 languages, 2 levels, 3 topics, 4 count (the last step has Create). */
type Step = 0 | 1 | 2 | 3 | 4;
const LAST_STEP = 4;

/**
 * `/onboarding` (onboarding.md D27): full screen, outside the app shell — no header, no navigation.
 * The answers stay in this component until Create; the languages are the only thing saved earlier,
 * because the server reads them from the account (D8).
 */
export function OnboardingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const skip = useSkipOnboarding();
    const updateProfile = useUpdateProfile();
    const create = useCreateOnboarding();

    const [step, setStep] = useState<Step>(0);
    const [confirmSkip, setConfirmSkip] = useState(false);
    // The languages from registration: the only ones the first question offers. Fixed at mount, so a saved change does not shrink the list.
    const [registeredLanguages] = useState<string[]>(user?.languages ?? []);
    const [languages, setLanguages] = useState<string[]>(user?.languages ?? []);
    const [nativeLanguage, setNativeLanguage] = useState<string | null>(
        user?.nativeLanguage && user.languages.includes(user.nativeLanguage) ? user.nativeLanguage : null,
    );
    const [levels, setLevels] = useState<Record<string, Level>>({});
    const [topics, setTopics] = useState<TopicId[]>([]);
    const [pickedCount, setPickedCount] = useState<number | null>(null);

    const learning = learningLanguages(languages, nativeLanguage);
    // Only the learning languages count: a level for a language that was removed is ignored.
    const choice = { levels: Object.fromEntries(learning.filter((l) => levels[l]).map((l) => [l, levels[l]])), topics };
    const capacity = useCapacity(choice, step === LAST_STEP);
    const range = capacity.data === undefined ? null : sliderRange(capacity.data);
    const count = range ? Math.min(Math.max(pickedCount ?? Math.min(100, range.max), range.min), range.max) : 0;

    if (!user) return null;

    const busy = skip.isPending || updateProfile.isPending;
    const profileChanged =
        languages.join('|') !== user.languages.join('|') || nativeLanguage !== (user.nativeLanguage ?? null);

    const canNext =
        step === 0 ||
        (step === 1 && languages.length >= 2) ||
        (step === 2 && learning.every((l) => levels[l])) ||
        (step === 3 && topics.length >= MIN_TOPICS) ||
        (step === 4 && range !== null);

    function next() {
        if (step === 1 && profileChanged && user) {
            // The server reads the languages from the account, so save them before the levels step.
            updateProfile.mutate(
                {
                    email: user.email,
                    name: user.name,
                    username: user.username,
                    languages,
                    uiLanguage: user.uiLanguage,
                    nativeLanguage,
                },
                { onSuccess: () => setStep(2) },
            );
        } else if (step === LAST_STEP) {
            create.mutate(
                { ...choice, count },
                {
                    onError: async (error) => {
                        const code = getApiErrorCode(error);
                        if (code === 'onboarding_not_pending' || code === 'onboarding_disabled') await navigate({ to: '/' });
                    },
                },
            );
        } else {
            setStep((step + 1) as Step);
        }
    }

    const summary = {
        languages,
        nativeLanguage,
        topics,
        words: step === LAST_STEP && count ? count : null,
    };

    if (create.isPending) {
        return (
            <OnboardingShell
                step={LAST_STEP}
                building
                summary={summary}
                skip={{ label: t('onboarding:skip'), onClick: () => undefined, disabled: true }}
                next={{ label: '', onClick: () => undefined, disabled: true }}
            >
                <BuildingStep words={count} topics={topics.length} />
            </OnboardingShell>
        );
    }

    return (
        <OnboardingShell
            step={step}
            summary={summary}
            skip={{
                label: skip.isPending ? t('onboarding:skipping') : t('onboarding:skip'),
                onClick: () => setConfirmSkip(true),
                disabled: busy,
            }}
            back={step > 1 ? { label: t('onboarding:back'), onClick: () => setStep((step - 1) as Step), disabled: busy } : undefined}
            next={{
                label:
                    step === 0
                        ? t('onboarding:start')
                        : step === LAST_STEP
                          ? t('onboarding:count.create', { count })
                          : updateProfile.isPending
                            ? t('onboarding:saving')
                            : t('onboarding:next'),
                onClick: next,
                disabled: !canNext || busy,
            }}
        >
            {step === 0 && <WelcomeStep />}
            {step === 1 && (
                <LanguagesStep
                    languages={languages}
                    options={registeredLanguages}
                    nativeLanguage={nativeLanguage}
                    onLanguages={setLanguages}
                    onNative={setNativeLanguage}
                />
            )}
            {step === 2 && <LevelsStep languages={learning} value={levels} onChange={setLevels} />}
            {step === 3 && <TopicsStep value={topics} onChange={setTopics} />}
            {step === 4 &&
                (capacity.isPending ? (
                    <LoadingScreen label={t('onboarding:count.loading')} />
                ) : capacity.isError ? (
                    <div className="mt-5 flex flex-col items-start gap-2">
                        <p className="banner warning" role="alert">
                            {t('common:errors.somethingWrong')}
                        </p>
                        <Button variant="secondary" onClick={() => void capacity.refetch()}>
                            {t('onboarding:retry')}
                        </Button>
                    </div>
                ) : (
                    <CountStep capacity={capacity.data} value={count} onChange={setPickedCount} />
                ))}

            {(skip.isError || create.isError) && (
                <p className="banner warning mt-5" role="alert">
                    {t('common:errors.somethingWrong')}
                </p>
            )}

            <ConfirmDialog
                open={confirmSkip}
                onOpenChange={setConfirmSkip}
                title={t('onboarding:skipDialog.title')}
                description={t('onboarding:skipDialog.text')}
                confirmLabel={t('onboarding:skipDialog.confirm')}
                cancelLabel={t('onboarding:skipDialog.cancel')}
                destructive={false}
                onConfirm={() => skip.mutate()}
            />
        </OnboardingShell>
    );
}
