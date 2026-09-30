import { useState } from 'react';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { accountLanguageOrder } from '@/features/words/review/search';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { practiceErrorKey } from '../errors';
import { useConfigs, useDeleteConfig, useLoadConfigWords } from '../hooks';
import { toPreselectedWord, type PreselectedWord } from '../preselection';
import type { SavedConfig } from '../types';
import { FlagGrid } from './FlagGrid';
import { SaveConfigDialog } from './SaveConfigDialog';

/**
 * The user's saved configurations, under the set-up form. One tap on a row loads it:
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

    const title = t('practice:configs.title');

    return (
        <section className="card card-pad flex flex-col gap-2" aria-label={title}>
            <b>{title}</b>

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
                <ul className="flex flex-col">
                    {configs.data.map((config) => (
                        <li
                            key={config.id}
                            className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"
                        >
                            <button
                                type="button"
                                className="flex min-w-0 grow cursor-pointer flex-col gap-0.5 text-left"
                                aria-label={t('practice:configs.use', { name: config.name })}
                                disabled={loadingId !== null}
                                aria-busy={loadingId === config.id || undefined}
                                onClick={() => load(config)}
                            >
                                <span className="break-words font-medium">{config.name}</span>
                                {config.description && <span className="hint break-words">{config.description}</span>}
                                <ConfigSummary config={config} />
                            </button>
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
        </section>
    );
}

/** Flags, amount, answer style, word types and word count of one configuration. */
function ConfigSummary({ config }: { config: SavedConfig }) {
    const { t } = useTranslation();
    const { params } = config;
    const wordCount = config.wordIds?.length ?? 0;
    return (
        <span className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
            <FlagGrid languages={params.languages} />
            <span>{t('practice:configs.summary.amount', { count: params.amount })}</span>
            <span>{t(`practice:setup.options.type.${params.type}`)}</span>
            <span>{params.partsOfSpeech.map((pos) => t(partOfSpeechLabelKey(pos))).join(', ')}</span>
            {wordCount > 0 && <span>{t('practice:configs.summary.words', { count: wordCount })}</span>}
            {config.missingCount > 0 && (
                <span className="text-(--danger)">{t('practice:configs.summary.someMissing')}</span>
            )}
        </span>
    );
}
