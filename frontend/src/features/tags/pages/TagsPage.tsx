/**
 * `/tags` (Slice 5) — search + scope chips + sort, a `TagCard` grid, and the
 * create/edit/delete/follow/unfollow/clone actions every card can trigger.
 * `MOCKUPS/tags.html`.
 *
 * `scope` lives in the URL (`?scope=`, D2) so an empty state's CTA can deep
 * link into another scope (`Link`/`navigate` with a `search` patch); `q` and
 * `sort` stay local component state, matching the mockup's own persistence
 * (neither survives a reload there either).
 */
import { useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, PlusIcon, SealCheckIcon, UsersIcon, LightbulbIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { startLoadingToast, resolveLoadingToastSuccess, resolveLoadingToastError } from '@/lib/toast';
import { useFollowTag, useTags, useUnfollowTag } from '../hooks';
import { tagErrorKey } from '../errors';
import { TagCard } from '../components/TagCard';
import { TagFormDialog } from '../components/TagFormDialog';
import { CloneTagDialog } from '../components/CloneTagDialog';
import { AUTHOR_BADGE_TYPES, type AuthorBadgeType, type TagScope, type TagSort, type TagSummary } from '../types';

const route = getRouteApi('/_protected/tags');
const SEARCH_DEBOUNCE_MS = 300;
const SCOPES: TagScope[] = ['all', 'owned', 'followed', 'discover'];
const SKELETON_CARDS = 6;
/**
 * What the "Verified" checkbox sends as `?badge=`. `official` is the only account badge today, so
 * "verified" and "official" are the same set; a second type needs a backend "any badge" value.
 */
const VERIFIED_BADGE: AuthorBadgeType = AUTHOR_BADGE_TYPES[0];

export function TagsPage() {
    const { t } = useTranslation();
    const search = route.useSearch();
    const navigate = route.useNavigate();
    const scope = search.scope ?? 'all';
    const badge = search.badge;

    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);
    const [sort, setSort] = useState<TagSort>('recent');

    const tagsQuery = useTags({ scope, q: debouncedQuery || undefined, sort, badge });
    const rows = useMemo(() => tagsQuery.data?.pages.flatMap((page) => page.items) ?? [], [tagsQuery.data]);
    const total = tagsQuery.data?.pages[0]?.total ?? 0;

    const [formDialog, setFormDialog] = useState<{ mode: 'create' | 'edit'; tag?: TagSummary } | null>(null);
    const [unfollowTarget, setUnfollowTarget] = useState<TagSummary | null>(null);
    const [cloneTarget, setCloneTarget] = useState<TagSummary | null>(null);

    const followTag = useFollowTag();
    const unfollowTag = useUnfollowTag();

    function setScope(next: TagScope) {
        void navigate({ search: (prev) => ({ ...prev, scope: next === 'all' ? undefined : next }) });
    }

    function setBadge(next: AuthorBadgeType | undefined) {
        void navigate({ search: (prev) => ({ ...prev, badge: next }) });
    }

    function handleFollow(tag: TagSummary) {
        const toastId = startLoadingToast(t('common:status.saving'));
        followTag.mutate(tag.id, {
            onSuccess: () => resolveLoadingToastSuccess(toastId, t('tags:page.toastFollowed', { label: tag.label })),
            onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
        });
    }

    function handleUnfollowConfirmed() {
        const tag = unfollowTarget;
        if (!tag) return;
        setUnfollowTarget(null);
        const toastId = startLoadingToast(t('common:status.saving'));
        unfollowTag.mutate(tag.id, {
            onSuccess: () => resolveLoadingToastSuccess(toastId, t('tags:page.toastUnfollowed', { label: tag.label })),
            onError: (error) => resolveLoadingToastError(toastId, t(tagErrorKey(error))),
        });
    }

    function renderEmptyState() {
        // The author filter comes first: with it on, "nothing here" is most often its doing.
        if (badge) {
            return (
                <EmptyState
                    icon={<SealCheckIcon size={20} />}
                    title={t('tags:page.emptyBadge.title')}
                    description={t('tags:page.emptyBadge.description')}
                    action={
                        <Button size="sm" variant="outline" onClick={() => setBadge(undefined)}>
                            {t('tags:page.emptyBadge.action')}
                        </Button>
                    }
                />
            );
        }
        if (debouncedQuery) {
            return (
                <EmptyState
                    icon={<MagnifyingGlassIcon size={20} />}
                    title={t('tags:page.emptySearch.title', { query: debouncedQuery })}
                    description={t('tags:page.emptySearch.description')}
                    action={
                        <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                            {t('tags:page.emptySearch.action')}
                        </Button>
                    }
                />
            );
        }
        if (scope === 'followed') {
            return (
                <EmptyState
                    icon={<UsersIcon size={20} />}
                    title={t('tags:page.emptyFollowed.title')}
                    description={t('tags:page.emptyFollowed.description')}
                    action={
                        <Button size="sm" onClick={() => setScope('discover')}>
                            {t('tags:page.emptyFollowed.action')}
                        </Button>
                    }
                />
            );
        }
        if (scope === 'discover') {
            return (
                <EmptyState
                    icon={<LightbulbIcon size={20} />}
                    title={t('tags:page.emptyDiscover.title')}
                    description={t('tags:page.emptyDiscover.description')}
                    action={
                        <Button size="sm" variant="outline" onClick={() => setScope('owned')}>
                            {t('tags:page.emptyDiscover.action')}
                        </Button>
                    }
                />
            );
        }
        return (
            <EmptyState
                icon={<PlusIcon size={20} />}
                title={t('tags:page.emptyOwned.title')}
                description={t('tags:page.emptyOwned.description')}
                action={
                    <Button size="sm" onClick={() => setFormDialog({ mode: 'create' })}>
                        {t('tags:page.emptyOwned.action')}
                    </Button>
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
                <h1 className="h1">{t('tags:page.title')}</h1>
                <Button onClick={() => setFormDialog({ mode: 'create' })}>
                    <PlusIcon size={15} weight="bold" />
                    {t('tags:page.newTag')}
                </Button>
            </div>

            <div className="toolrow">
                <div className="searchbox">
                    <MagnifyingGlassIcon size={14} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('tags:page.searchPlaceholder')}
                        aria-label={t('tags:page.searchLabel')}
                    />
                </div>
                <div className="scope-rail" role="group" aria-label={t('tags:page.scopeGroupLabel')}>
                    {SCOPES.map((candidate) => (
                        <button
                            key={candidate}
                            type="button"
                            className="chip"
                            aria-pressed={scope === candidate}
                            onClick={() => setScope(candidate)}
                        >
                            {t(candidate === 'all' || candidate === 'owned' ? `tags:page.scope.${candidate}` : `tags:relation.${candidate}`)}
                        </button>
                    ))}
                </div>
                <div className="sort-row">
                    {!tagsQuery.isPending && (
                        <span className="label-n">
                            {rows.length > 0
                                ? t('tags:page.resultCount', { shown: rows.length, total })
                                : t('tags:page.noResults')}
                        </span>
                    )}
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <Checkbox
                            checked={badge !== undefined}
                            onCheckedChange={(checked) => setBadge(checked ? VERIFIED_BADGE : undefined)}
                        />
                        {t('tags:page.verifiedFilter')}
                        <SealCheckIcon size={14} weight="fill" className="text-(--accent-strong)" aria-hidden="true" />
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="label-n">{t('tags:page.sortLabel')}</span>
                        <Select value={sort} onValueChange={(value) => setSort(value as TagSort)}>
                            <SelectTrigger size="sm" aria-label={t('tags:page.sortLabel')}>
                                <SelectValue>
                                    {(value: TagSort) => t(`tags:page.sort.${value}`)}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent align="end" alignItemWithTrigger={false}>
                                <SelectItem value="recent">{t('tags:page.sort.recent')}</SelectItem>
                                <SelectItem value="label">{t('tags:page.sort.label')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {tagsQuery.isError ? (
                <ErrorState
                    error={tagsQuery.error instanceof Error ? tagsQuery.error : undefined}
                    resetErrorBoundary={() => void tagsQuery.refetch()}
                />
            ) : tagsQuery.isPending ? (
                <section className="tag-grid" aria-label={t('tags:page.title')}>
                    {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                        <div key={index} className="card tagcard" style={{ padding: 15 }}>
                            <Skeleton className="mb-2 h-4 w-16" />
                            <Skeleton className="mb-1 h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </section>
            ) : rows.length === 0 ? (
                renderEmptyState()
            ) : (
                <>
                    <section className="tag-grid" aria-label={t('tags:page.title')}>
                        {rows.map((tag) => (
                            <TagCard
                                key={tag.id}
                                tag={tag}
                                showActions={scope !== 'all' && scope !== 'owned'}
                                onFollow={handleFollow}
                                onUnfollow={setUnfollowTarget}
                                onClone={setCloneTarget}
                            />
                        ))}
                    </section>
                    {tagsQuery.hasNextPage && (
                        <div className="card flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <span className="meta">{t('tags:page.loaded', { loaded: rows.length, total })}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void tagsQuery.fetchNextPage()}
                                disabled={tagsQuery.isFetchingNextPage}
                            >
                                {t('tags:page.loadMore')}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {formDialog && (
                <TagFormDialog
                    open
                    onOpenChange={(open) => !open && setFormDialog(null)}
                    mode={formDialog.mode}
                    tag={formDialog.tag}
                    onSaved={(tag) =>
                        resolveLoadingToastSuccess(
                            startLoadingToast(t('common:status.saving')),
                            t(formDialog.mode === 'create' ? 'tags:page.toastCreated' : 'tags:page.toastUpdated', {
                                label: tag.label,
                            }),
                        )
                    }
                    onGoToReview={() => void navigate({ to: '/words' })}
                />
            )}

            <CloneTagDialog
                open={cloneTarget !== null}
                onOpenChange={(open) => !open && setCloneTarget(null)}
                tag={cloneTarget}
                onCloned={({ tag, wordCount }) =>
                    resolveLoadingToastSuccess(
                        startLoadingToast(t('common:status.saving')),
                        tag
                            ? t('tags:page.toastCloned', { label: tag.label })
                            : t('tags:page.toastWordsCopied', { count: wordCount }),
                    )
                }
            />

            <ConfirmDialog
                open={unfollowTarget !== null}
                onOpenChange={(open) => !open && setUnfollowTarget(null)}
                title={t('tags:page.unfollowConfirmTitle')}
                description={
                    unfollowTarget
                        ? t('tags:page.unfollowConfirmDescription', {
                              label: unfollowTarget.label,
                              author: unfollowTarget.author.username,
                          })
                        : undefined
                }
                confirmLabel={t('tags:card.unfollow')}
                onConfirm={handleUnfollowConfirmed}
            />
        </div>
    );
}
