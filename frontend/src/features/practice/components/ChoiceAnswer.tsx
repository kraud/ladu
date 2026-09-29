import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** True for an element the user types into: number keys must not pick an option there. */
function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The choosing control (2–3 options). One click, or the number key 1–3, answers.
 * After the answer the chosen option is marked right or wrong and the correct
 * option is marked too — by an icon and hidden text as well as by colour.
 */
export function ChoiceAnswer({
    options,
    expected,
    given,
    onChoose,
}: {
    options: string[];
    expected: string;
    /** The stored answer of an answered card; `undefined` while it is open. */
    given?: string;
    onChoose: (option: string) => void;
}) {
    const { t } = useTranslation();
    const answered = given !== undefined;

    useEffect(() => {
        if (answered) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isEditable(event.target)) return;
            const option = options[Number(event.key) - 1];
            if (option !== undefined) onChoose(option);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [answered, options, onChoose]);

    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

    return (
        <div role="group" aria-label={t('practice:card.chooseAnswer')} className="flex flex-col gap-2">
            {options.map((option, index) => {
                const isChosen = answered && same(option, given);
                const isExpected = same(option, expected);
                const state = !answered ? 'open' : isExpected ? 'right' : isChosen ? 'wrong' : 'idle';
                return (
                    <button
                        key={option}
                        type="button"
                        aria-disabled={answered || undefined}
                        data-state={state}
                        className={cn(
                            'flex min-h-11 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-base break-words transition-colors',
                            !answered && 'hover:border-(--fg-soft2)',
                            state === 'right' && 'border-(--success) bg-(--success-soft)',
                            state === 'wrong' && 'border-(--danger) bg-(--danger-soft)',
                            state === 'idle' && 'opacity-60',
                            answered && 'cursor-default',
                        )}
                        onClick={() => {
                            if (!answered) onChoose(option);
                        }}
                    >
                        <kbd className="rounded border border-border px-1.5 text-xs text-muted-foreground" aria-hidden>
                            {index + 1}
                        </kbd>
                        <span className="grow">{option}</span>
                        {state === 'right' && (
                            <>
                                <span aria-hidden>✓</span>
                                <span className="sr-only">{t('practice:feedback.correct')}</span>
                            </>
                        )}
                        {state === 'wrong' && (
                            <>
                                <span aria-hidden>✕</span>
                                <span className="sr-only">{t('practice:feedback.wrong')}</span>
                            </>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
