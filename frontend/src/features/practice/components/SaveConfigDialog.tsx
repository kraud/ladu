import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorCode, practiceErrorKey } from '../errors';
import { useCreateConfig, useUpdateConfig } from '../hooks';
import type { PracticeParams, SavedConfig } from '../types';

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 200;

/** What a new configuration is made from: the settings on screen and the pre-selected words. */
export interface ConfigDraft {
    params: PracticeParams;
    wordIds: string[] | null;
    /** Set when the words were chosen by tag: the tags are saved with the words. */
    tagIds: string[] | null;
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void } & (
    | { mode: 'create'; draft: ConfigDraft; config?: undefined }
    | { mode: 'edit'; config: SavedConfig; draft?: undefined }
);

/**
 * Name + description of a saved configuration. Create saves the settings on screen;
 * edit changes the name and the description only (the settings and words stay).
 * A name that is already used stays an error under the name field, not a toast.
 * Deliberately not a `<form>`: the create dialog is opened from the set-up form,
 * and a nested submit must never start a session.
 */
export function SaveConfigDialog(props: Props) {
    const { open, onOpenChange, mode } = props;
    const { t } = useTranslation();
    const create = useCreateConfig();
    const update = useUpdateConfig();
    const mutation = mode === 'create' ? create : update;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [touched, setTouched] = useState(false);

    // Fresh fields on every open (edit: seeded from the configuration).
    const editedId = props.config?.id;
    useEffect(() => {
        if (!open) return;
        setName(props.config?.name ?? '');
        setDescription(props.config?.description ?? '');
        setTouched(false);
        create.reset();
        update.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, editedId]);

    const trimmed = name.trim();
    const nameMissing = touched && trimmed === '';
    const code = mutation.isError ? getApiErrorCode(mutation.error) : null;
    const nameTaken = code === 'name_taken';

    function save() {
        setTouched(true);
        if (trimmed === '' || mutation.isPending) return;
        const fields = { name: trimmed, description: description.trim() || null };
        const onSuccess = () => {
            toast.success(t(mode === 'create' ? 'practice:configs.toast.saved' : 'practice:configs.toast.updated'));
            onOpenChange(false);
        };
        if (props.mode === 'create') {
            create.mutate(
                { ...fields, params: props.draft.params, wordIds: props.draft.wordIds, tagIds: props.draft.tagIds },
                { onSuccess },
            );
        } else {
            const { config } = props;
            update.mutate(
                { id: config.id, body: { ...fields, params: config.params, wordIds: config.wordIds, tagIds: config.tagIds } },
                { onSuccess },
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {t(mode === 'create' ? 'practice:configs.dialog.createTitle' : 'practice:configs.dialog.editTitle')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="config-name">
                            {t('practice:configs.dialog.name')} <span className="text-(--danger)">*</span>
                        </Label>
                        <Input
                            id="config-name"
                            value={name}
                            maxLength={NAME_MAX}
                            autoComplete="off"
                            placeholder={t('practice:configs.dialog.namePlaceholder')}
                            aria-invalid={nameMissing || nameTaken ? true : undefined}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => setTouched(true)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    save();
                                }
                            }}
                        />
                        {nameMissing && (
                            <p className="err show" role="alert">
                                {t('practice:configs.dialog.nameRequired')}
                            </p>
                        )}
                        {nameTaken && (
                            <p className="err show" role="alert">
                                {t('practice:configs.dialog.nameTaken')}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="config-description">{t('practice:configs.dialog.description')}</Label>
                        <Textarea
                            id="config-description"
                            value={description}
                            maxLength={DESCRIPTION_MAX}
                            rows={3}
                            placeholder={t('practice:configs.dialog.descriptionPlaceholder')}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </div>

                    {mode === 'create' && props.draft.tagIds && (
                        <p className="hint">{t('practice:configs.dialog.withTags', { count: props.draft.tagIds.length })}</p>
                    )}
                    {mode === 'create' && !props.draft.tagIds && props.draft.wordIds && (
                        <p className="hint">
                            {t('practice:configs.dialog.withWords', { count: props.draft.wordIds.length })}
                        </p>
                    )}

                    {mutation.isError && !nameTaken && (
                        <p className="err show" role="alert">
                            {t(practiceErrorKey(mutation.error))}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button type="button" disabled={mutation.isPending} onClick={save}>
                        {mutation.isPending ? t('practice:configs.dialog.saving') : t('practice:configs.dialog.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
