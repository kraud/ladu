import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * The typing control. One try: after the answer the field is read-only and shows
 * what the user typed. No browser autocorrect, autocapitalise or spellcheck — they
 * would change the answer. An empty answer cannot be sent.
 *
 * A verb's personal pronoun is a fixed prefix inside the field: it is not part of
 * the typed value and cannot be edited.
 */
export function TextInputAnswer({
    pronoun,
    placeholder,
    given,
    onSubmit,
}: {
    /** The personal pronoun of a verb form, shown as a prefix inside the field. */
    pronoun?: string;
    /** Hint text for a field without a pronoun (a drill says what to type). */
    placeholder?: string;
    /** The stored answer of an answered card; `undefined` while it is open. */
    given?: string;
    onSubmit: (typed: string) => void;
}) {
    const { t } = useTranslation();
    const answered = given !== undefined;
    const [typed, setTyped] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // The card is re-mounted per exercise, so this runs once for each new card.
    useEffect(() => {
        if (!answered) inputRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = answered ? given : typed;
    const canSubmit = !answered && typed.trim() !== '';

    return (
        <form
            noValidate
            className="flex items-stretch gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) onSubmit(typed);
            }}
        >
            <div className="flex min-w-0 grow items-center rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-(--accent-soft)">
                {pronoun && (
                    <span
                        className="pr-1 pl-[11px] font-mono text-[13.5px] font-bold text-muted-foreground select-none"
                        data-testid="answer-pronoun"
                    >
                        {pronoun}
                    </span>
                )}
                <Input
                    ref={inputRef}
                    aria-label={t('practice:card.answerLabel')}
                    placeholder={pronoun ? t('practice:card.answerPlaceholderPronoun') : (placeholder ?? t('practice:card.answerPlaceholder'))}
                    value={value}
                    readOnly={answered}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={`border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent ${pronoun ? 'pl-1' : ''}`}
                    onChange={(event) => setTyped(event.target.value)}
                />
            </div>
            {!answered && (
                <Button type="submit" disabled={!canSubmit}>
                    {t('practice:session.check')}
                </Button>
            )}
        </form>
    );
}
