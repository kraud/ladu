import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { caseLabel, describeCase, pronounFor } from '@/lib/cases';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import { evaluateChoice, evaluateTextInput } from '../evaluate';
import type { GivenAnswer } from '../session';
import type { AnswerResult, Exercise, StrictnessTI } from '../types';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceAnswer } from './ChoiceAnswer';
import { PerformanceIndicator } from './PerformanceIndicator';
import { TextInputAnswer } from './TextInputAnswer';

const languageName = (label: string) => languageByLabel(label)?.native ?? label;

/** What a same-language drill asks the user to type ("Type the participle…"); the default text when it has none. */
function placeholderFor(t: TFunction, category: string): string | undefined {
    return t(`practice:card.placeholder.${category}`, { defaultValue: '' }) || undefined;
}

/**
 * One exercise (Part C §C.4): the prompt, the task, the answer control and the
 * feedback. It is keyed by exercise in the parent, so its state is per card.
 * An answered card shows the stored answer read-only.
 */
export function ExerciseCard({
    exercise,
    answer,
    strictness,
    onAnswer,
    onRetry,
}: {
    exercise: Exercise;
    answer: GivenAnswer | null;
    strictness: StrictnessTI;
    onAnswer: (result: AnswerResult, given: string) => void;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const { prompt, answer: expected, partOfSpeech } = exercise;

    const promptPronoun = pronounFor(partOfSpeech, prompt.caseName);
    const answerPronoun = pronounFor(partOfSpeech, expected.caseName);

    // A same-language drill asks about a property ("Gender…"); the other cards ask for the same form elsewhere.
    const target = describeCase(partOfSpeech, expected.caseName);
    const question =
        !exercise.multiLang && target?.kind === 'property'
            ? t(`practice:card.task.${target.category}`, { defaultValue: caseLabel(t, partOfSpeech, expected.caseName) })
            : null;

    return (
        <article className="card card-pad flex flex-col gap-5" aria-label={t(partOfSpeechLabelKey(partOfSpeech))}>
            <section className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FlagIcon lang={prompt.language} />
                    {languageName(prompt.language)}
                    <span aria-hidden>·</span>
                    {t(partOfSpeechLabelKey(partOfSpeech))}
                    <span aria-hidden>·</span>
                    {caseLabel(t, partOfSpeech, prompt.caseName)}
                </span>
                <p className="text-2xl font-semibold break-words" data-testid="prompt">
                    {promptPronoun && <span className="mr-2 text-muted-foreground">{promptPronoun}</span>}
                    {prompt.value}
                </p>
            </section>

            <section className="flex flex-col gap-3">
                {question ? (
                    <span className="text-sm font-medium">{question}</span>
                ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FlagIcon lang={expected.language} />
                        {languageName(expected.language)}
                        <span aria-hidden>·</span>
                        {t(partOfSpeechLabelKey(partOfSpeech))}
                        <span aria-hidden>·</span>
                        {caseLabel(t, partOfSpeech, expected.caseName)}
                    </span>
                )}

                {exercise.type === 'Multiple-Choice' && exercise.options ? (
                    <ChoiceAnswer
                        options={exercise.options}
                        expected={expected.value}
                        given={answer?.given}
                        onChoose={(option) => onAnswer(evaluateChoice(option, expected.value), option)}
                    />
                ) : (
                    <TextInputAnswer
                        pronoun={answerPronoun}
                        placeholder={target?.kind === 'property' ? placeholderFor(t, target.category) : undefined}
                        given={answer?.given}
                        onSubmit={(typed) => onAnswer(evaluateTextInput(typed, expected.value, strictness), typed)}
                    />
                )}
            </section>

            <AnswerFeedback answer={answer} expected={expected.value} isTyped={exercise.type === 'Text-Input'} />

            <section className="border-t border-dashed border-border pt-3">
                <PerformanceIndicator exercise={exercise} answer={answer} onRetry={onRetry} />
            </section>
        </article>
    );
}
