/**
 * `/tag/:id` (Slice 6) — replaces the router `Placeholder`. Header (badges,
 * label, description, author/"Cloned from" line, word/follower stats,
 * relation-aware actions) built to `MOCKUPS/tag-detail.html`'s `.tagen`, plus
 * the tag's word list (`TagWordsTable`, backed by `GET /api/words/simple?
 * tag=`) and two dedicated non-table states: **unavailable** (a followed tag
 * the owner made Private, D9) and **not found** (no standing to see it at
 * all — 404 either way, matching `useTag`'s own "hide existence" posture).
 *
 * Reuses every dialog Slice 5 already built (`TagFormDialog` edit mode,
 * `CloneTagDialog`, `ConfirmDialog` for delete/unfollow) — only `AddWordsDialog`
 * is new here, wrapping `WordPicker` in the dialog chrome it deliberately
 * doesn't own itself.
 *
 * The word list is in numbered pages (words-pagination.md, Slice 4). The search, the page, the page
 * size and the sort live in the URL (`validateTagSearch`), so a reload, the back button and a shared
 * link keep the view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, CopyIcon, FunnelIcon, LockIcon, PencilSimpleIcon, SlidersHorizontalIcon, TagIcon, TrashIcon, TranslateIcon, UserMinusIcon, UserPlusIcon, UsersIcon } from '@phosphor-icons/react';
import { PageTitle } from '@/components/common/PageTitle';
import { PageColumn } from '@/components/layout/PageColumn';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarLayout, SidebarTrigger, type SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { startLoadingToast, resolveLoadingToastSuccess, resolveLoadingToastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { accountLanguageOrder, resolveLanguageOrder } from '@/features/words/review/search';
import { buildDisplaySection } from '@/features/words/review/DisplayOptions';
import { LanguageOrderControl } from '@/features/words/review/LanguageOrderControl';
import { useFilterSections } from '@/features/words/review/FilterBar';
import { PartOfSpeech } from '@/ts/enums';
import { CellDialog } from '@/features/words/review/CellDialog';
import { useTagWordIds, useWordsPage } from '@/features/words/hooks';
import { nextLanguageSort, sortFilters } from '@/features/words/review/useLanguageSort';
import { reviewSearchToSort } from '@/features/words/review/search';
import { pageCountFor, readStoredPageSize, storePageSize, type PageSize } from '@/lib/pagination';
import type { LangKey } from '@/features/words/types';
import { useDeleteTag, useFollowTag, useTag, useUnfollowTag, useUnlinkTagsFromWords } from '../hooks';
import { tagErrorKey } from '../errors';
import { ClonedBadge, RelationBadge, VerifiedMark, VisibilityBadge, hasVerifiedBadge, tagRelation } from '../components/TagBadge';
import { TagFormDialog } from '../components/TagFormDialog';
import { CloneTagDialog } from '../components/CloneTagDialog';
import { AddWordsDialog } from '../components/AddWordsDialog';
import { TagWordsTable } from '../components/TagWordsTable';
import type { TagSearch } from '../search';

const route = getRouteApi('/_protected/tag/$tagId');
const SEARCH_DEBOUNCE_MS = 300;

const NO_WORD_IDS: ReadonlySet<string> = new Set();
const PART_OF_SPEECH_VALUES: ReadonlySet<string> = new Set(Object.values(PartOfSpeech));

export function TagViewPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const searchNavigate = route.useNavigate();
    const { tagId } = route.useParams();
    const search = route.useSearch();

    const user = useAuthStore((s) => s.user);
    const userId = user?.id ?? '';
    const userLanguages = user?.languages ?? [];
    const allLanguages = useMemo(() => accountLanguageOrder(userLanguages), [userLanguages]);
    const languages = useMemo(() => resolveLanguageOrder(search.lang, userLanguages), [search.lang, userLanguages]);
    const isMobile = useIsMobile();

    const tagQuery = useTag(tagId);
    const deleteTag = useDeleteTag();
    const followTag = useFollowTag();
    const unfollowTag = useUnfollowTag();
    const unlinkTagsFromWords = useUnlinkTagsFromWords();

    // Any real change of search, sort or page size goes back to page 1, unless `keepPage` says it is
    // not about the list. A write that changes nothing keeps the page (see `ReviewPage.updateSearch`).
    function updateSearch(patch: Partial<TagSearch>, options: { keepPage?: boolean; replace?: boolean } = {}) {
        void searchNavigate({
            search: (prev) => {
                const changed = Object.entries(patch).some(
                    ([key, value]) => JSON.stringify(prev[key as keyof TagSearch]) !== JSON.stringify(value),
                );
                return { ...prev, ...(options.keepPage || !changed ? {} : { page: undefined }), ...patch };
            },
            replace: options.replace,
        });
    }

    // The search box: typed text stays local, and goes to the URL after a short pause. The URL is the filter.
    const [query, setQuery] = useState(search.q ?? '');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);
    useEffect(() => {
        const next = debouncedQuery.trim() || undefined;
        if (next !== search.q) updateSearch({ q: next });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);
    // A change of the URL from outside (the back button) goes back into the box.
    useEffect(() => {
        if ((search.q ?? '') !== debouncedQuery.trim()) setQuery(search.q ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search.q]);

    const sort = useMemo(() => reviewSearchToSort({ sort: search.sort, dir: search.dir }), [search.sort, search.dir]);
    const toggleSort = useCallback(
        (lang: LangKey) => {
            const next = nextLanguageSort(sort, lang);
            void searchNavigate({ search: (prev) => ({ ...prev, sort: next?.lang, dir: next?.dir, page: undefined }) });
        },
        [sort, searchNavigate],
    );
    const storedPageSize = useMemo(readStoredPageSize, []);
    const pageSize: PageSize = search.size ?? storedPageSize;
    const page = search.page ?? 1;

    const wordsQuery = useWordsPage({ tag: [tagId], q: search.q, pos: search.pos, gender: search.gender, ...sortFilters(sort) }, { page, pageSize });
    const wordRows = useMemo(() => wordsQuery.data?.items ?? [], [wordsQuery.data]);
    const wordTotal = wordsQuery.data?.total ?? 0;
    const pageCount = pageCountFor(wordTotal, pageSize);

    // A page past the last one (the last words were removed, or a stale link) goes to the last page.
    useEffect(() => {
        if (!wordsQuery.data || wordsQuery.isPlaceholderData || page <= pageCount) return;
        updateSearch({ page: pageCount > 1 ? pageCount : undefined }, { keepPage: true, replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wordsQuery.data, wordsQuery.isPlaceholderData, page, pageCount]);

    function handlePageChange(next: number) {
        updateSearch({ page: next > 1 ? next : undefined }, { keepPage: true });
    }

    function handlePageSizeChange(size: PageSize) {
        storePageSize(size);
        updateSearch({ size });
    }

    const [editing, setEditing] = useState(false);
    const [removeMode, setRemoveMode] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [confirmingUnfollow, setConfirmingUnfollow] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [addingWords, setAddingWords] = useState(false);
    // Every word of the tag, not only the page on screen: "Add words" must not offer a word the tag already has.
    // `undefined` while it loads (the dialog waits); if the request fails, the dialog still works without the filter.
    const tagWordIdsQuery = useTagWordIds(tagId, addingWords);
    const existingWordIds = tagWordIdsQuery.isError
        ? NO_WORD_IDS
        : tagWordIdsQuery.isFetching
          ? undefined
          : tagWordIdsQuery.data;
    // Not in the URL, like on `/words`: a display concern, not a filter.
    const [showGender, setShowGender] = useState(true);
    const [showProgress, setShowProgress] = useState(false);
    const [showOwner, setShowOwner] = useState(true);
    const [showPos, setShowPos] = useState(true);
    const [cellTarget, setCellTarget] = useState<{ wordId: string; langKey: LangKey } | null>(null);

    // The side menu offers only what the whole tag holds (not the page on screen, which a filter can empty):
    // Gender once it has a noun, and Part of speech with the parts of speech it has, even if there is one.
    const tagPartsOfSpeech = useMemo(
        () => (tagQuery.data?.partsOfSpeech ?? []).filter((value): value is PartOfSpeech => PART_OF_SPEECH_VALUES.has(value)),
        [tagQuery.data],
    );
    const tagHasNouns = tagPartsOfSpeech.includes(PartOfSpeech.noun);
    const filterSections = useFilterSections({
        gender: search.gender ?? [],
        pos: search.pos ?? [],
        hasQuery: search.q !== undefined,
        selectedTags: [],
        sections: tagHasNouns ? ['gender', 'pos'] : ['pos'],
        posOptions: tagPartsOfSpeech,
        onGenderChange: (next) => updateSearch({ gender: next }),
        onPosChange: (next) => updateSearch({ pos: next }),
        onSelectedTagsChange: () => undefined,
    });
    const sections: SidebarSection[] = [
        ...filterSections,
        buildDisplaySection(t('review:filters.display'), {
            languageOrder: (
                <LanguageOrderControl
                    active={languages}
                    allLanguages={allLanguages}
                    onChange={(next) => updateSearch({ lang: next }, { keepPage: true })}
                    stacked
                    hideLabel
                />
            ),
            showGenderSwitch: tagHasNouns,
            showGender,
            onShowGenderChange: setShowGender,
            showProgress,
            onShowProgressChange: setShowProgress,
            showOwner,
            onShowOwnerChange: setShowOwner,
            showPos,
            onShowPosChange: setShowPos,
        }),
    ];
    const activeFilterTotal = (search.gender?.length ?? 0) + (search.pos?.length ?? 0);

    if (tagQuery.isPending) {
        return (
            <PageColumn>
                <div className="flex flex-col gap-4">
                    <Skeleton className="h-4 w-32" />
                    <div className="card" style={{ padding: 20 }}>
                        <Skeleton className="mb-2 h-4 w-20" />
                        <Skeleton className="mb-2 h-7 w-48" />
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                </div>
            </PageColumn>
        );
    }

    if (tagQuery.isError) {
        return (
            <PageColumn>
                <EmptyState
                    title={t('tags:notFound.title')}
                    description={t('tags:notFound.description')}
                    action={
                        <Link to="/tags" className={buttonVariants({ size: 'sm' })}>
                            {t('tags:notFound.action')}
                        </Link>
                    }
                />
            </PageColumn>
        );
    }

    const tag = tagQuery.data;
    const relation = tagRelation(tag);

    function handleFollow() {
        const toastId = startLoadingToast(t('common:status.saving'));
        followTag.mutate(tag.id, {
            onSuccess: () => resolveLoadingToastSuccess(toastId, t('tags:page.toastFollowed', { label: tag.label })),
            onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
        });
    }

    function handleUnfollowConfirmed() {
        setConfirmingUnfollow(false);
        const toastId = startLoadingToast(t('common:status.saving'));
        unfollowTag.mutate(tag.id, {
            onSuccess: () => resolveLoadingToastSuccess(toastId, t('tags:page.toastUnfollowed', { label: tag.label })),
            onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
        });
    }

    function handleDeleteConfirmed() {
        setConfirmingDelete(false);
        const toastId = startLoadingToast(t('common:status.saving'));
        deleteTag.mutate(tag.id, {
            onSuccess: () => {
                resolveLoadingToastSuccess(toastId, t('tags:page.toastDeleted', { label: tag.label }));
                void navigate({ to: '/tags' });
            },
            onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
        });
    }

    function handleRemoveWord(wordId: string, label: string) {
        const toastId = startLoadingToast(t('common:status.saving'));
        unlinkTagsFromWords.mutate(
            { tagIds: [tag.id], wordIds: [wordId] },
            {
                onSuccess: () =>
                    resolveLoadingToastSuccess(toastId, t('tags:words.removedToast', { word: label, label: tag.label })),
                onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
            },
        );
    }

    return (
        <SidebarLayout
            id="tag"
            label={t('review:filters.title')}
            labelIcon={<FunnelIcon size={18} />}
            sections={relation === 'unavailable' ? [] : sections}
            header={
                <>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/tags"
                            aria-label={t('tags:view.backAriaLabel')}
                            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        >
                            <ArrowLeftIcon size={17} />
                        </Link>
                        <span className="hint">{t('tags:view.backLabel')}</span>
                    </div>

                    <section className="card">
                        <div className="tagen-top">
                            <div className="grow min-w-0">
                                <PageTitle icon={TagIcon}>{tag.label}</PageTitle>
                                {tag.description && (
                                    <p className="mt-1 max-w-2xl text-[13.5px] text-(--muted) leading-relaxed">
                                        {tag.description}
                                    </p>
                                )}
                                {relation !== 'owned' && (
                                    <div className="t-by">
                                        <span>{t('tags:view.by')}</span>
                                        <span className={hasVerifiedBadge(tag.author.badges) ? 't-by-verified' : undefined}>
                                            {tag.author.username}
                                        </span>
                                        {hasVerifiedBadge(tag.author.badges) && <VerifiedMark />}
                                    </div>
                                )}
                            </div>
                            <aside className="tagen-side">
                                <div className="card stat-card tagen-stat">
                                    <div className="tagen-stat-body">
                                        <div className="s-num">
                                            <TranslateIcon size={18} aria-hidden="true" />
                                            {tag.wordCount}
                                        </div>
                                        <div className="s-label">{t('tags:card.wordCount', { count: tag.wordCount })}</div>
                                    </div>
                                </div>
                                {relation !== 'unavailable' && tag.visibility === 'Public' && (
                                    <div className="card stat-card tagen-stat">
                                        <div className="tagen-stat-body">
                                            <div className="s-num">
                                                <UsersIcon size={18} aria-hidden="true" />
                                                {tag.followerCount}
                                            </div>
                                            <div className="s-label">
                                                {t('tags:view.followerLabel', { count: tag.followerCount })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </aside>
                        </div>
                        <div className="tagen-foot">
                            <div className="t-badge-row t-badge-row-card tagen-foot-badges">
                                <RelationBadge relation={relation} />
                                <VisibilityBadge visibility={tag.visibility} />
                                {tag.sourceTag && <ClonedBadge sourceLabel={tag.sourceTag.label} />}
                            </div>
                            {relation === 'owned' && (
                                <>
                                    <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                                        <PencilSimpleIcon size={14} aria-hidden="true" />
                                        {t('common:buttons.edit')}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                                        <TrashIcon size={14} aria-hidden="true" />
                                        {t('common:buttons.delete')}
                                    </Button>
                                </>
                            )}
                            {relation === 'followed' && (
                                <>
                                    <Button size="sm" variant="ghost" onClick={() => setConfirmingUnfollow(true)}>
                                        <UserMinusIcon size={14} aria-hidden="true" />
                                        {t('tags:card.unfollow')}
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => setCloning(true)}>
                                        <CopyIcon size={14} aria-hidden="true" />
                                        {t('tags:card.clone')}
                                    </Button>
                                </>
                            )}
                            {relation === 'discover' && (
                                <>
                                    <Button size="sm" variant="secondary" onClick={handleFollow}>
                                        <UserPlusIcon size={14} aria-hidden="true" />
                                        {t('tags:card.follow')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCloning(true)}>
                                        <CopyIcon size={14} aria-hidden="true" />
                                        {t('tags:card.clone')}
                                    </Button>
                                </>
                            )}
                            {relation === 'unavailable' && (
                                <Button size="sm" variant="secondary" onClick={() => setConfirmingUnfollow(true)}>
                                    <UserMinusIcon size={14} aria-hidden="true" />
                                    {t('tags:card.unfollow')}
                                </Button>
                            )}
                        </div>
                    </section>
                </>
            }
        >
            {relation === 'unavailable' ? (
                <EmptyState
                    icon={<LockIcon size={20} />}
                    title={t('tags:view.unavailableTitle')}
                    description={t('tags:view.unavailableDescription')}
                    action={
                        <Link to="/tags" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                            {t('tags:notFound.action')}
                        </Link>
                    }
                />
            ) : (
                <div className="flex flex-col gap-3.5 min-[921px]:mt-3">
                    <TagWordsTable
                        rows={wordRows}
                        languages={languages}
                        userId={userId}
                        isPending={wordsQuery.isPending}
                        isFetching={wordsQuery.isFetching}
                        isError={wordsQuery.isError}
                        error={wordsQuery.error}
                        total={wordTotal}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        onRetry={() => void wordsQuery.refetch()}
                        query={query}
                        debouncedQuery={search.q ?? ''}
                        onQueryChange={setQuery}
                        canRemove={relation === 'owned'}
                        removeMode={removeMode}
                        onRemoveModeChange={setRemoveMode}
                        onRemove={handleRemoveWord}
                        onAddWords={() => setAddingWords(true)}
                        onOpenCell={(wordId, langKey) => setCellTarget({ wordId, langKey })}
                        showGender={showGender}
                        showProgress={showProgress}
                        showOwner={showOwner}
                        showPos={showPos}
                        userName={user?.name ?? ''}
                        hasFilters={activeFilterTotal > 0}
                        onClearFilters={() => {
                            setQuery('');
                            updateSearch({ q: undefined, pos: undefined, gender: undefined });
                        }}
                        leading={
                            isMobile ? (
                                <SidebarTrigger
                                    label={t('review:filters.title')}
                                    className={cn(buttonVariants({ variant: 'outline', className: 'gap-2' }))}
                                >
                                    <SlidersHorizontalIcon size={16} />
                                    {t('review:filters.title')}
                                    {activeFilterTotal > 0 && <span className="active-pill">{activeFilterTotal}</span>}
                                </SidebarTrigger>
                            ) : undefined
                        }
                        sort={sort}
                        onSort={toggleSort}
                    />
                    {relation === 'owned' && removeMode && <p className="hint">{t('tags:view.removeHint')}</p>}
                </div>
            )}

            <TagFormDialog
                open={editing}
                onOpenChange={setEditing}
                mode="edit"
                tag={tag}
                onSaved={(updated) =>
                    resolveLoadingToastSuccess(
                        startLoadingToast(t('common:status.saving')),
                        t('tags:page.toastUpdated', { label: updated.label }),
                    )
                }
            />

            <CloneTagDialog
                open={cloning}
                onOpenChange={setCloning}
                tag={tag}
                onCloned={({ tag: clone, wordCount }) =>
                    resolveLoadingToastSuccess(
                        startLoadingToast(t('common:status.saving')),
                        clone
                            ? t('tags:page.toastCloned', { label: clone.label })
                            : t('tags:page.toastWordsCopied', { count: wordCount }),
                        clone
                            ? { label: t('tags:view.openCopy'), onClick: () => void navigate({ to: '/tag/$tagId', params: { tagId: clone.id } }) }
                            : { label: t('tags:view.openWords'), onClick: () => void navigate({ to: '/words' }) },
                    )
                }
            />

            <AddWordsDialog
                open={addingWords}
                onOpenChange={setAddingWords}
                tagId={tag.id}
                tagLabel={tag.label}
                existingWordIds={existingWordIds}
                onAdded={(added) =>
                    resolveLoadingToastSuccess(
                        startLoadingToast(t('common:status.saving')),
                        t('tags:addWords.addedToast', { count: added.length, label: tag.label }),
                    )
                }
                onGoToReview={() => void navigate({ to: '/words' })}
            />

            <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title={t('tags:page.deleteConfirmTitle')}
                description={t('tags:page.deleteConfirmDescription', { label: tag.label, count: tag.wordCount })}
                confirmLabel={t('common:buttons.delete')}
                onConfirm={handleDeleteConfirmed}
            />

            <ConfirmDialog
                open={confirmingUnfollow}
                onOpenChange={setConfirmingUnfollow}
                title={t('tags:page.unfollowConfirmTitle')}
                description={t('tags:page.unfollowConfirmDescription', { label: tag.label, author: tag.author.username })}
                confirmLabel={t('tags:card.unfollow')}
                onConfirm={handleUnfollowConfirmed}
            />

            {cellTarget && (
                <CellDialog
                    key={`${cellTarget.wordId}:${cellTarget.langKey}`}
                    wordId={cellTarget.wordId}
                    langKey={cellTarget.langKey}
                    onClose={() => setCellTarget(null)}
                    nativeLanguage={user?.nativeLanguage}
                    userLanguages={userLanguages}
                />
            )}
        </SidebarLayout>
    );
}
