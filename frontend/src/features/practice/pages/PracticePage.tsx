import { useEffect, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { BookOpenIcon, WarningIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { useWordsInfinite } from '@/features/words/hooks';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ParametersForm } from '../components/ParametersForm';
import { SavedConfigurations } from '../components/SavedConfigurations';
import { SavedSessions } from '../components/SavedSessions';
import { SaveConfigDialog, type ConfigDraft } from '../components/SaveConfigDialog';
import { PreselectedWords } from '../components/PreselectedWords';
import { ResumeSessionBanner } from '../components/ResumeSessionBanner';
import { ResultsView } from '../components/ResultsView';
import { SessionView } from '../components/SessionView';
import { configToParams, narrowToPickable } from '../configs';
import type { PreselectedWord } from '../preselection';
import { loadRememberedParams, rememberParams } from '../remembered';
import { paramsToSearch, searchToParams } from '../search';
import type { Session } from '../session';
import { usePracticeSessionStore, useSessionFor } from '../sessionStore';
import type { PracticeParams, SavedConfig } from '../types';

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
    const parked = usePracticeSessionStore((s) => s.parked);
    const clearSession = usePracticeSessionStore((s) => s.clear);
    const resumeSession = usePracticeSessionStore((s) => s.resume);

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

    // A parked session (the user navigated away) waits behind the set-up banner; a reload keeps it open.
    if (session && !parked && !preselected) {
        return session.view === 'results' ? (
            <ResultsView session={session} onChangeSettings={() => changeSettings(session)} />
        ) : (
            <SessionView session={session} />
        );
    }

    return (
        <SetUp
            preselected={preselected}
            onPreselect={setPreselected}
            parkedSession={session && parked && !preselected ? session : null}
            onResume={resumeSession}
            onDismiss={clearSession}
        />
    );
}

function SetUp({
    preselected,
    onPreselect,
    parkedSession,
    onResume,
    onDismiss,
}: {
    preselected: PreselectedWord[] | null;
    /** Replace the pre-selected words (`null` = none): a saved configuration was loaded, or the words were cleared. */
    onPreselect: (words: PreselectedWord[] | null) => void;
    parkedSession: Session | null;
    onResume: () => void;
    onDismiss: () => void;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user)!;
    const search = route.useSearch();
    const navigate = route.useNavigate();

    // The URL wins over the remembered settings, which win over the defaults (C5). Read once.
    const [initialParams, setInitialParams] = useState<PracticeParams>(() =>
        narrowToPickable(searchToParams(search, loadRememberedParams(user.languages), user.languages), preselected),
    );
    // A loaded configuration replaces the form's working copy, so the form starts over (new key).
    const [formKey, setFormKey] = useState(0);
    // Set when a loaded configuration has words that are gone (no details, on purpose).
    const [wordsMissing, setWordsMissing] = useState(false);
    const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);

    function loadConfig(config: SavedConfig, words: PreselectedWord[] | null) {
        const params = configToParams(config.params, user.languages, words);
        setInitialParams(params);
        setFormKey((key) => key + 1);
        onPreselect(words && words.length > 0 ? words : null);
        setWordsMissing((config.wordIds?.length ?? 0) > (words?.length ?? 0));
        void navigate({ search: paramsToSearch(params), replace: true });
        toast.success(t('practice:configs.toast.loaded', { name: config.name }));
    }

    function clearPreselected() {
        setWordsMissing(false);
        onPreselect(null);
    }

    // Only used to tell "no words at all" from "no exercises": one row is enough.
    const words = useWordsInfinite({}, 1);
    const hasNoWords = !preselected && words.isSuccess && (words.data.pages[0]?.total ?? 0) === 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Stacked on mobile; side-by-side with the subtitle bottom-aligned from `sm` up (as on Add word). */}
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <h1 className="h1">{t('practice:setup.title')}</h1>
                <p className="meta sm:content-end">{t('practice:setup.subtitle')}</p>
            </div>
            {parkedSession && (
                <ResumeSessionBanner session={parkedSession} onResume={onResume} onDismiss={onDismiss} />
            )}
            {hasNoWords ? (
                <div className="card">
                    <EmptyState
                        icon={<BookOpenIcon aria-hidden size={20} />}
                        title={t('practice:setup.noWords.title')}
                        description={t('practice:setup.noWords.body')}
                        action={
                            <Link to="/addWord/{-$partOfSpeech}" className={buttonVariants({ size: 'sm' })}>
                                {t('practice:setup.noWords.cta')}
                            </Link>
                        }
                    />
                </div>
            ) : (
                <>
                    {wordsMissing && (
                        <div className="banner warning items-start" role="status">
                            <WarningIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
                            <span className="grow">{t('practice:configs.missingWords')}</span>
                        </div>
                    )}
                    {preselected && <PreselectedWords words={preselected} onClear={clearPreselected} />}
                    <ParametersForm
                        key={formKey}
                        user={user}
                        initialParams={initialParams}
                        preselected={preselected}
                        onStarted={clearPreselected}
                        onSaveConfig={setConfigDraft}
                        onParamsChange={(params) =>
                            void navigate({ search: paramsToSearch(params), replace: true })
                        }
                    />
                    <SavedConfigurations onLoad={loadConfig} />
                    <SavedSessions hasUnfinished={parkedSession !== null} onResumed={clearPreselected} />
                    {configDraft && (
                        <SaveConfigDialog
                            open
                            onOpenChange={(open) => !open && setConfigDraft(null)}
                            mode="create"
                            draft={configDraft}
                        />
                    )}
                </>
            )}
        </div>
    );
}
