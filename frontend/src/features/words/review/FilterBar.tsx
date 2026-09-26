/**
 * The collapsible filter bar (D5). Gender + Part of speech chips, then the
 * language order control. No Tags group (D1). Can sit above the table (a
 * horizontal bar) or, via the position toggle next to the collapse arrow, as
 * a left sidebar — mirroring `WordEditorLayout`'s collapsible action sidebar
 * (icon-rail width when collapsed, full width otherwise). Both the collapse
 * state and the position live in `uiStore` (`reviewSidebarCollapsed` /
 * `reviewFilterPosition`), session-scoped like `WordEditorLayout`'s own
 * `wordSidebarCollapsed`, so they survive this component's own remounts
 * (e.g. filter changes elsewhere on the page) without being persisted.
 *
 * The show/hide toggle's arrow points the way the bar moves: up/down above
 * the table, left/right as a sidebar (collapse points left, expand points
 * right — the same as the word editor's sidebar).
 *
 * The show/hide toggle lives in one persistent header row, rendered in BOTH
 * states, always as the first/leftmost element — a deliberate deviation from
 * `MOCKUPS/review.html` (a real usability fix, flagged for the user): the
 * mockup puts the expand button first in a collapsed-only strip but the
 * collapse button LAST in the expanded body (after a `grow` spacer inside a
 * `flex-wrap` row, so at narrower widths it isn't even reliably anchored to a
 * corner). Only the icon (caret) and the collapsed-only summary text
 * change between states; the button itself never moves. The position toggle
 * sits immediately after it.
 *
 * On a phone (`layout="menu"`, used by `MobileFilters`) none of the above
 * applies: the groups render alone, in one column, inside the side menu —
 * no card, no header, no collapse or position toggle (the menu itself opens
 * and closes, and the stored top/sidebar preference is a desktop one).
 *
 * In sidebar position, the filter groups (gender, PoS, language order) stack
 * in a column instead of wrapping in a row (`fb-body--sidebar`), and a
 * collapsed sidebar narrows to an icon rail rather than just hiding its body
 * — there's no room left for the eyebrow/hint text at that width, so the
 * header itself stacks vertically and drops everything but the two toggles
 * and the active-filter count.
 */
import { useTranslation } from 'react-i18next';
import {
    CaretDownIcon,
    CaretLeftIcon,
    CaretRightIcon,
    CaretUpIcon,
    RowsIcon,
    SidebarSimpleIcon,
} from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { GenderDE, GenderES, PartOfSpeech } from '@/ts/enums';
import { partOfSpeechLabelKey } from '@/lib/words';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
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
    /** `'menu'`: just the groups, in a column, for the phone's side menu. Defaults to the collapsible bar/sidebar. */
    layout?: 'bar' | 'menu';
}

/** The number in the "N filters" pill: each gender and part-of-speech value, plus the search box when it has text. */
export function activeFilterCount(gender: string[], pos: PartOfSpeech[], hasQuery: boolean): number {
    return gender.length + pos.length + (hasQuery ? 1 : 0);
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
    layout = 'bar',
}: FilterBarProps) {
    const { t } = useTranslation();
    const collapsed = useUiStore((s) => s.reviewSidebarCollapsed);
    const setCollapsed = useUiStore((s) => s.setReviewSidebarCollapsed);
    const position = useUiStore((s) => s.reviewFilterPosition);
    const setPosition = useUiStore((s) => s.setReviewFilterPosition);
    const isSidebar = position === 'sidebar';
    const isRail = isSidebar && collapsed;

    function toggleGenderValue(value: string) {
        const next = gender.includes(value) ? gender.filter((v) => v !== value) : [...gender, value];
        onGenderChange(next.length > 0 ? next : undefined);
    }

    function togglePos(value: PartOfSpeech) {
        const next = pos.includes(value) ? pos.filter((p) => p !== value) : [...pos, value];
        onPosChange(next.length > 0 ? next : undefined);
    }

    const activeCount = activeFilterCount(gender, pos, hasQuery);
    const Container = isSidebar ? 'aside' : 'div';

    const groups = (
        <>
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
        </>
    );

    if (layout === 'menu') {
        return <div className="fb-body fb-body--sidebar mt-0 border-t-0 pt-0">{groups}</div>;
    }

    return (
        <Container
            className={cn(
                'card filterbar',
                isSidebar && [
                    'sticky top-[68px] flex max-h-[calc(100dvh-84px)] flex-col overflow-y-auto transition-[width] duration-150',
                    collapsed ? 'w-14' : 'w-64',
                    'max-[920px]:static max-[920px]:!w-full max-[920px]:max-h-none',
                ],
            )}
        >
            <div className={cn('fb-header', isRail && 'fb-header--rail')}>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t(collapsed ? 'review:filters.show' : 'review:filters.collapse')}
                    title={t(collapsed ? 'review:filters.show' : 'review:filters.collapse')}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {/* The arrow points where the bar goes: left/right for the sidebar, up/down above the table. */}
                    {isSidebar ? (
                        collapsed ? <CaretRightIcon size={16} /> : <CaretLeftIcon size={16} />
                    ) : collapsed ? (
                        <CaretDownIcon size={16} />
                    ) : (
                        <CaretUpIcon size={16} />
                    )}
                </button>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t(isSidebar ? 'review:filters.moveToTop' : 'review:filters.moveToSidebar')}
                    title={t(isSidebar ? 'review:filters.moveToTop' : 'review:filters.moveToSidebar')}
                    onClick={() => setPosition(isSidebar ? 'top' : 'sidebar')}
                >
                    {isSidebar ? <RowsIcon size={16} /> : <SidebarSimpleIcon size={16} />}
                </button>
                {!isRail && (
                    <>
                        <span className="eyebrow">{t('review:filters.title')}</span>
                        {activeCount > 0 && <span className="active-pill">{activeCount}</span>}
                        {collapsed && (
                            <span className="hint">
                                {activeCount === 0
                                    ? t('review:filters.noneActive')
                                    : t('review:filters.activeCount', { count: activeCount })}
                            </span>
                        )}
                        <span className="grow" />
                        {collapsed && !isSidebar && (
                            <span className="meta">
                                {t('review:filters.languageOrder')}: {activeLanguages.join(' → ')}
                            </span>
                        )}
                    </>
                )}
                {isRail && activeCount > 0 && <span className="active-pill">{activeCount}</span>}
            </div>

            {!collapsed && (
                <div className={cn('fb-body', isSidebar && 'fb-body--sidebar')}>
                    {groups}
                </div>
            )}
        </Container>
    );
}
