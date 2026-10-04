/**
 * The word editor's sidebar sections — Clue, Tags and the Linked words
 * placeholder — as the `SidebarLayout` sections the layout renders (heading,
 * rail icon, rail badge). Tags have exactly one editable state: the shared
 * `TagCombobox` (D15/D17), embedded inline, and it only ever appears when the
 * caller passes `tagPicker` — i.e. `WordForm`'s create/edit forms. Everywhere
 * else (`WordPage`'s view state) tags are read-only chips, because tag
 * editing is no longer possible outside the create/edit form (a 2026-09-28
 * reversal of the original "mutations apply instantly, independent of the
 * word's own Save" design — see `phase-4-tags.md`'s Risks). The actions
 * (Save word, Change word type, …) live in the bottom bar, not here.
 *
 * `onClueChange` absent means read-only (`WordPage`'s view state) — clue
 * renders as plain text and only when non-empty. `tagPicker` absent means the
 * tags section is read-only too, for either of two different reasons the
 * caller distinguishes via `tagsHint`: a word reached via a followed tag
 * (tags are the tag owner's to manage) or the caller's own word just being
 * viewed, not edited (tags are still that caller's own, but changing them
 * now requires entering edit mode first).
 *
 * On the collapsed rail the icon says whether a section holds something: a
 * clue with text swaps `PencilSimple` for `PencilSimpleLine`; tags swap the
 * plain tag for a duotone one with a count badge. Linked words is a
 * placeholder for a future feature (links between synonyms and related
 * words): it shows a short "coming soon" note and holds no data.
 */
import { useTranslation } from 'react-i18next';
import { LinkSimpleIcon, PencilSimpleIcon, PencilSimpleLineIcon, TagIcon } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { TagChip } from '@/components/common/TagChip';
import type { SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { TagCombobox, type TagComboboxItem } from '@/features/tags/components/TagCombobox';
import type { WordTagRef } from '../types';

export interface SidebarFieldsProps {
    clue: string;
    onClueChange?: (value: string) => void;
    /** The word's current tags, read-only display. Ignored when `tagPicker` is set. */
    tags?: WordTagRef[];
    /** Shown under the read-only chip list, explaining why tags can't be changed here. */
    tagsHint?: string;
    /** Create/edit mode only — renders the tag combobox inline instead of a static list. */
    tagPicker?: {
        selected: TagComboboxItem[];
        onSelectedChange: (next: TagComboboxItem[]) => void;
    };
}

export function useWordSidebarSections({
    clue,
    onClueChange,
    tags = [],
    tagsHint,
    tagPicker,
}: SidebarFieldsProps): SidebarSection[] {
    const { t } = useTranslation();
    const readOnly = !onClueChange;
    const tagCount = tagPicker ? tagPicker.selected.length : tags.length;
    const clueLabel = t('wordRelated:formComponentLabel.clue');
    const tagsLabel = t('wordRelated:formComponentLabel.tags');
    const linkedLabel = t('wordRelated:formComponentLabel.linkedWords');
    const hasClue = clue.trim() !== '';

    const sections: SidebarSection[] = [];

    // A read-only word without a clue has nothing to show under Clue.
    if (!readOnly || hasClue) {
        sections.push({
            id: 'clue',
            label: clueLabel,
            icon: <PencilSimpleIcon size={18} />,
            filledIcon: <PencilSimpleLineIcon size={18} />,
            filled: hasClue,
            focusSelector: readOnly ? undefined : '#word-clue',
            content: readOnly ? (
                <p className="text-sm text-foreground">{clue}</p>
            ) : (
                <Textarea
                    id="word-clue"
                    aria-label={clueLabel}
                    value={clue}
                    onChange={(e) => onClueChange?.(e.target.value)}
                />
            ),
        });
    }

    sections.push({
        id: 'tags',
        label: tagsLabel,
        icon: <TagIcon size={18} />,
        filledIcon: <TagIcon size={18} weight="duotone" />,
        filled: tagCount > 0,
        count: tagCount,
        content: tagPicker ? (
            <TagCombobox mode="add" selected={tagPicker.selected} onSelectedChange={tagPicker.onSelectedChange} />
        ) : (
            <>
                <div className="card flex min-h-9 flex-wrap items-center gap-1.5 p-2" role="group" aria-label={tagsLabel}>
                    {tags.map((tag) => (
                        <TagChip key={tag.id} label={tag.label} locked={tag.visibility === 'Private'} />
                    ))}
                </div>
                {tagsHint && <p className="hint">{tagsHint}</p>}
            </>
        ),
    });

    sections.push({
        id: 'linked-words',
        label: linkedLabel,
        icon: <LinkSimpleIcon size={18} />,
        content: (
            <div className="flex flex-col gap-1">
                <p className="hint">{t('wordRelated:linkedWords.description')}</p>
                <p className="meta">{t('wordRelated:linkedWords.comingSoon')}</p>
            </div>
        ),
    });

    return sections;
}
