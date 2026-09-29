import { WarningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { GivenAnswer } from '../session';

/**
 * The state of the background save of this card's answer: "Saving…", "Saved", or
 * "Not saved" with a retry. Nothing blocks while it runs (Part C §C.4).
 */
export function SaveStatus({
    answer,
    onRetry,
    className,
}: {
    answer: GivenAnswer | null;
    onRetry: () => void;
    className?: string;
}) {
    const { t } = useTranslation();
    if (!answer) return null;

    return (
        <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground', className)}>
            {answer.saveStatus === 'saving' && t('practice:save.saving')}
            {answer.saveStatus === 'saved' && t('practice:save.saved')}
            {answer.saveStatus === 'unsaved' && (
                <>
                    <WarningIcon aria-hidden weight="bold" size={13} className="text-(--danger)" />
                    <span className="font-semibold text-(--danger)">{t('practice:save.notSaved')}</span>
                    <button
                        type="button"
                        className="font-semibold text-foreground underline underline-offset-2"
                        onClick={onRetry}
                    >
                        {t('practice:save.retry')}
                    </button>
                </>
            )}
        </span>
    );
}
