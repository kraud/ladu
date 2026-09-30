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
}: {
    /** The big number or text of the first fact ("3 of 10", "12"). */
    figure: ReactNode;
    /** Small text under the first label ("2 correct so far"). */
    hint?: string;
    cardTypes: readonly CardType[];
    languages: readonly string[];
    partsOfSpeech: Parameters<typeof WordTypeGrid>[0]['partsOfSpeech'];
}) {
    const { t } = useTranslation();
    return (
        <span className="grid grid-cols-1 gap-y-3 md:grid-cols-3">
            <Stat>
                <Figure>{figure}</Figure>
                <CardTypeGrid types={cardTypes} className="self-end" />
                <span className="flex flex-col gap-0.5">
                    <span className="label">{t('practice:setup.resume.answeredLabel')}</span>
                    {hint && <span className="hint">{hint}</span>}
                </span>
            </Stat>
            <Stat className="md:border-l">
                <FlagGrid languages={languages} className="self-center" />
                <Figure>{languages.length}</Figure>
                <span className="label">{t('practice:results.languagesLabel', { count: languages.length })}</span>
            </Stat>
            <Stat className="md:border-l">
                <WordTypeGrid partsOfSpeech={partsOfSpeech} className="self-center" />
                <Figure>{partsOfSpeech.length}</Figure>
                <span className="label">{t('practice:results.typesLabel', { count: partsOfSpeech.length })}</span>
            </Stat>
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
            className="text-[42px] leading-none font-semibold tracking-tight tabular-nums"
            style={{ fontFamily: 'var(--font-display)' }}
        >
            {children}
        </span>
    );
}

function Stat({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <span
            className={`flex items-end justify-center gap-3 border-current/15 max-md:border-t max-md:pt-3 max-md:first:border-t-0 max-md:first:pt-0 ${className ?? ''}`}
        >
            {children}
        </span>
    );
}
