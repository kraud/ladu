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
}: {
    lang: string;
    className?: string;
    title?: string;
}) {
    const entry: UiLanguage | undefined = languageByKey(lang) ?? languageByLabel(lang);
    if (!entry) return null;

    return (
        <img
            src={entry.flag}
            alt={title ?? ''}
            aria-hidden={title ? undefined : true}
            width={16}
            height={16}
            className={cn('inline-block h-4 w-4 rounded-[3px] object-cover', className)}
        />
    );
}
