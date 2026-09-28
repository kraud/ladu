/**
 * Create/edit a tag — mode-driven (D8), each mode owning its own mutation
 * state via a fresh `useCreateTag`/`useUpdateTag` per dialog instance,
 * rather than one overloaded slot. Delete is deliberately NOT a third mode
 * here: the mockup uses a separate confirm dialog for it
 * (`MOCKUPS/tags.html`'s `#del-dialog`), which is exactly `ConfirmDialog`
 * (`components/common/ConfirmDialog.tsx`) — reused directly by `TagsPage`,
 * not folded into this form.
 *
 * The "Add words now" section (D18/D19) renders only in create mode — an
 * existing tag's words are managed from its own page (Slice 6), not
 * re-opened here.
 *
 * Label uniqueness is NOT pre-checked client-side (unlike the mockup's own
 * in-memory check): D13 moved that check server-side specifically to drop
 * the old app's pre-check round trip, so replicating it here would undo the
 * point. A 409 surfaces as an inline error under the Label field instead.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getApiErrorMessage } from '@/api/types';
import { useCreateTag, useUpdateTag } from '../hooks';
import { tagErrorKey } from '../errors';
import { WordPicker, type PickedWord } from './WordPicker';
import type { TagSummary, TagVisibility } from '../types';

export interface TagFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    /** Required in edit mode — the tag being edited. */
    tag?: TagSummary;
    /** Fires after a successful create or update, with the resulting tag. */
    onSaved?: (tag: TagSummary) => void;
    /** Forwarded to the create-mode `WordPicker` — the caller owns `useNavigate`, this dialog doesn't. */
    onGoToReview?: () => void;
}

const LABEL_CONFLICT_MESSAGE = 'You already have a tag with this label.';

export function TagFormDialog({ open, onOpenChange, mode, tag, onSaved, onGoToReview }: TagFormDialogProps) {
    const { t } = useTranslation();
    const createTag = useCreateTag();
    const updateTag = useUpdateTag();
    const mutation = mode === 'create' ? createTag : updateTag;

    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<TagVisibility>('Public');
    const [pickedWords, setPickedWords] = useState<PickedWord[]>([]);
    const [labelTouched, setLabelTouched] = useState(false);

    // Reset every field when the dialog opens — for edit mode, seeded from
    // the tag; for create, always blank, even if the same dialog instance
    // was just used to create a different tag a moment ago.
    useEffect(() => {
        if (!open) return;
        setLabel(mode === 'edit' ? (tag?.label ?? '') : '');
        setDescription(mode === 'edit' ? (tag?.description ?? '') : '');
        setVisibility(mode === 'edit' ? (tag?.visibility ?? 'Public') : 'Public');
        setPickedWords([]);
        setLabelTouched(false);
        mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, tag?.id]);

    const trimmedLabel = label.trim();
    const showRequiredError = labelTouched && trimmedLabel === '';
    const errorMessage = getApiErrorMessage(mutation.error);
    const showConflictError = errorMessage === LABEL_CONFLICT_MESSAGE;

    function handleSubmit() {
        setLabelTouched(true);
        if (trimmedLabel === '') return;

        if (mode === 'create') {
            createTag.mutate(
                {
                    label: trimmedLabel,
                    description: description.trim() || undefined,
                    visibility,
                    wordIds: pickedWords.length > 0 ? pickedWords.map((w) => w.id) : undefined,
                },
                {
                    onSuccess: (created) => {
                        onOpenChange(false);
                        onSaved?.(created);
                    },
                },
            );
        } else if (tag) {
            updateTag.mutate(
                { id: tag.id, body: { label: trimmedLabel, description: description.trim(), visibility } },
                {
                    onSuccess: (updated) => {
                        onOpenChange(false);
                        onSaved?.(updated);
                    },
                },
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t(mode === 'create' ? 'tags:form.createTitle' : 'tags:form.editTitle')}</DialogTitle>
                </DialogHeader>

                <div className="flex max-h-[66vh] flex-col gap-4 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="tag-form-label">
                            {t('tags:form.labelField')} <span className="text-(--danger)">*</span>
                        </Label>
                        <Input
                            id="tag-form-label"
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            onBlur={() => setLabelTouched(true)}
                            placeholder={t('tags:form.labelPlaceholder')}
                            aria-invalid={showRequiredError || showConflictError}
                            autoComplete="off"
                        />
                        {showRequiredError && (
                            <span className="text-xs text-(--danger)">{t('tags:form.labelRequiredError')}</span>
                        )}
                        {showConflictError && (
                            <span className="text-xs text-(--danger)">{t(tagErrorKey(mutation.error))}</span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="tag-form-description">{t('tags:form.descriptionField')}</Label>
                        <Textarea
                            id="tag-form-description"
                            rows={2}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={t('tags:form.descriptionPlaceholder')}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>
                            {t('tags:form.visibilityField')} <span className="text-(--danger)">*</span>
                        </Label>
                        <RadioGroup
                            className="flex-col gap-2"
                            value={visibility}
                            onValueChange={(next) => setVisibility(next as TagVisibility)}
                        >
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-(--border) p-2.5">
                                <RadioGroupItem value="Public" className="mt-0.5" />
                                <span className="flex flex-col gap-0.5">
                                    <b className="text-sm">{t('tags:form.visibilityPublic')}</b>
                                    <span className="text-xs text-(--muted)">
                                        {t('tags:form.visibilityPublicHint')}
                                    </span>
                                </span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-(--border) p-2.5">
                                <RadioGroupItem value="Private" className="mt-0.5" />
                                <span className="flex flex-col gap-0.5">
                                    <b className="text-sm">{t('tags:form.visibilityPrivate')}</b>
                                    <span className="text-xs text-(--muted)">
                                        {t('tags:form.visibilityPrivateHint')}
                                    </span>
                                </span>
                            </label>
                        </RadioGroup>
                    </div>

                    {mode === 'create' && (
                        <WordPicker
                            selected={pickedWords}
                            onSelectedChange={setPickedWords}
                            onGoToReview={onGoToReview}
                        />
                    )}

                    {errorMessage && !showConflictError && (
                        <p className="text-sm text-(--danger)">{t(tagErrorKey(mutation.error))}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
                        {t(mode === 'create' ? 'tags:form.createSubmit' : 'tags:form.editSubmit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
