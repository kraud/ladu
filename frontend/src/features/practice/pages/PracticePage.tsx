import { useEffect, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { useWordsInfinite } from '@/features/words/hooks';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ParametersForm } from '../components/ParametersForm';
import { PreselectedWords } from '../components/PreselectedWords';
import { ResultsView } from '../components/ResultsView';
import { SessionView } from '../components/SessionView';
import { narrowPartsOfSpeech } from '../params';
import { availablePartsOfSpeech, type PreselectedWord } from '../preselection';
import { loadRememberedParams, rememberParams } from '../remembered';
import { paramsToSearch, searchToParams } from '../search';
import { usePracticeSessionStore, useSessionFor } from '../sessionStore';
import type { PracticeParams } from '../types';

const route = getRouteApi('/_protected/practice');

/**
 * `/practice`: Stage 1 (set-up), Stage 2 (the exercise cards), Stage 3 (results).
 *
 * Entry from Review: the words wait in `uiStore`. They are read once at mount
 * and cleared, so a later visit to `/practice` starts clean. They win over a
 * running session — that session is dropped (its answers are already saved).
 */
export function PracticePage() {
    const user = useAuthStore((s) => s.user);
    const session = useSessionFor(user?.id);
    const clearSession = usePracticeSessionStore((s) => s.clear);

    const navigate = route.useNavigate();
    const [preselected, setPreselected] = useState(() => useUiStore.getState().practicePreselection);
    useEffect(() => {
        if (useUiStore.getState().practicePreselection) {
            useUiStore.getState().setPracticePreselection(null);
            clearSession();
        }
    }, [clearSession]);

    if (!user) return null;

    /** Back to Stage 1 with the settings and the words of the finished session. */
    function changeSettings(finished: NonNullable<typeof session>) {
        // The set-up reads the URL at mount, and the navigation settles later: the remembered copy is the sync carrier.
        rememberParams(finished.params);
        void navigate({ search: paramsToSearch(finished.params), replace: true });
        setPreselected(finished.preselected);
        clearSession();
    }

    if (session && !preselected) {
        return session.view === 'results' ? (
            <ResultsView session={session} onChangeSettings={() => changeSettings(session)} />
        ) : (
            <SessionView session={session} />
        );
    }

    return <SetUp preselected={preselected} onClearPreselected={() => setPreselected(null)} />;
}

function SetUp({
    preselected,
    onClearPreselected,
}: {
    preselected: PreselectedWord[] | null;
    onClearPreselected: () => void;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user)!;
    const search = route.useSearch();
    const navigate = route.useNavigate();

    // The URL wins over the remembered settings, which win over the defaults (C5). Read once.
    const [initialParams] = useState<PracticeParams>(() => {
        const merged = searchToParams(search, loadRememberedParams(user.languages), user.languages);
        const available = availablePartsOfSpeech(preselected);
        return available ? { ...merged, partsOfSpeech: narrowPartsOfSpeech(merged.partsOfSpeech, available) } : merged;
    });

    // Only used to tell "no words at all" from "no exercises": one row is enough.
    const words = useWordsInfinite({}, 1);
    const hasNoWords = !preselected && words.isSuccess && (words.data.pages[0]?.total ?? 0) === 0;

    if (hasNoWords) {
        return (
            <EmptyState
                title={t('practice:setup.noWords.title')}
                description={t('practice:setup.noWords.body')}
                action={
                    <Link to="/addWord/{-$partOfSpeech}" className={buttonVariants()}>
                        {t('practice:setup.noWords.cta')}
                    </Link>
                }
            />
        );
    }

    return (
        <div className="flex max-w-2xl flex-col gap-4">
            <h1 className="h1">{t('practice:setup.title')}</h1>
            {preselected && <PreselectedWords words={preselected} onClear={onClearPreselected} />}
            <ParametersForm
                user={user}
                initialParams={initialParams}
                preselected={preselected}
                onStarted={onClearPreselected}
                onParamsChange={(params) =>
                    void navigate({ search: paramsToSearch(params), replace: true })
                }
            />
        </div>
    );
}
