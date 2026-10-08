import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import {
    ArrowLeftIcon,
    BookOpenIcon,
    ListChecksIcon,
    MagnifyingGlassPlusIcon,
    PlusIcon,
    WarningIcon,
} from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { PageColumn } from '@/components/layout/PageColumn';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import type { TagSummary } from '@/features/tags/types';
import { useWordsInfinite } from '@/features/words/hooks';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ParametersForm } from '../components/ParametersForm';
import { SavedConfigurations, type LoadedTags } from '../components/SavedConfigurations';
import { SavedSessions } from '../components/SavedSessions';
import { SaveConfigDialog, type ConfigDraft } from '../components/SaveConfigDialog';
import { StartConfigDialog } from '../components/StartConfigDialog';
import { PreselectedWords, type WordsMode } from '../components/PreselectedWords';
import { TagWordsSidebar } from '../components/TagWordsSidebar';
import { ResumeSessionBanner } from '../components/ResumeSessionBanner';
import { ResultsView } from '../components/ResultsView';
import { SessionView } from '../components/SessionView';
import { configToParams, narrowToPickable } from '../configs';
import { practiceErrorKey } from '../errors';
import { tagWordsQuery, useConfigs, useGenerateExercises, useSavedSessions, useTagWords } from '../hooks';
import { toGenerateBody } from '../params';
import { unionWords, type PreselectedWord } from '../preselection';
import { loadRememberedParams, rememberParams } from '../remembered';
import { paramsToSearch, searchToParams } from '../search';
import type { Session } from '../session';
import { usePracticeSessionStore, useSessionFor } from '../sessionStore';
import type { PracticeParams, SavedConfig } from '../types';

const route = getRouteApi('/_protected/practice');

/**
 * `/practice`: Stage 1 (set-up), Stage 2 (the exercise cards), Stage 3 (results).
 *
 * Stage 1 uses the shared `SidebarLayout`. The main area has the title (with a
 * "New configuration" button on its right), the resume banner and two badges:
 * Ongoing sessions (the default) and Saved configurations. The button opens the
 * New configuration view (the settings form, with a sticky Start / Save bar):
 * the badges and the button go away, and a back arrow comes before the title.
 * The sidebar holds the selected words and exists only in that view; elsewhere
 * the layout renders no panel. Stages 2 and 3 and the "no words" message have
 * no sidebar and sit in the normal centered column (`PageColumn`).
 */
export function PracticePage() {
    const user = useAuthStore((s) => s.user);
    const session = useSessionFor(user?.id);
    const parked = usePracticeSessionStore((s) => s.parked);
    const clearSession = usePracticeSessionStore((s) => s.clear);
    const resumeSession = usePracticeSessionStore((s) => s.resume);

    const navigate = route.useNavigate();
    const [preselected, setPreselected] = useState(() => useUiStore.getState().practicePreselection);
    // Set when the user leaves the results to change the settings: the set-up then opens on New configuration.
    const [startOnNew, setStartOnNew] = useState(false);
    useEffect(() => {
        if (useUiStore.getState().practicePreselection) {
            useUiStore.getState().setPracticePreselection(null);
            // Words came from Review: the sidebar (collapsed while it is empty) opens to show them.
            useUiStore.getState().setSidebarCollapsed('practice', false);
            clearSession();
        }
    }, [clearSession]);

    if (!user) return null;

    /** Back to Stage 1 (the lists), without the settings of the finished session. */
    function finish() {
        void navigate({ search: {}, replace: true });
        clearSession();
    }

    /** Back to Stage 1 with the settings and the words of the finished session. */
    function changeSettings(finished: NonNullable<typeof session>) {
        // The set-up reads the URL at mount, and the navigation settles later: the remembered copy is the sync carrier.
        rememberParams(finished.params);
        void navigate({ search: paramsToSearch(finished.params), replace: true });
        setPreselected(finished.preselected);
        if (finished.preselected) useUiStore.getState().setSidebarCollapsed('practice', false);
        setStartOnNew(true);
        clearSession();
    }

    // A parked session (the user navigated away) waits behind the set-up banner; a reload keeps it open.
    if (session && !parked && !preselected) {
        return session.view === 'results' ? (
            <ResultsPage session={session} onChangeSettings={() => changeSettings(session)} onFinish={finish} />
        ) : (
            <PageColumn>
                <SessionView session={session} />
            </PageColumn>
        );
    }

    return (
        <SetUp
            preselected={preselected}
            onPreselect={setPreselected}
            parkedSession={session && parked && !preselected ? session : null}
            onResume={resumeSession}
            onDismiss={clearSession}
            startOnNew={startOnNew}
        />
    );
}

/**
 * Stage 3 inside the sidebar layout: the sidebar lists the words of the finished session, filtered
 * by the settings it used (fixed: they cannot be changed here). No pre-selected words, no panel.
 */
