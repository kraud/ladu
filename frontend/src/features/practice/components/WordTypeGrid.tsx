import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { posAbbrKey } from '@/features/words/review/columns';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { PartOfSpeech } from '@/ts/enums';
import { gridItemStyle, gridStyle } from './gridShape';

/**
 * The word types of a session as small abbreviation tags ("n.", "v.") in the same grid
 * shape as the flags (two rows, filled column by column). Each tag shows its full name in a tooltip after a second; screen readers read
 * the full names.
 */
export function WordTypeGrid({ partsOfSpeech, className }: { partsOfSpeech: readonly PartOfSpeech[]; className?: string }) {
    const { t } = useTranslation();
    return (
        <ul
            data-testid="types-grid"
            className={`grid shrink-0 gap-1 ${className ?? ''}`}
            style={gridStyle(partsOfSpeech.length)}
        >
            {partsOfSpeech.map((pos, index) => (
                <li key={pos} style={gridItemStyle(index, partsOfSpeech.length)}>
                    <Tooltip>
                        <TooltipTrigger
                            delay={1000}
                            render={
                                <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-md border border-border bg-(--fg-soft) px-1.5 font-mono text-[11px] font-bold text-muted-foreground" />
                            }
                        >
                            <span aria-hidden>{t(posAbbrKey(pos))}</span>
                            <span className="sr-only">{t(partOfSpeechLabelKey(pos))}</span>
                        </TooltipTrigger>
                        <TooltipContent>{t(partOfSpeechLabelKey(pos))}</TooltipContent>
                    </Tooltip>
                </li>
            ))}
        </ul>
    );
}
