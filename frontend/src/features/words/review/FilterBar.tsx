/**
 * The collapsible filter bar (D5 — a bar above the table, not the blueprint's
 * left sidebar). Gender + Part of speech chips, then the language order
 * control. No Tags group (D1).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { GenderDE, GenderES, PartOfSpeech } from '@/ts/enums';
import { partOfSpeechLabelKey } from '@/lib/words';
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
    activeLanguages: LangKey[];
    allLanguages: LangKey[];
    onGenderChange: (next: string[] | undefined) => void;
    onPosChange: (next: PartOfSpeech[] | undefined) => void;
    onLanguagesChange: (next: LangKey[]) => void;
}

export function FilterBar({
    gender,
    pos,
    hasQuery,
    activeLanguages,
    allLanguages,
    onGenderChange,
    onPosChange,
    onLanguagesChange,
}: FilterBarProps) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    function toggleGenderValue(value: string) {
        const next = gender.includes(value) ? gender.filter((v) => v !== value) : [...gender, value];
        onGenderChange(next.length > 0 ? next : undefined);
    }

    function togglePos(value: PartOfSpeech) {
        const next = pos.includes(value) ? pos.filter((p) => p !== value) : [...pos, value];
        onPosChange(next.length > 0 ? next : undefined);
    }

    const activeCount = gender.length + pos.length + (hasQuery ? 1 : 0);

    if (collapsed) {
        return (
            <div className="card filterbar">
                <div className="fb-collapsed">
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('review:filters.show')}
                        title={t('review:filters.show')}
                        onClick={() => setCollapsed(false)}
                    >
                        <CaretDownIcon size={16} />
                    </button>
                    <span className="eyebrow">{t('review:filters.title')}</span>
                    {activeCount > 0 && <span className="active-pill">{activeCount}</span>}
                    <span className="hint">
                        {activeCount === 0
                            ? t('review:filters.noneActive')
                            : t('review:filters.activeCount', { count: activeCount })}
                    </span>
                    <span className="grow" />
                    <span className="meta">
                        {t('review:filters.languageOrder')}: {activeLanguages.join(' → ')}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="card filterbar">
            <div className="fb-body">
                <div className="fb-group">
                    <div className="fhead">
                        <span className="label">{t('review:filters.gender')}</span>
                        {gender.length > 0 && (
                            <button
                                type="button"
                                className="hint underline"
                                onClick={() => onGenderChange(undefined)}
                            >
                                {t('review:filters.clear')}
                            </button>
                        )}
                    </div>
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

                <div className="fb-group">
                    <div className="fhead">
                        <span className="label">{t('review:filters.partOfSpeech')}</span>
                    </div>
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

                <LanguageOrderControl
                    active={activeLanguages}
                    allLanguages={allLanguages}
                    onChange={onLanguagesChange}
                />

                <span className="grow" />
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('review:filters.collapse')}
                    title={t('review:filters.collapse')}
                    onClick={() => setCollapsed(true)}
                >
                    <CaretUpIcon size={16} />
                </button>
            </div>
        </div>
    );
}
