import { useEffect, useState } from 'react';
import { getRouteApi, Link } from '@tanstack/react-router';
import { BookOpenIcon, ListChecksIcon, WarningIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { PageColumn } from '@/components/layout/PageColumn';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TagSummary } from '@/features/tags/types';
import { useWordsInfinite } from '@/features/words/hooks';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ParametersForm } from '../components/ParametersForm';
import { SavedConfigurations, type LoadedTags } from '../components/SavedConfigurations';
import { SavedSessions } from '../components/SavedSessions';
import { SaveConfigDialog, type ConfigDraft } from '../components/SaveConfigDialog';
import { PreselectedWords, type WordsMode } from '../components/PreselectedWords';
import { TagWordsSidebar } from '../components/TagWordsSidebar';
import { ResumeSessionBanner } from '../components/ResumeSessionBanner';
import { ResultsView } from '../components/ResultsView';
import { SessionView } from '../components/SessionView';
import { configToParams, narrowToPickable } from '../configs';
import { useTagWords } from '../hooks';
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
 * Stage 1 uses the shared `SidebarLayout`. The main area has the title, the
 * resume banner and three tabs: Ongoing sessions (the default), Saved
 * configurations, and New configuration (the settings form, with a sticky
 * Start / Save bar). The sidebar holds only the pre-selected words and exists
 * only on the New configuration tab, and only when there are words; elsewhere
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
            <ResultsPage session={session} onChangeSettings={() => changeSettings(session)} />
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
function ResultsPage({ session, onChangeSettings }: { session: Session; onChangeSettings: () => void }) {
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
                <ResultsView session={session} onChangeSettings={onChangeSettings} />
            </div>
        </SidebarLayout>
    );
}

type SetUpTab = 'sessions' | 'configs' | 'new';

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
    // From Review (with words) the user is here to set up a session; otherwise the ongoing sessions come first.
    const [tab, setTab] = useState<SetUpTab>(() => (preselected || startOnNew ? 'new' : 'sessions'));

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
        // The loaded settings are on the New configuration tab.
        setTab('new');
        toast.success(t('practice:configs.toast.loaded', { name: config.name }));
    }

    function clearPreselected() {
        setWordsMissing(false);
        onPreselect(null);
        setTags([]);
    }

    // Only used to tell "no words at all" from "no exercises": one row is enough.
    const words = useWordsInfinite({}, 1);
    const hasNoWords = !preselected && words.isSuccess && (words.data.pages[0]?.total ?? 0) === 0;

    // Stacked on mobile; side-by-side with the subtitle bottom-aligned from `sm` up (as on Add word).
    const header = (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <h1 className="h1">{t('practice:setup.title')}</h1>
            <p className="meta sm:content-end">{t('practice:setup.subtitle')}</p>
        </div>
    );
    const resumeBanner = parkedSession && (
        <ResumeSessionBanner session={parkedSession} onResume={onResume} onDismiss={onDismiss} />
    );

    if (hasNoWords) {
        return (
            <PageColumn>
                <div className="flex flex-col gap-4">
                    {header}
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

    // On the New configuration tab the sidebar always exists: Review's words, or the tag picker.
    const sections: SidebarSection[] =
        tab === 'new'
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
        >
            <div className="flex flex-col gap-4">
                {resumeBanner}
                <Tabs value={tab} onValueChange={(value) => setTab(value as SetUpTab)}>
                    <TabsList>
                        <TabsTrigger value="sessions">{t('practice:sessions.title')}</TabsTrigger>
                        <TabsTrigger value="configs">{t('practice:configs.title')}</TabsTrigger>
                        <TabsTrigger value="new">{t('practice:setup.newConfiguration')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sessions">
                        <SavedSessions hasUnfinished={parkedSession !== null} onResumed={clearPreselected} />
                    </TabsContent>
                    <TabsContent value="configs">
                        <SavedConfigurations onLoad={loadConfig} />
                    </TabsContent>
                    {/* Kept mounted while another tab shows: the form holds the working copy of the settings. */}
                    <TabsContent value="new" keepMounted className="flex flex-col gap-3">
                        <SidebarTrigger
                            label={t('practice:setup.selectedWordsButton', { count: effective?.length ?? 0 })}
                            className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}
                        >
                            <ListChecksIcon size={16} />
                            {t('practice:setup.selectedWordsButton', { count: effective?.length ?? 0 })}
                        </SidebarTrigger>
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
                            tagIds={usingTags ? tags.map((tag) => tag.id) : null}
                            startBlockedReason={tagsBlockedReason}
                            onStarted={clearPreselected}
                            onSaveConfig={setConfigDraft}
                            onParamsChange={(params) => {
                                setLiveParams(params);
                                void navigate({ search: paramsToSearch(params), replace: true });
                            }}
                        />
                    </TabsContent>
                </Tabs>
            </div>
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
