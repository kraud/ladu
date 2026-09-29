import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { languageByLabel } from '@/lib/language';
import { useSetModifier } from '../hooks';
import type { GivenAnswer } from '../session';
import { usePracticeSessionStore } from '../sessionStore';
import type { Exercise, Modifier } from '../types';

type Pending = { target: Modifier | null; kind: 'master' | 'revise' | 'remove' };

/**
 * Master / Revise for the whole translation (Part C §C.4 item 5). Enabled only
 * once this answer is saved: the save creates the performance row (C7), and a
 * finished save cannot overwrite the new status afterwards. Pressing the active
 * status removes it; the other one switches. Every change asks first, and a
 * failed change keeps the old status and says so.
 */
export function ModifierActions({ exercise, answer }: { exercise: Exercise; answer: GivenAnswer | null }) {
    const { t } = useTranslation();
    const dispatch = usePracticeSessionStore((s) => s.dispatch);
    const setModifier = useSetModifier();
    const [pending, setPending] = useState<Pending | null>(null);

    const current = exercise.performance?.modifier ?? null;
    const ready = answer?.saveStatus === 'saved';
    const language = languageByLabel(exercise.answer.language)?.native ?? exercise.answer.language;

    function ask(action: 'master' | 'revise') {
        const status: Modifier = action === 'master' ? 'Mastered' : 'Revise';
        setModifier.reset();
        setPending(current === status ? { target: null, kind: 'remove' } : { target: status, kind: action });
    }

    function confirm() {
        if (!pending) return;
        // The store applies the answer, so a card change while the request runs cannot lose it.
        setModifier
            .mutateAsync({ translationId: exercise.translationId, modifier: pending.target })
            .then((performance) => dispatch({ type: 'performanceChanged', performance }))
            .catch(() => undefined); // shown through `setModifier.isError`
        setPending(null);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!ready || setModifier.isPending}
                    aria-pressed={current === 'Mastered'}
                    onClick={() => ask('master')}
                >
                    {t('practice:actions.master')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!ready || setModifier.isPending}
                    aria-pressed={current === 'Revise'}
                    onClick={() => ask('revise')}
                >
                    {t('practice:actions.revise')}
                </Button>
            </div>
            <p className="hint">
                {ready
                    ? `${t('practice:actions.masterHint')} ${t('practice:actions.reviseHint')}`
                    : t('practice:actions.answerFirst')}{' '}
                {t('practice:actions.wholeTranslation', { language })}
            </p>
            {setModifier.isError && (
                <p className="err show" role="alert">
                    {t('practice:dialogs.failed')}
                </p>
            )}
            {pending && (
                <ConfirmDialog
                    open
                    onOpenChange={(open) => !open && setPending(null)}
                    title={t(`practice:dialogs.${pending.kind}.title`)}
                    description={t(`practice:dialogs.${pending.kind}.body`)}
                    confirmLabel={t(`practice:dialogs.${pending.kind}.confirm`)}
                    cancelLabel={t('practice:dialogs.cancel')}
                    destructive={false}
                    onConfirm={confirm}
                />
            )}
        </div>
    );
}
