/**
 * The Review filters as `SidebarLayout` sections (`useFilterSections`): Gender,
 * Part of speech, Tags (`TagCombobox`, mode="filter", D15/D17 — additive/OR,
 * applies instantly like the other groups, no Save step) and Language order.
 * The layout draws the frame — the docked panel, the icon rail, the phone's
 * slide-in menu — so there is no collapse toggle, position toggle or top bar
 * here any more; the filters are always a column.
 *
 * Each section reports its own `count` (gender picks, part-of-speech picks,
 * tags), so the collapsed rail shows which groups are filtering. Language
 * order has none: it changes the columns, it does not filter rows. The search
 * box lives in the toolbar above the table, not here; `activeFilterCount`
 * adds it to the total that the phone's "Filters" button shows.
 */
import { useTranslation } from 'react-i18next';
import { GenderIntersexIcon, TagIcon, TextAaIcon, TranslateIcon } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import type { SidebarSection } from '@/components/layout/sidebar/SidebarLayout';
import { GenderDE, GenderES, PartOfSpeech } from '@/ts/enums';
import { partOfSpeechLabelKey } from '@/lib/words';
import { TagCombobox } from '@/features/tags/components/TagCombobox';
import type { TagSummary } from '@/features/tags/types';
import type { LangKey } from '@/features/words/types';
import { posAbbrKey } from './columns';
import { LanguageOrderControl } from './LanguageOrderControl';

/** The four shipped parts of speech, matching `PartOfSpeechSelector`'s `SHIPPED_POS`. */
const SHIPPED_POS: readonly PartOfSpeech[] = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
];

/**
 * Gender chips are per-language, not merged across languages (revised from
 * the initial D16 cross-language grouping after user review — a combined
 * "Neuter" chip matching both German `das` and Spanish `el/la` at once was
 * more than the current scope needs; a multi-language badge is left for a
 * future pass if it turns out to be wanted). Each chip toggles exactly one
 * stored case value.
 */
const GENDER_BY_LANGUAGE: readonly { key: 'DE' | 'ES'; values: readonly string[] }[] = [
    { key: 'DE', values: [GenderDE.M, GenderDE.F, GenderDE.N] },
    { key: 'ES', values: [GenderES.M, GenderES.F, GenderES.N] },
];

export interface FilterBarProps {
    gender: string[];
    pos: PartOfSpeech[];
    /** Whether the toolbar search box currently has a value — counted in the active-filter summary. */
    hasQuery: boolean;
    /** Resolved `TagSummary`s for `ReviewSearch.tag`'s ids (`useTagsByIds`) — `TagCombobox`'s pills need the label/visibility, not just the id. */
    selectedTags: TagSummary[];
    activeLanguages: LangKey[];
    allLanguages: LangKey[];
    onGenderChange: (next: string[] | undefined) => void;
    onPosChange: (next: PartOfSpeech[] | undefined) => void;
    onSelectedTagsChange: (next: TagSummary[]) => void;
    onLanguagesChange: (next: LangKey[]) => void;
}

/** The number in the "N filters" pill: each gender, part-of-speech, and tag pick, plus the search box when it has text. */
export function activeFilterCount(
    gender: string[],
    pos: PartOfSpeech[],
    hasQuery: boolean,
    tagCount = 0,
): number {
    return gender.length + pos.length + tagCount + (hasQuery ? 1 : 0);
}

export function useFilterSections({
    gender,
    pos,
    selectedTags,
    activeLanguages,
    allLanguages,
    onGenderChange,
    onPosChange,
    onSelectedTagsChange,
    onLanguagesChange,
}: FilterBarProps): SidebarSection[] {
    const { t } = useTranslation();

    function toggleGenderValue(value: string) {
        const next = gender.includes(value) ? gender.filter((v) => v !== value) : [...gender, value];
        onGenderChange(next.length > 0 ? next : undefined);
    }

    function togglePos(value: PartOfSpeech) {
        const next = pos.includes(value) ? pos.filter((p) => p !== value) : [...pos, value];
        onPosChange(next.length > 0 ? next : undefined);
    }

    const clear = (onClick: () => void) => (
        <button type="button" className="hint self-start underline" onClick={onClick}>
            {t('review:filters.clear')}
        </button>
    );

    return [
        {
            id: 'gender',
            label: t('review:filters.gender'),
            icon: <GenderIntersexIcon size={18} />,
            count: gender.length,
            content: (
                <div className="fb-group">
                    {gender.length > 0 && clear(() => onGenderChange(undefined))}
                    <div className="flex flex-col gap-1.5">
                        {GENDER_BY_LANGUAGE.map((group) => (
                            <div key={group.key} className="flex flex-wrap items-center gap-2">
                                <span className="hint flex items-center gap-1">
                                    <FlagIcon lang={group.key} /> {group.key}
                                </span>
                                <div className="chips">
                                    {group.values.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className="chip"
                                            aria-pressed={gender.includes(value)}
                                            onClick={() => toggleGenderValue(value)}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: 'pos',
            label: t('review:filters.partOfSpeech'),
            icon: <TextAaIcon size={18} />,
            count: pos.length,
            content: (
                <div className="fb-group">
                    {pos.length > 0 && clear(() => onPosChange(undefined))}
                    <div className="chips">
                        {SHIPPED_POS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                className="chip"
                                aria-pressed={pos.includes(value)}
                                title={t(partOfSpeechLabelKey(value))}
                                onClick={() => togglePos(value)}
                            >
                                {t(posAbbrKey(value))}
                            </button>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: 'tags',
            label: t('review:filters.tags'),
            icon: <TagIcon size={18} />,
            count: selectedTags.length,
            content: (
                <div className="fb-group">
                    {selectedTags.length > 0 && clear(() => onSelectedTagsChange([]))}
                    <TagCombobox
                        mode="filter"
                        selected={selectedTags}
                        // `TagCombobox` only needs id/label/visibility off a picked item (see its
                        // own header comment); in filter mode every item is still a full
                        // `TagSummary`, from `selectedTags` or from its own search results.
                        onSelectedChange={(next) => onSelectedTagsChange(next as TagSummary[])}
                    />
                </div>
            ),
        },
        {
            id: 'language-order',
            label: t('review:filters.languageOrder'),
            icon: <TranslateIcon size={18} />,
            content: (
                <LanguageOrderControl
                    active={activeLanguages}
                    allLanguages={allLanguages}
                    onChange={onLanguagesChange}
                    stacked
                    hideLabel
                />
            ),
        },
    ];
}
