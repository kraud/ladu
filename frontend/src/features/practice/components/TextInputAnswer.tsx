import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * The typing control. One try: after the answer the field is read-only and shows
 * what the user typed. No browser autocorrect, autocapitalise or spellcheck — they
 * would change the answer. An empty answer cannot be sent.
 */
export function TextInputAnswer({
    pronoun,
    given,
    onSubmit,
}: {
    /** The personal pronoun of a verb form, shown next to the field. */
    pronoun?: string;
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
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) onSubmit(typed);
            }}
        >
            {pronoun && (
                <span className="text-base font-semibold text-muted-foreground" data-testid="answer-pronoun">
                    {pronoun}
                </span>
            )}
            <Input
                ref={inputRef}
                aria-label={t('practice:card.answerLabel')}
                placeholder={t('practice:card.answerPlaceholder')}
                value={value}
                readOnly={answered}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="sm:max-w-sm"
                onChange={(event) => setTyped(event.target.value)}
            />
            {!answered && (
                <Button type="submit" disabled={!canSubmit}>
                    {t('practice:session.check')}
                </Button>
            )}
        </form>
    );
}
