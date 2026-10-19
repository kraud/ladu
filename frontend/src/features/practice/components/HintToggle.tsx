import { LightbulbIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Button } from '@/components/ui/button';
import { languageByLabel } from '@/lib/language';
import type { ExerciseHint } from '../types';

/**
 * The native-language hint button, at the end of the answer-language row. Closed it
 * is an accent text button ("Hint"); open it is plain text ("Hide hint"); without a hint it is disabled ("No hint available").
 */
export function HintButton({ available, open, onToggle }: { available: boolean; open: boolean; onToggle: () => void }) {
    const { t } = useTranslation();
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={available ? open : undefined}
            disabled={!available}
            className={available && !open ? 'text-(--accent-strong)' : 'text-muted-foreground'}
            onClick={onToggle}
            data-testid="hint-button"
        >
            <LightbulbIcon aria-hidden size={16} />
            {t(!available ? 'practice:card.hint.unavailable' : open ? 'practice:card.hint.hide' : 'practice:card.hint.show')}
        </Button>
    );
}

/**
 * The hint row: same layout as the answer-language row, without the description items.
 * An approximate hint (the base form) gets an asterisk and a small note.
 */
export function HintRow({ hint }: { hint: ExerciseHint }) {
    const { t } = useTranslation();
    const language = languageByLabel(hint.language)?.native ?? hint.language;
    return (
        <div className="flex flex-col gap-0.5" data-testid="hint-row">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <FlagIcon lang={hint.language} />
                <span>
                    {language}
                    {hint.approximate && (
                        <span aria-hidden className="ml-0.5 align-super text-xs text-destructive" data-testid="hint-asterisk">
                            *
                        </span>
                    )}
                    :
                </span>
                <b className="font-bold text-foreground">{hint.value}</b>
            </span>
            {hint.approximate && (
                <small className="text-xs text-muted-foreground">* {t('practice:card.hint.approximate')}</small>
            )}
        </div>
    );
}
