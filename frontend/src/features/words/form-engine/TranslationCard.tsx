/**
 * One language slot in the word editor: header (flag + native name, tinted
 * top border), config-driven body via `FieldRenderer`, and Clear/Remove
 * footer actions. Owns its own RHF instance + yup resolver — each card
 * validates independently and (from Slice 4, via `useWordFormState`) pushes
 * its own `{ language, cases, completionState, isDirty }` up to the parent
 * form state, mirroring the old app's per-language forms.
 *
 * The autocomplete row (EE/DE/ES noun autocomplete) is a Phase 3 concern —
 * only its mount point is reserved here.
 */
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FlagIcon } from '@/components/common/FlagIcon';
import { langTint, languageByLabel } from '@/lib/language';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { WordItem } from '@/ts/interfaces';
import { buildYupSchema } from './buildYupSchema';
import { getFormConfig } from './configs';
import { FieldRenderer } from './FieldRenderer';

export interface TranslationCardProps {
    lang: Lang;
    /** Defaults to Noun — the only part of speech the engine ships in Phase 2. */
    pos?: PartOfSpeech;
    initialCases?: WordItem[];
    displayOnly?: boolean;
    onRemove?: () => void;
    onClear?: () => void;
    removeDisabled?: boolean;
}

export function TranslationCard({
    lang,
    pos = PartOfSpeech.noun,
    initialCases,
    displayOnly = false,
    onRemove,
    onClear,
    removeDisabled = false,
}: TranslationCardProps) {
    const { t } = useTranslation();
    const config = getFormConfig(pos, lang);
    const schema = useMemo(() => (config ? buildYupSchema(config, t) : undefined), [config, t]);

    const defaultValues = useMemo(() => {
        if (!config) {
            return {};
        }
        const byCaseName = new Map((initialCases ?? []).map((item) => [item.caseName, item.word]));
        return Object.fromEntries(
            config.fields.map((field) => [
                field.name,
                field.kind === 'checkbox' ? false : (byCaseName.get(field.caseName) ?? ''),
            ])
        );
    }, [config, initialCases]);

    const form = useForm({
        resolver: schema ? yupResolver(schema) : undefined,
        defaultValues,
        values: defaultValues,
    });

    if (!config) {
        return (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                {t('wordRelated:wordFormSelector.languageNotAvailable')}
            </div>
        );
    }

    const langEntry = languageByLabel(lang);

    return (
        <div
            className="flex flex-col gap-4 rounded-lg border bg-card p-4"
            style={{ borderTopColor: langTint(lang), borderTopWidth: 2 }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FlagIcon lang={lang} title={langEntry?.native ?? lang} />
                    {langEntry?.native ?? lang}
                </div>
                {!displayOnly && (
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                            {t('common:buttons.clear')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={removeDisabled}>
                            {t('common:buttons.remove')}
                        </Button>
                    </div>
                )}
            </div>

            <Form {...form}>
                <div className="flex flex-col gap-3">
                    {/* Autocomplete row (EE/DE/ES noun autocomplete) — Phase 3 mount point. */}
                    {config.fields.map((field) => (
                        <FieldRenderer key={field.name} field={field} displayOnly={displayOnly} />
                    ))}
                </div>
            </Form>
        </div>
    );
}