function ResultsPage({
    session,
    onChangeSettings,
    onFinish,
}: {
    session: Session;
    onChangeSettings: () => void;
    onFinish: () => void;
}) {
    const { t } = useTranslation();
    const [wordsMode, setWordsMode] = useState<WordsMode>('visible');
    const words = session.preselected;
    const sections: SidebarSection[] = words
        ? [
              {
                  id: 'words',
                  label: t('practice:setup.selectedWords'),
                  icon: <ListChecksIcon size={18} />,
                  count: words.length,
                  content: (
                      <PreselectedWords words={words} params={session.params} mode={wordsMode} onModeChange={setWordsMode} />
                  ),
              },
          ]
        : [];

    return (
        <SidebarLayout id="practiceResults" width="wide" label={t('practice:setup.selectedWords')} sections={sections}>
            <div className="flex flex-col gap-3">
                {words && (
                    <SidebarTrigger
                        label={t('practice:setup.selectedWordsButton', { count: words.length })}
                        className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}
                    >
                        <ListChecksIcon size={16} />
                        {t('practice:setup.selectedWordsButton', { count: words.length })}
                    </SidebarTrigger>
                )}
                <ResultsView session={session} onChangeSettings={onChangeSettings} onFinish={onFinish} />
            </div>
        </SidebarLayout>
    );
}

type SetUpTab = 'sessions' | 'configs';

