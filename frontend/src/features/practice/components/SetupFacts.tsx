import { ListBulletsIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardType } from '../types';
import { FlagGrid } from './FlagGrid';
import { gridItemStyle, gridStyle } from './gridShape';
import { WordTypeGrid } from './WordTypeGrid';

/**
 * The three facts the set-up shows about a session or a configuration (the design of the resume
 * banner): a big figure with the answer styles, the languages, and the word types. Built from
 * `span`s, so it can sit inside a `<button>` (a clickable row) as well as in a `<section>`.
 */
export function SetupFacts({
    figure,
    hint,
    cardTypes,
    languages,
    partsOfSpeech,
    extra,
}: {
    /** The big number or text of the first fact ("3 of 10", "12"). */
    figure: ReactNode;
    /** Small text under the first label ("2 correct so far"). */
    hint?: string;
    cardTypes: readonly CardType[];
    languages: readonly string[];
    partsOfSpeech: Parameters<typeof WordTypeGrid>[0]['partsOfSpeech'];
    /** A fourth fact (a saved configuration's words and order); the grid then has four columns. */
    extra?: ReactNode;
}) {
    const { t } = useTranslation();
    // Phone: two cells per row with a separator between them. The figure and the extra facts share the top row
    // (the figure takes the whole row without extra facts); languages and word types share the second.
    return (
        <span className={`grid grid-cols-2 gap-y-2 ${extra ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <Stat className={`max-md:order-1 ${extra ? '' : 'max-md:col-span-2'}`}>
                <Figure>{figure}</Figure>
                <CardTypeGrid types={cardTypes} className="self-end" />
                <span className="flex flex-col gap-0.5">
                    <span className="label">{t('practice:setup.resume.answeredLabel')}</span>
                    {hint && <span className="hint">{hint}</span>}
                </span>
            </Stat>
            <Stat className="max-md:order-3 max-md:border-t max-md:pt-2 md:border-l">
                <FlagGrid languages={languages} className="self-center" />
                <Figure>{languages.length}</Figure>
                <span className="label">{t('practice:results.languagesLabel', { count: languages.length })}</span>
            </Stat>
            <Stat className="max-md:order-4 max-md:border-t max-md:border-l max-md:pt-2 md:border-l">
                <WordTypeGrid partsOfSpeech={partsOfSpeech} className="self-center" />
                <Figure>{partsOfSpeech.length}</Figure>
                <span className="label">{t('practice:results.typesLabel', { count: partsOfSpeech.length })}</span>
            </Stat>
            {extra && <Stat className="border-l max-md:order-2">{extra}</Stat>}
        </span>
    );
}

/** A small rounded label; stack two in a column for a fact with two values. */
export function Pill({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
            {children}
        </span>
    );
}

/** The answer styles (typed / chosen) in the same column grid as the flags; one or two icons. */
export function CardTypeGrid({ types, className }: { types: readonly CardType[]; className?: string }) {
    return (
        <span
            aria-hidden
            data-testid="card-type-grid"
            className={`grid shrink-0 gap-1 ${className ?? ''}`}
            style={gridStyle(types.length)}
        >
            {types.map((type, index) => (
                <span key={type} className="flex" style={gridItemStyle(index, types.length)}>
                    {type === 'Text-Input' ? (
                        <PencilSimpleLineIcon weight="bold" size={16} />
                    ) : (
                        <ListBulletsIcon weight="bold" size={16} />
                    )}
                </span>
            ))}
        </span>
    );
}

function Figure({ children }: { children: ReactNode }) {
    return (
        <span
            className="text-[28px] leading-none font-semibold tracking-tight tabular-nums md:text-[42px]"
            style={{ fontFamily: 'var(--font-display)' }}
        >
            {children}
        </span>
    );
}

function Stat({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <span
            className={`flex flex-wrap items-end justify-center gap-x-2 gap-y-1 border-current/15 md:gap-x-3 ${className ?? ''}`}
        >
            {children}
        </span>
    );
}
