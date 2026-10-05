import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { getTagById } from '@/features/tags/api';
import { tagKeys } from '@/features/tags/keys';
import type { TagSummary } from '@/features/tags/types';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useAuthStore } from '@/stores/authStore';
import { practiceErrorKey } from '../errors';
import { useConfigs, useDeleteConfig, useLoadConfigWords } from '../hooks';
import { toPreselectedWord, type PreselectedWord } from '../preselection';
import type { CardType, SavedConfig } from '../types';
import { SaveConfigDialog } from './SaveConfigDialog';
import { Pill, SetupFacts } from './SetupFacts';

/**
 * The user's saved configurations: the content of the "Saved configurations" tab on the set-up screen. One tap on a row loads it:
 * the page gets the configuration and its words (still visible ones, with labels).
 * `words` is `null` when the configuration has none. A configuration with tags reads the tags again
 * and gives them to the page (`loadedTags`): the words come live from the tags. If none of its tags can
 * be read any more, it falls back to the saved words, and says how many tags are gone. Edit changes name and description;
 * delete asks first. A failed load or delete stays as a message here, never a lost click.
 */
/** The tags of a configuration that could be read again, and how many could not (deleted, or no longer visible). */
export interface LoadedTags {
    tags: TagSummary[];
    missing: number;
}

export function SavedConfigurations({
    onLoad,
}: {
    onLoad: (config: SavedConfig, words: PreselectedWord[] | null, loadedTags: LoadedTags | null) => void;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const configs = useConfigs();
    const loadWords = useLoadConfigWords();
    const queryClient = useQueryClient();
    const deleteConfig = useDeleteConfig();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [editing, setEditing] = useState<SavedConfig | null>(null);
    const [deleting, setDeleting] = useState<SavedConfig | null>(null);

    function loadSavedWords(config: SavedConfig, loadedTags: LoadedTags | null) {
        if (!config.wordIds || config.wordIds.length === 0) {
            onLoad(config, null, loadedTags);
            setLoadingId(null);
            return;
        }
        setLoadingId(config.id);
        loadWords.mutate(config.id, {
            onSuccess: (rows) => {
                const order = accountLanguageOrder(user?.languages ?? []);
                onLoad(
                    config,
                    rows.map((row) => toPreselectedWord(row, order)),
                    loadedTags,
                );
            },
            onSettled: () => setLoadingId(null),
        });
    }

    function load(config: SavedConfig) {
        if (loadingId) return;
        const tagIds = config.tagIds ?? [];
        if (tagIds.length === 0) {
            loadSavedWords(config, null);
            return;
        }
        // Words chosen by tag: read the tags again (the page shows them as containers).
        setLoadingId(config.id);
        void Promise.allSettled(
            tagIds.map((id) => queryClient.fetchQuery({ queryKey: tagKeys.detail(id), queryFn: () => getTagById(id) })),
        ).then((results) => {
            const tags = results.flatMap((result) =>
                result.status === 'fulfilled' && result.value.isAvailable ? [result.value] : [],
            );
            const loadedTags = { tags, missing: tagIds.length - tags.length };
            if (tags.length > 0) {
                onLoad(config, null, loadedTags);
                setLoadingId(null);
            } else {
                loadSavedWords(config, loadedTags);
            }
        });
    }

    function confirmDelete() {
        if (!deleting) return;
        deleteConfig.mutate(deleting.id, {
            onSuccess: () => toast.success(t('practice:configs.toast.deleted')),
        });
        setDeleting(null);
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="hint">{t('practice:configs.note')}</p>
            {configs.isPending && <p className="hint">{t('practice:configs.loading')}</p>}

            {configs.isError && (
                <div className="banner warning items-start" role="alert">
                    <span className="grow">{t('practice:configs.listError')}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void configs.refetch()}>
                        {t('practice:setup.error.retry')}
                    </Button>
                </div>
            )}

            {configs.isSuccess && configs.data.length === 0 && <p className="hint">{t('practice:configs.empty')}</p>}

            {loadWords.isError && (
                <p className="err show" role="alert">
                    {t(practiceErrorKey(loadWords.error))}
                </p>
            )}
            {deleteConfig.isError && (
                <p className="err show" role="alert">
                    {t(practiceErrorKey(deleteConfig.error))}
                </p>
            )}

            {configs.isSuccess && configs.data.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {configs.data.map((config) => (
                        <li key={config.id} className="relative">
                            <button
                                type="button"
                                className="flex w-full cursor-pointer flex-col gap-3 rounded-(--radius) border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-(--accent) hover:bg-(--accent-soft) focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-(--accent-soft) disabled:cursor-wait disabled:opacity-60"
                                aria-label={t('practice:configs.use', { name: config.name })}
                                disabled={loadingId !== null}
                                aria-busy={loadingId === config.id || undefined}
                                onClick={() => load(config)}
                            >
                                <span className="flex min-w-0 flex-col gap-0.5 pr-16">
                                    <span className="font-semibold break-words">{config.name}</span>
                                    {config.description && <span className="hint break-words">{config.description}</span>}
                                </span>
                                <SetupFacts
                                    figure={config.params.amount}
                                    cardTypes={cardTypesOf(config.params.type)}
                                    languages={config.params.languages}
                                    partsOfSpeech={config.params.partsOfSpeech}
                                    extra={
                                        <span className="flex flex-col items-start gap-1.5 self-center">
                                            <Pill>
                                                {(config.wordIds?.length ?? 0) > 0
                                                    ? t('practice:configs.summary.selectedWords', { count: config.wordIds?.length ?? 0 })
                                                    : t('practice:configs.summary.allWords')}
                                            </Pill>
                                            <Pill>
                                                {config.params.wordSelection === 'Random'
                                                    ? t('practice:configs.summary.randomOrder')
                                                    : t('practice:configs.summary.weakerFirst')}
                                            </Pill>
                                        </span>
                                    }
                                />
                                {config.missingCount > 0 && (
                                    <span className="meta text-(--danger)">{t('practice:configs.summary.someMissing')}</span>
                                )}
                            </button>
                            <span className="absolute top-2 right-2 flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('practice:configs.edit', { name: config.name })}
                                    onClick={() => setEditing(config)}
                                >
                                    <PencilSimpleIcon aria-hidden size={16} />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('practice:configs.delete', { name: config.name })}
                                    onClick={() => setDeleting(config)}
                                >
                                    <TrashIcon aria-hidden size={16} />
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {editing && (
                <SaveConfigDialog
                    open
                    onOpenChange={(open) => !open && setEditing(null)}
                    mode="edit"
                    config={editing}
                />
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={t('practice:configs.deleteDialog.title', { name: deleting?.name ?? '' })}
                description={t('practice:configs.deleteDialog.body')}
                confirmLabel={t('practice:configs.deleteDialog.confirm')}
                onConfirm={confirmDelete}
            />
        </div>
    );
}

/** The answer styles a configuration asks for: "Mixed" means both. */
function cardTypesOf(type: SavedConfig['params']['type']): CardType[] {
    return type === 'Random' ? ['Text-Input', 'Multiple-Choice'] : [type];
}
