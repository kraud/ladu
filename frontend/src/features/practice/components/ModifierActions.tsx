import { useState } from 'react';
import { GraduationCapIcon, RepeatIcon } from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { languageByLabel } from '@/lib/language';
import { useSetModifier } from '../hooks';
import type { GivenAnswer } from '../session';
import { usePracticeSessionStore } from '../sessionStore';
import type { Exercise, Modifier } from '../types';

type Kind = 'master' | 'revise' | 'removeMastered' | 'removeRevise';
type Pending = { target: Modifier | null; kind: Kind };

/**
 * Master / Revise for the whole translation (Part C §C.4 item 5). They act on the
 * stored modifier of the answer's translation: every form of the word in that
 * language is ranked as known (Mastered) or as unknown (Revise). The knowledge
 * percentage of each form is not changed.
 *
 * The change is possible only once this answer is saved: the save creates the
 * performance row (C7), and a finished save cannot overwrite the new status
 * afterwards. Every change asks first. A failed change keeps the old status.
 */
export function useModifierChange(exercise: Exercise, answer: GivenAnswer | null) {
    const { t } = useTranslation();
    const dispatch = usePracticeSessionStore((s) => s.dispatch);
    const setModifier = useSetModifier();
    const [pending, setPending] = useState<Pending | null>(null);

    const current = exercise.performance?.modifier ?? null;
    const language = languageByLabel(exercise.answer.language)?.native ?? exercise.answer.language;

    function ask(action: 'master' | 'revise' | 'remove') {
        setModifier.reset();
        if (action === 'remove') {
            if (current) setPending({ target: null, kind: current === 'Mastered' ? 'removeMastered' : 'removeRevise' });
            return;
        }
        const target: Modifier = action === 'master' ? 'Mastered' : 'Revise';
        if (current !== target) setPending({ target, kind: action });
    }

    function confirm() {
        if (!pending) return;
        const { target, kind } = pending;
        // The store applies the answer, so a card change while the request runs cannot lose it.
        setModifier
            .mutateAsync({ translationId: exercise.translationId, modifier: target })
            .then((performance) => {
                dispatch({ type: 'performanceChanged', performance });
                toast.success(t(`practice:actions.toast.${target === null ? 'removed' : kind === 'master' ? 'mastered' : 'revise'}`));
            })
            .catch(() => undefined); // shown through `failed`
        setPending(null);
    }

    return {
        current,
        /** The buttons exist only after an answer, and work once that answer is saved. */
        answered: answer !== null,
        ready: answer?.saveStatus === 'saved' && !setModifier.isPending,
        failed: setModifier.isError,
        language,
        ask,
        dialog: pending && (
            <ConfirmDialog
                open
                onOpenChange={(open) => !open && setPending(null)}
                title={t(`practice:dialogs.${pending.kind}.title`, { language })}
                description={t(`practice:dialogs.${pending.kind}.body`, { language })}
                confirmLabel={t(`practice:dialogs.${pending.kind}.confirm`)}
                cancelLabel={t('practice:dialogs.cancel')}
                destructive={false}
                onConfirm={confirm}
            />
        ),
    };
}

export type ModifierChange = ReturnType<typeof useModifierChange>;

/**
 * The two icon buttons (Mastered: green cap, Revise: orange repeat). They are not
 * in the page before the card is answered. The active status has its own pill
 * with a remove button, so only the button that would change the status shows.
 * The tooltip carries the full text; `aria-disabled` (not `disabled`) keeps it
 * reachable while the save runs.
 */
export function ModifierButtons({ change }: { change: ModifierChange }) {
    const { t } = useTranslation();
    if (!change.answered) return null;

    const buttons = [
        { status: 'Mastered', action: 'master', Icon: GraduationCapIcon, tone: 'text-(--success) hover:bg-(--success-soft)' },
        { status: 'Revise', action: 'revise', Icon: RepeatIcon, tone: 'text-(--warning) hover:bg-(--warning-soft)' },
    ] as const;

    return (
        <>
            {buttons
                .filter((button) => change.current !== button.status)
                .map(({ action, Icon, tone }) => (
                    <Tooltip key={action}>
                        <TooltipTrigger
                            render={
                                <button
                                    type="button"
                                    aria-label={t(`practice:actions.${action}`)}
                                    aria-disabled={!change.ready || undefined}
                                    className={`icon-btn ${tone} aria-disabled:cursor-not-allowed aria-disabled:opacity-45`}
                                    onClick={() => change.ready && change.ask(action)}
                                >
                                    <Icon aria-hidden size={19} />
                                </button>
                            }
                        />
                        <TooltipContent className="max-w-64">
                            {t(`practice:actions.${action}Tip`, { language: change.language })}
                        </TooltipContent>
                    </Tooltip>
                ))}
        </>
    );
}
