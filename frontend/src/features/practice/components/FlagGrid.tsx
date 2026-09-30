import { FlagIcon } from '@/components/common/FlagIcon';
import { gridItemStyle, gridStyle } from './gridShape';

/** The flags of some languages in a compact grid (decorative: the count and names are written next to it). */
export function FlagGrid({ languages, className }: { languages: readonly string[]; className?: string }) {
    return (
        <span
            aria-hidden
            data-testid="flag-grid"
            className={`grid shrink-0 gap-1 ${className ?? ''}`}
            style={gridStyle(languages.length)}
        >
            {languages.map((language, index) => (
                <span key={language} className="flex" style={gridItemStyle(index, languages.length)}>
                    <FlagIcon lang={language} width={22} height={16} />
                </span>
            ))}
        </span>
    );
}
