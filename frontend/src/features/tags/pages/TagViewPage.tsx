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
 */
import { useMemo, useState } from 'react';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, LockIcon, PencilSimpleIcon, TrashIcon, TranslateIcon, UsersIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { startLoadingToast, resolveLoadingToastSuccess, resolveLoadingToastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { accountLanguageOrder } from '@/features/words/review/search';
import { CellDialog } from '@/features/words/review/CellDialog';
import { useWordsInfinite } from '@/features/words/hooks';
import type { LangKey } from '@/features/words/types';
import { useDeleteTag, useFollowTag, useTag, useUnfollowTag, useUnlinkTagsFromWords } from '../hooks';
import { tagErrorKey } from '../errors';
import { ClonedBadge, RelationBadge, VerifiedMark, VisibilityBadge, hasVerifiedBadge, tagRelation } from '../components/TagBadge';
import { TagFormDialog } from '../components/TagFormDialog';
import { CloneTagDialog } from '../components/CloneTagDialog';
import { AddWordsDialog } from '../components/AddWordsDialog';
import { TagWordsTable } from '../components/TagWordsTable';

const route = getRouteApi('/_protected/tag/$tagId');
const SEARCH_DEBOUNCE_MS = 300;

export function TagViewPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { tagId } = route.useParams();

    const user = useAuthStore((s) => s.user);
    const userId = user?.id ?? '';
    const userLanguages = user?.languages ?? [];
    const languages = useMemo(() => accountLanguageOrder(userLanguages), [userLanguages]);

    const tagQuery = useTag(tagId);
    const deleteTag = useDeleteTag();
    const followTag = useFollowTag();
    const unfollowTag = useUnfollowTag();
    const unlinkTagsFromWords = useUnlinkTagsFromWords();

    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedCallback(query, SEARCH_DEBOUNCE_MS);
    const wordsQuery = useWordsInfinite({ tag: [tagId], q: debouncedQuery || undefined });
    const wordRows = useMemo(() => wordsQuery.data?.pages.flatMap((page) => page.items) ?? [], [wordsQuery.data]);
    const wordTotal = wordsQuery.data?.pages[0]?.total ?? 0;
    const existingWordIds = useMemo(() => new Set(wordRows.map((row) => row.id)), [wordRows]);

    const [editing, setEditing] = useState(false);
    const [removeMode, setRemoveMode] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [confirmingUnfollow, setConfirmingUnfollow] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [addingWords, setAddingWords] = useState(false);
    const [showGender, setShowGender] = useState(true);
    const [showProgress, setShowProgress] = useState(false);
    const [cellTarget, setCellTarget] = useState<{ wordId: string; langKey: LangKey } | null>(null);

    if (tagQuery.isPending) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-4 w-32" />
                <div className="card" style={{ padding: 20 }}>
                    <Skeleton className="mb-2 h-4 w-20" />
                    <Skeleton className="mb-2 h-7 w-48" />
                    <Skeleton className="h-4 w-full max-w-md" />
                </div>
            </div>
        );
    }

    if (tagQuery.isError) {
        return (
            <EmptyState
                title={t('tags:notFound.title')}
                description={t('tags:notFound.description')}
                action={
                    <Link to="/tags" className={buttonVariants({ size: 'sm' })}>
                        {t('tags:notFound.action')}
                    </Link>
                }
            />
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
        <div className="flex flex-col gap-3.5">
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
                        <h1 className="h1">{tag.label}</h1>
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
                                {t('tags:card.unfollow')}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setCloning(true)}>
                                {t('tags:card.clone')}
                            </Button>
                        </>
                    )}
                    {relation === 'discover' && (
                        <>
                            <Button size="sm" variant="secondary" onClick={handleFollow}>
                                {t('tags:card.follow')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setCloning(true)}>
                                {t('tags:card.clone')}
                            </Button>
                        </>
                    )}
                    {relation === 'unavailable' && (
                        <Button size="sm" variant="secondary" onClick={() => setConfirmingUnfollow(true)}>
                            {t('tags:card.unfollow')}
                        </Button>
                    )}
                </div>
            </section>

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
                        isFetchingNextPage={wordsQuery.isFetchingNextPage}
                        isError={wordsQuery.isError}
                        error={wordsQuery.error}
                        hasNextPage={wordsQuery.hasNextPage}
                        total={wordTotal}
                        onFetchNextPage={() => void wordsQuery.fetchNextPage()}
                        onRetry={() => void wordsQuery.refetch()}
                        query={query}
                        debouncedQuery={debouncedQuery}
                        onQueryChange={setQuery}
                        canRemove={relation === 'owned'}
                        removeMode={removeMode}
                        onRemoveModeChange={setRemoveMode}
                        onRemove={handleRemoveWord}
                        onAddWords={() => setAddingWords(true)}
                        onOpenCell={(wordId, langKey) => setCellTarget({ wordId, langKey })}
                        showGender={showGender}
                        onShowGenderChange={setShowGender}
                        showProgress={showProgress}
                        onShowProgressChange={setShowProgress}
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
                onCloned={(clone) =>
                    resolveLoadingToastSuccess(
                        startLoadingToast(t('common:status.saving')),
                        t('tags:page.toastCloned', { label: clone.label }),
                        { label: t('tags:view.openCopy'), onClick: () => void navigate({ to: '/tag/$tagId', params: { tagId: clone.id } }) },
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
        </div>
    );
}
