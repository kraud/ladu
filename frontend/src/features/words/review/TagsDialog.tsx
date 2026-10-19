/**
 * The tags of one word, opened from a click on its Tags cell in the Review table. It opens in display
 * mode: a condensed list of the tags (the `/tags` card facts in one row: label, visibility, word count,
 * author). For an own word the footer has an Edit button, as the cell dialog has for translations. Edit mode
 * adds tags (the tag combobox, owned tags only) and removes them (the × on a row); both are staged and
 * applied on Save: the removed tags first, then the added ones.
 *
 * Router- and store-free like every other file in `review/`: every input is a prop.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowCounterClockwiseIcon, ArrowUpRightIcon, FunnelIcon, FunnelXIcon, TagIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisibilityBadge } from '@/features/tags/components/TagBadge';
import { TagCombobox, type TagComboboxItem } from '@/features/tags/components/TagCombobox';
import { tagErrorKey } from '@/features/tags/errors';
import { useLinkTagsToWords, useTagsByIds, useUnlinkTagsFromWords } from '@/features/tags/hooks';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';
import type { WordTagRef } from '../types';

export interface TagsDialogProps {
    wordId: string;
    /** The word's tags, newest first. */
    tags: WordTagRef[];
    /** Own words only: the Edit button is offered. */
    canEdit: boolean;
    /** The ids of the tags that the table already filters by. */
    filteredTagIds: readonly string[];
    /** Adds the tag to the tag filter of the table, or removes it when it is already there. */
    onFilter: (tagId: string) => void;
    /** Opens the tag view page. */
    onOpenTag: (tagId: string) => void;
    onClose: () => void;
}

/** An icon button with its label as the accessible name and as a tooltip. */
function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}
            >
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function TagsDialog({ wordId, tags, canEdit, filteredTagIds, onFilter, onOpenTag, onClose }: TagsDialogProps) {
    const { t } = useTranslation();
    const details = useTagsByIds(tags.map((tag) => tag.id));
    const link = useLinkTagsToWords();
    const unlink = useUnlinkTagsFromWords();
    const [editing, setEditing] = useState(false);
    const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
    const [added, setAdded] = useState<TagComboboxItem[]>([]);
    const [error, setError] = useState<unknown>(null);

    const detailById = new Map(details.data.map((tag) => [tag.id, tag]));
    const dirty = removed.size > 0 || added.length > 0;
    const busy = link.isPending || unlink.isPending;

    function startEdit() {
        setRemoved(new Set());
        setAdded([]);
        setError(null);
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
    }

    function toggleRemoved(id: string) {
        setRemoved((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function save() {
        const toastId = startLoadingToast(t('common:status.saving'));
        try {
            if (removed.size > 0) await unlink.mutateAsync({ tagIds: [...removed], wordIds: [wordId] });
            const toAdd = added.filter((tag) => !tags.some((own) => own.id === tag.id));
            if (toAdd.length > 0) await link.mutateAsync({ tagIds: toAdd.map((tag) => tag.id), wordIds: [wordId] });
            resolveLoadingToastSuccess(toastId, t('review:tagsDialog.saved'));
            onClose();
        } catch (caught) {
            resolveLoadingToastError(toastId, t(tagErrorKey(caught)));
            setError(caught);
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{t('review:tagsDialog.title')}</DialogTitle>
                </DialogHeader>

                {tags.length === 0 ? (
                    <p className="hint">{t('review:tagsDialog.empty')}</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
                        {tags.map((tag) => {
                            const detail = detailById.get(tag.id);
                            const gone = removed.has(tag.id);
                            const filtered = filteredTagIds.includes(tag.id);
                            return (
                                <li key={tag.id} className="flex items-center gap-3 px-3 py-2">
                                    <TagIcon aria-hidden size={20} className="shrink-0 text-(--accent)" />
                                    <div className={`flex min-w-0 grow flex-col gap-0.5 ${gone ? 'opacity-45' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            {editing ? (
                                                <span className={`truncate font-semibold ${gone ? 'line-through' : ''}`}>
                                                    {tag.label}
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="truncate text-left font-semibold hover:underline focus-visible:underline"
                                                    onClick={() => onOpenTag(tag.id)}
                                                >
                                                    {tag.label}
                                                </button>
                                            )}
                                            <VisibilityBadge visibility={tag.visibility} />
                                        </div>
                                        {detail && (
                                            <span className="meta truncate">
                                                {t('review:tagsDialog.words', { count: detail.wordCount })}
                                                {!detail.isOwner && (
                                                    <>
                                                        {' · '}
                                                        {t('review:tagsDialog.by', { username: detail.author.username })}
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    {!editing && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <IconAction
                                                label={t(
                                                    filtered ? 'review:tagsDialog.unfilter' : 'review:tagsDialog.filter',
                                                    { label: tag.label },
                                                )}
                                                onClick={() => onFilter(tag.id)}
                                            >
                                                {filtered ? (
                                                    <FunnelXIcon aria-hidden size={16} />
                                                ) : (
                                                    <FunnelIcon aria-hidden size={16} />
                                                )}
                                            </IconAction>
                                            <IconAction
                                                label={t('review:tagsDialog.open', { label: tag.label })}
                                                onClick={() => onOpenTag(tag.id)}
                                            >
                                                <ArrowUpRightIcon aria-hidden size={16} />
                                            </IconAction>
                                        </div>
                                    )}
                                    {editing && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={t(
                                                gone ? 'review:tagsDialog.restore' : 'review:tagsDialog.remove',
                                                { label: tag.label },
                                            )}
                                            onClick={() => toggleRemoved(tag.id)}
                                        >
                                            {gone ? (
                                                <ArrowCounterClockwiseIcon aria-hidden size={16} />
                                            ) : (
                                                <XIcon aria-hidden size={16} />
                                            )}
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {editing && (
                    <div className="flex flex-col gap-1.5">
                        <span className="label">{t('review:tagsDialog.add')}</span>
                        <TagCombobox
                            mode="add"
                            selected={added}
                            onSelectedChange={setAdded}
                            excludeIds={new Set(tags.map((tag) => tag.id))}
                        />
                    </div>
                )}

                {error !== null && <p className="text-sm text-(--danger)">{t(tagErrorKey(error))}</p>}

                <DialogFooter>
                    {editing ? (
                        <>
                            <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                                {t('common:buttons.cancel')}
                            </Button>
                            <Button type="button" disabled={!dirty || busy} onClick={() => void save()}>
                                {t('common:buttons.saveChanges')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" onClick={onClose}>
                                {t('common:buttons.close')}
                            </Button>
                            {canEdit && (
                                <Button type="button" onClick={startEdit}>
                                    {t('common:buttons.edit')}
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
