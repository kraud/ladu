import { cn } from '@/lib/utils';
import { languageByKey, languageByLabel, type UiLanguage } from '@/lib/language';

/**
 * A language's country flag (EN→GB, ES, DE, EE), served from `public/`.
 * Accepts either the enum key (`"EN"`) or the stored label (`"English"`).
 * Decorative by default — pass `title` to give it an accessible name.
 */
export function FlagIcon({
    lang,
    className,
    title,
    width = 16,
    height = 16,
}: {
    lang: string;
    className?: string;
    title?: string;
    /** Pixel box the flag renders in. Defaults to the 16×16 square every existing caller relies on. */
    width?: number;
    height?: number;
}) {
    const entry: UiLanguage | undefined = languageByKey(lang) ?? languageByLabel(lang);
    if (!entry) return null;

    return (
        <img
            src={entry.flag}
            alt={title ?? ''}
            aria-hidden={title ? undefined : true}
            width={width}
            height={height}
            style={{ width, height }}
            className={cn('inline-block shrink-0 rounded-[3px] object-cover', className)}
        />
    );
}
