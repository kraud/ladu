import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { caseParts, type CasePart } from '@/lib/cases';
import { partOfSpeechLabelKey } from '@/lib/words';
import { posAbbrKey } from '@/features/words/review/columns';
import type { PartOfSpeech } from '@/ts/enums';

export type FormLabelMode = 'abbreviated' | 'full';

/** How long the pointer rests on an abbreviation before the full word shows. */
const TOOLTIP_DELAY_MS = 1000;

/**
 * The word type and the grammatical form of an exercise, e.g. "Noun · Singular ·
 * Nominative" (`full`) or "n. sg. nom." (`abbreviated`, the default). In the short
 * mode every piece is its own hover target: after a second the tooltip gives the
 * full word ("nom." → "Nominative"). The mode is a prop so a later setting can
 * switch every label at once.
 *
 * Screen readers always read the full words (the abbreviations are hidden from them).
 */
export function FormLabel({
    partOfSpeech,
    caseName,
    mode = 'abbreviated',
    className,
}: {
    partOfSpeech: PartOfSpeech;
    caseName: string;
    mode?: FormLabelMode;
    className?: string;
}) {
    const { t } = useTranslation();
    const parts: CasePart[] = [
        { full: t(partOfSpeechLabelKey(partOfSpeech)), abbr: t(posAbbrKey(partOfSpeech)) },
        ...caseParts(t, partOfSpeech, caseName),
    ];

    if (mode === 'full') {
        return <span className={className}>{parts.map((part) => part.full).join(' · ')}</span>;
    }

    return (
        <span className={`inline-flex flex-wrap gap-x-1 ${className ?? ''}`}>
            {parts.map((part, index) => (
                <span key={index}>
                    <Tooltip>
                        <TooltipTrigger
                            delay={TOOLTIP_DELAY_MS}
                            render={
                                <span
                                    aria-hidden
                                    className="underline decoration-dotted decoration-(--fg-soft2) underline-offset-2"
                                />
                            }
                        >
                            {part.abbr}
                        </TooltipTrigger>
                        <TooltipContent>{part.full}</TooltipContent>
                    </Tooltip>
                    <span className="sr-only">
                        {part.full}
                        {index < parts.length - 1 ? ', ' : ''}
                    </span>
                </span>
            ))}
        </span>
    );
}
