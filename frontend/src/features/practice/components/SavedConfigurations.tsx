import { useState } from 'react';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { accountLanguageOrder } from '@/features/words/review/search';
import { useAuthStore } from '@/stores/authStore';
import { practiceErrorKey } from '../errors';
import { useConfigs, useDeleteConfig, useLoadConfigWords } from '../hooks';
import { toPreselectedWord, type PreselectedWord } from '../preselection';
import type { CardType, SavedConfig } from '../types';
import { SaveConfigDialog } from './SaveConfigDialog';
import { SetupFacts } from './SetupFacts';

/**
 * The user's saved configurations: the content of the "Saved configurations" tab on the set-up screen. One tap on a row loads it:
 * the page gets the configuration and its words (still visible ones, with labels).
 * `words` is `null` when the configuration has none. Edit changes name and description;
 * delete asks first. A failed load or delete stays as a message here, never a lost click.
 */
export function SavedConfigurations({
    onLoad,
}: {
    onLoad: (config: SavedConfig, words: PreselectedWord[] | null) => void;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const configs = useConfigs();
    const loadWords = useLoadConfigWords();
    const deleteConfig = useDeleteConfig();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [editing, setEditing] = useState<SavedConfig | null>(null);
    const [deleting, setDeleting] = useState<SavedConfig | null>(null);

    function load(config: SavedConfig) {
        if (loadingId) return;
        if (!config.wordIds || config.wordIds.length === 0) {
            onLoad(config, null);
            return;
        }
        setLoadingId(config.id);
        loadWords.mutate(config.id, {
            onSuccess: (rows) => {
                const order = accountLanguageOrder(user?.languages ?? []);
                onLoad(
                    config,
                    rows.map((row) => toPreselectedWord(row, order)),
                );
            },
            onSettled: () => setLoadingId(null),
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
                                />
                                <span className="meta flex flex-wrap items-center gap-x-2">
                                    <span>
                                        {(config.wordIds?.length ?? 0) > 0
                                            ? t('practice:configs.summary.selectedWords', { count: config.wordIds?.length ?? 0 })
                                            : t('practice:configs.summary.allWords')}
                                    </span>
                                    <span aria-hidden>·</span>
                                    <span>
                                        {config.params.wordSelection === 'Random'
                                            ? t('practice:configs.summary.randomOrder')
                                            : t('practice:configs.summary.weakerFirst')}
                                    </span>
                                    {config.missingCount > 0 && (
                                        <span className="text-(--danger)">{t('practice:configs.summary.someMissing')}</span>
                                    )}
                                </span>
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