function SetUp({
    preselected,
    onPreselect,
    parkedSession,
    onResume,
    onDismiss,
    startOnNew,
}: {
    preselected: PreselectedWord[] | null;
    /** The user came back from the results to change the settings: open on New configuration. */
    startOnNew: boolean;
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
    // The settings as they are on screen right now: the words list follows them.
    const [liveParams, setLiveParams] = useState<PracticeParams>(initialParams);
    const [wordsMode, setWordsMode] = useState<WordsMode>('visible');
    // Without words from Review the user can choose words by tag; the tags' words are the pre-selection.
    const [tags, setTags] = useState<TagSummary[]>([]);
    const tagWords = useTagWords(
        preselected ? [] : tags.map((tag) => tag.id),
        accountLanguageOrder(user.languages),
    );
    const tagUnion = unionWords(tags.map((tag) => tagWords.byTag[tag.id] ?? []));
    const usingTags = !preselected && tags.length > 0;
    // What the exercises will be limited to: Review's words, else the tags' words (once loaded), else all words.
    const effective: PreselectedWord[] | null = preselected ?? (usingTags && tagUnion.length > 0 ? tagUnion : null);
    const tagsBlockedReason = !usingTags
        ? undefined
        : tagWords.isError
          ? t('practice:setup.tagsBlocked.error')
          : tagWords.isPending
            ? t('practice:setup.tagsBlocked.loading')
            : tagUnion.length === 0
              ? t('practice:setup.tagsBlocked.empty')
              : undefined;
    // The list follows the settings as they will be used (word types the words do not have fall away).
    const listParams = narrowToPickable(liveParams, effective);
    // A loaded configuration replaces the form's working copy, so the form starts over (new key).
    const [formKey, setFormKey] = useState(0);
    // Set when a loaded configuration has words that are gone (no details, on purpose).
    const [wordsMissing, setWordsMissing] = useState(false);
    const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
    // A saved configuration the user selected: start it now, or change it first (the dialog).
    const [chosen, setChosen] = useState<{
        config: SavedConfig;
        words: PreselectedWord[] | null;
        loadedTags: LoadedTags | null;
    } | null>(null);
    const [startError, setStartError] = useState<string | null>(null);
    const [preparing, setPreparing] = useState(false);
    const generate = useGenerateExercises();
    const queryClient = useQueryClient();
    const startSession = usePracticeSessionStore((s) => s.start);
    // The fixed bottom bar of the layout; the form puts Start / Save into it while the New configuration tab is open.
    const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
    // From Review (with words) the user is here to set up a session; otherwise the ongoing sessions come first.
    const [creating, setCreating] = useState(() => !!preselected || startOnNew);
    const [tab, setTab] = useState<SetUpTab>('sessions');
    const isMobile = useIsMobile();

    // Open on the first list that has something: ongoing sessions, else saved configurations, else New configuration.
    // Decided once, when both lists have loaded (a failed list counts as filled, so its error shows);
    // a tab the user picks first wins.
    const savedSessions = useSavedSessions();
    const savedConfigs = useConfigs();
    const [opened, setOpened] = useState(() => creating);
    if (!opened && !savedSessions.isPending && !savedConfigs.isPending) {
        setOpened(true);
        if (savedSessions.isSuccess && savedSessions.data.length === 0) {
            if (savedConfigs.isSuccess && savedConfigs.data.length === 0) {
                useUiStore.getState().setSidebarCollapsed('practice', false);
                setCreating(true);
            } else {
                setTab('configs');
            }
        }
    }

    function openNewConfiguration() {
        // The panel opens expanded here, as it does for words that come from Review.
        useUiStore.getState().setSidebarCollapsed('practice', false);
        setCreating(true);
    }

    function loadConfig(config: SavedConfig, words: PreselectedWord[] | null, loadedTags: LoadedTags | null) {
        // Words chosen by tag come live from the tags, so the settings are not narrowed to words yet:
        // the form follows the words as they load.
        const chosenTags = loadedTags?.tags ?? [];
        const params = configToParams(config.params, user.languages, words);
        setInitialParams(params);
        setLiveParams(params);
        setFormKey((key) => key + 1);
        onPreselect(words && words.length > 0 ? words : null);
        setTags(chosenTags);
        const tagsGone = loadedTags?.missing ?? 0;
        setWordsMissing(
            chosenTags.length > 0 ? tagsGone > 0 : tagsGone > 0 || (config.wordIds?.length ?? 0) > (words?.length ?? 0),
        );
        if ((words && words.length > 0) || chosenTags.length > 0) {
            useUiStore.getState().setSidebarCollapsed('practice', false);
        }
        void navigate({ search: paramsToSearch(params), replace: true });
        // The loaded settings are in the New configuration view.
        setCreating(true);
        toast.success(t('practice:configs.toast.loaded', { name: config.name }));
    }

    function chooseConfig(config: SavedConfig, words: PreselectedWord[] | null, loadedTags: LoadedTags | null) {
        setStartError(null);
        setChosen({ config, words, loadedTags });
    }

    /** "Start session" in the dialog: the first exercise opens at once, the settings screen is skipped. */
    async function startChosen() {
        if (!chosen || preparing || generate.isPending) return;
        setStartError(null);
        const { config, words, loadedTags } = chosen;
        const chosenTags = loadedTags?.tags ?? [];
        let list: PreselectedWord[] | null = words && words.length > 0 ? words : null;
        if (chosenTags.length > 0) {
            // Words chosen by tag come live from the tags.
            setPreparing(true);
            try {
                const order = accountLanguageOrder(user.languages);
                list = unionWords(await Promise.all(chosenTags.map((tag) => queryClient.fetchQuery(tagWordsQuery(tag.id, order)))));
            } catch {
                setStartError(t('practice:setup.tagsBlocked.error'));
                return;
            } finally {
                setPreparing(false);
            }
            if (list.length === 0) {
                setStartError(t('practice:configs.startDialog.noWords'));
                return;
            }
        }
        const params = configToParams(config.params, user.languages, list);
        const wordIds = list?.map((word) => word.id) ?? null;
        generate.mutate(toGenerateBody(params, wordIds ?? undefined), {
            onSuccess: ({ exercises }) => {
                if (exercises.length === 0) {
                    setStartError(t('practice:configs.startDialog.noMatch'));
                    return;
                }
                rememberParams(params);
                startSession({ userId: user.id, params, wordIds, preselected: list, exercises });
            },
            onError: (error) => setStartError(t(practiceErrorKey(error))),
        });
    }

    function clearPreselected() {
        setWordsMissing(false);
        onPreselect(null);
        setTags([]);
    }

    // Only used to tell "no words at all" from "no exercises": one row is enough.
    const words = useWordsInfinite({}, 1);
    const hasNoWords = !preselected && words.isSuccess && (words.data.pages[0]?.total ?? 0) === 0;

    // Like Tags: the title with its action on the right. The New configuration view has a back arrow instead.
    const header = creating ? (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className="icon-btn"
                aria-label={t('practice:setup.newConfigurationBack')}
                title={t('practice:setup.newConfigurationBack')}
                onClick={() => setCreating(false)}
            >
                <ArrowLeftIcon size={18} />
            </button>
            <h1 className="h1">{t('practice:setup.newConfiguration')}</h1>
        </div>
    ) : (
        <div className="flex items-center justify-between gap-2">
            <h1 className="h1">{t('practice:setup.title')}</h1>
            <Button onClick={openNewConfiguration}>
                <PlusIcon size={15} weight="bold" />
                {t('practice:setup.newConfiguration')}
            </Button>
        </div>
    );
    // Like the scope badges of Tags: one badge is active, and it picks the list below.
    const scopeRail = (
        <div className="scope-rail" role="group" aria-label={t('practice:setup.listGroupLabel')}>
            {(['sessions', 'configs'] as const).map((candidate) => (
                <button
                    key={candidate}
                    type="button"
                    className="chip"
                    aria-pressed={tab === candidate}
                    onClick={() => {
                        setOpened(true);
                        setTab(candidate);
                    }}
                >
                    {t(candidate === 'sessions' ? 'practice:sessions.title' : 'practice:configs.title')}
                </button>
            ))}
        </div>
    );
    const plainHeader = <h1 className="h1">{t('practice:setup.title')}</h1>;
    const resumeBanner = parkedSession && (
        <ResumeSessionBanner session={parkedSession} onResume={onResume} onDismiss={onDismiss} />
    );

    if (hasNoWords) {
        return (
            <PageColumn>
                <div className="flex flex-col gap-4">
                    {plainHeader}
                    {resumeBanner}
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
                </div>
            </PageColumn>
        );
    }

    // In the New configuration view the sidebar always exists: Review's words, or the tag picker.
    const sections: SidebarSection[] =
        creating
            ? [
                  {
                      id: 'words',
                      label: t('practice:setup.selectedWords'),
                      icon: <ListChecksIcon size={18} />,
                      count: effective?.length ?? 0,
                      content: preselected ? (
                          <PreselectedWords
                              words={preselected}
                              params={listParams}
                              mode={wordsMode}
                              onModeChange={setWordsMode}
                              onClear={clearPreselected}
                          />
                      ) : (
                          <TagWordsSidebar
                              tags={tags}
                              onTagsChange={setTags}
                              byTag={tagWords.byTag}
                              words={tagUnion}
                              params={listParams}
                              mode={wordsMode}
                              onModeChange={setWordsMode}
                          />
                      ),
                  },
              ]
            : [];

    return (
        <SidebarLayout
            id="practice"
            width="wide"
            label={t('practice:setup.selectedWords')}
            sections={sections}
            header={header}
            footer={creating ? <div ref={setActionsHost} /> : undefined}
            footerAligned
        >
            <div className="flex flex-col gap-4">
                {resumeBanner}
                {!creating && tab === 'sessions' && (
                    <SavedSessions
                        hasUnfinished={parkedSession !== null}
                        onResumed={clearPreselected}
                        rail={scopeRail}
                        onNew={openNewConfiguration}
                    />
                )}
                {!creating && tab === 'configs' && <SavedConfigurations onLoad={chooseConfig} rail={scopeRail} onNew={openNewConfiguration} />}
                {/* Kept mounted while hidden: the form holds the working copy of the settings. */}
                <div hidden={!creating} className="flex flex-col gap-3">
                    {wordsMissing && (
                        <div className="banner warning items-start" role="status">
                            <WarningIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
                            <span className="grow">{t('practice:configs.missingWords')}</span>
                        </div>
                    )}
                    <ParametersForm
                        key={formKey}
                        user={user}
                        initialParams={initialParams}
                        preselected={effective}
                        actionsHost={creating ? actionsHost : null}
                        tagIds={usingTags ? tags.map((tag) => tag.id) : null}
                        startBlockedReason={tagsBlockedReason}
                        onStarted={clearPreselected}
                        onSaveConfig={setConfigDraft}
                        wordsSlot={
                            isMobile ? (
                                <WordsBadges count={effective?.length ?? 0} onAll={clearPreselected} />
                            ) : undefined
                        }
                        onParamsChange={(params) => {
                            setLiveParams(params);
                            void navigate({ search: paramsToSearch(params), replace: true });
                        }}
                    />
                </div>
            </div>
            {chosen && (
                <StartConfigDialog
                    config={chosen.config}
                    starting={preparing || generate.isPending}
                    error={startError}
                    onStart={() => void startChosen()}
                    onChange={() => {
                        loadConfig(chosen.config, chosen.words, chosen.loadedTags);
                        setChosen(null);
                    }}
                    onCancel={() => setChosen(null)}
                />
            )}
            {configDraft && (
                <SaveConfigDialog
                    open
                    onOpenChange={(open) => !open && setConfigDraft(null)}
                    mode="create"
                    draft={configDraft}
                />
            )}
        </SidebarLayout>
    );
}

/**
 * Phone only: which words the session uses, as two badges (one active). "All" uses every word;
 * "(X) Selected" opens the words drawer. With nothing selected, "All" is the active one.
 */
function WordsBadges({ count, onAll }: { count: number; onAll: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-wrap gap-1.5">
            <button type="button" className="chip" aria-pressed={count === 0} onClick={onAll}>
                {t('practice:setup.selectedWordsAll')}
            </button>
            <SidebarTrigger
                label={t('practice:setup.selectedWordsButton', { count })}
                className="chip"
                active={count > 0}
            >
                <span
                    aria-hidden
                    className="grid min-w-4.5 place-items-center rounded-full bg-(--accent) px-1 text-[11px] font-semibold leading-4.5 text-(--accent-ink)"
                >
                    {count}
                </span>
                {t('practice:setup.selectedWordsChip')}
                <MagnifyingGlassPlusIcon aria-hidden size={14} />
            </SidebarTrigger>
        </div>
    );
}
