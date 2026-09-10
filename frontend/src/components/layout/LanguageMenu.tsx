import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FlagIcon } from '@/components/common/FlagIcon';
import { UI_LANGUAGES, langKeyByLabel } from '@/lib/language';

/**
 * Presentational language dropdown — a flag + 2-letter trigger and the four
 * `UI_LANGUAGES` as items with a check on the active one. Stateless: the
 * container decides what "select" does (persist to the profile on protected
 * routes; only `i18n.changeLanguage` on public ones).
 */
export function LanguageMenu({
    currentLabel,
    onSelect,
    busy = false,
    align = 'end',
}: {
    currentLabel: string;
    onSelect: (label: string) => void;
    busy?: boolean;
    align?: 'start' | 'end';
}) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="icon-btn flex w-auto items-center gap-1.5 px-2 text-[12px] font-semibold"
                aria-label={t('common:header.settings.uiLanguage')}
                disabled={busy}
            >
                {busy ? <span className="spinner" /> : <FlagIcon lang={currentLabel} />}
                {langKeyByLabel(currentLabel) || 'EN'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} sideOffset={8} className="min-w-44">
                {UI_LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                        key={lang.key}
                        onClick={() => onSelect(lang.label)}
                        className="justify-between"
                    >
                        <span className="flex items-center gap-2">
                            <FlagIcon lang={lang.key} />
                            {lang.native}
                        </span>
                        {lang.label === currentLabel && <CheckIcon />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
