import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { SessionUser } from '@/stores/authStore';
import { PartOfSpeech } from '@/ts/enums';
import { useGenerateExercises } from '../hooks';
import { practiceErrorKey } from '../errors';
import {
    knownLanguages,
    onlyPartsWithoutExercises,
    relevantSettings,
    SELECTABLE_PARTS_OF_SPEECH,
    toGenerateBody,
    validateParams,
} from '../params';
import { rememberParams } from '../remembered';
import { usePracticeSessionStore } from '../sessionStore';
import type { PreselectedWord } from '../preselection';
import type {
    CardTypeParam,
    DifficultyMC,
    LanguageMode,
    PracticeParams,
    StrictnessTI,
    WordSelection,
} from '../types';
import { ChipGroup } from './ChipGroup';

const CARD_TYPES: CardTypeParam[] = ['Text-Input', 'Multiple-Choice', 'Random'];
const LANGUAGE_MODES: LanguageMode[] = ['Multi-Language', 'Single-Language', 'Random'];
const WORD_SELECTIONS: WordSelection[] = ['Exercise-Performance', 'Random'];
const MC_LEVELS: DifficultyMC[] = [0, 1, 2, 3];
const TI_LEVELS: StrictnessTI[] = [1, 2, 3];

/**
 * Stage 1 of practice (Part C §C.3): every setting, the validation, and Start.
 * It owns the working copy of the settings; each change is also reported up so
 * the page can mirror it into the URL (C5). The typed amount is kept as text,
 * so an invalid value can be shown and fixed without ever reaching the URL.
 *
 * Start results: exercises -> the session starts (the page swaps to it);
 * none -> an explanation stays here; error -> a message with retry.
 */
export function ParametersForm({
    user,
    initialParams,
    preselected,
    onParamsChange,
    onStarted,
}: {
    user: SessionUser;
    initialParams: PracticeParams;
    preselected: PreselectedWord[] | null;
    onParamsChange: (params: PracticeParams) => void;
    /** After the session was stored: the page stops showing the set-up. */
    onStarted: () => void;
}) {
    const { t } = useTranslation();
    const generate = useGenerateExercises();
    const startSession = usePracticeSessionStore((s) => s.start);

    const [params, setParams] = useState(initialParams);
    const [amountText, setAmountText] = useState(String(initialParams.amount));
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [noMatch, setNoMatch] = useState(false);

    const accountLanguages = knownLanguages(user.languages);
    const canMixLanguages = accountLanguages.length >= 2;
    const availablePos = preselected
        ? SELECTABLE_PARTS_OF_SPEECH.filter((pos) => preselected.some((word) => word.partOfSpeech === pos))
        : SELECTABLE_PARTS_OF_SPEECH;
    // No selectable type among the words: no limit, the run ends in "no exercises".
    const limitedPos = availablePos.length > 0 ? availablePos : SELECTABLE_PARTS_OF_SPEECH;

    const amount = amountText.trim() === '' ? Number.NaN : Number(amountText);
    const errors = validateParams({ ...params, amount });
    const valid = Object.keys(errors).length === 0;
    const relevant = relevantSettings(params, user.nativeLanguage);
    const withoutExercises = params.partsOfSpeech.some((pos) => !PARTS_WITH_EXERCISES.has(pos));

    function change(patch: Partial<PracticeParams>) {
        const next = { ...params, ...patch };
        setParams(next);
        setNoMatch(false);
        generate.reset();
        onParamsChange(next);
    }

    function toggle<T>(list: T[], item: T): T[] {
        return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    }

    function start() {
        if (!valid || generate.isPending) return;
        const settings = { ...params, amount };
        const wordIds = preselected?.map((word) => word.id) ?? null;
        generate.mutate(toGenerateBody(settings, wordIds ?? undefined), {
            onSuccess: ({ exercises }) => {
                if (exercises.length === 0) {
                    setNoMatch(true);
                    return;
                }
                rememberParams(settings);
                startSession({ userId: user.id, params: settings, wordIds, preselected, exercises });
                onStarted();
            },
        });
    }

    return (
        <form
            noValidate
            className="card card-pad flex max-w-2xl flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                start();
            }}
        >
            <Field label={t('practice:setup.labels.languages')} error={errors.languages}>
                <div role="group" aria-label={t('practice:setup.labels.languages')} className="flex flex-wrap gap-2">
                    {accountLanguages.map((label) => (
                        <button
                            key={label}
                            type="button"
                            className="chip"
                            aria-pressed={params.languages.includes(label)}
                            onClick={() => change({ languages: toggle(params.languages, label) })}
                        >
                            <FlagIcon lang={label} />
                            {languageByLabel(label)?.native ?? label}
                        </button>
                    ))}
                </div>
            </Field>

            <Field label={t('practice:setup.labels.partsOfSpeech')} error={errors.partsOfSpeech}>
                <div role="group" aria-label={t('practice:setup.labels.partsOfSpeech')} className="flex flex-wrap gap-2">
                    {SELECTABLE_PARTS_OF_SPEECH.map((pos) => (
                        <button
                            key={pos}
                            type="button"
                            className="chip disabled:cursor-not-allowed disabled:opacity-45"
                            aria-pressed={params.partsOfSpeech.includes(pos)}
                            disabled={!limitedPos.includes(pos)}
                            onClick={() => change({ partsOfSpeech: toggle(params.partsOfSpeech, pos) })}
                        >
                            {t(partOfSpeechLabelKey(pos))}
                        </button>
                    ))}
                </div>
                {withoutExercises && <p className="hint">{t('practice:setup.hints.noExercisesYet')}</p>}
            </Field>

            <Field label={t('practice:setup.labels.amount')} error={errors.amount} htmlFor="practice-amount">
                <Input
                    id="practice-amount"
                    className="w-28"
                    inputMode="numeric"
                    autoComplete="off"
                    value={amountText}
                    aria-invalid={errors.amount ? true : undefined}
                    onChange={(event) => {
                        setAmountText(event.target.value);
                        const text = event.target.value.trim();
                        change({ amount: text === '' ? Number.NaN : Number(text) });
                    }}
                />
            </Field>

            <Field label={t('practice:setup.labels.answerStyle')}>
                <ChipGroup
                    label={t('practice:setup.labels.answerStyle')}
                    value={params.type}
                    onChange={(type) => change({ type })}
                    options={CARD_TYPES.map((value) => ({ value, label: t(`practice:setup.options.type.${value}`) }))}
                />
            </Field>

            <Field label={t('practice:setup.labels.languagesPerExercise')}>
                <ChipGroup
                    label={t('practice:setup.labels.languagesPerExercise')}
                    value={params.multiLang}
                    onChange={(multiLang) => change({ multiLang })}
                    options={LANGUAGE_MODES.map((value) => ({
                        value,
                        label: t(`practice:setup.options.mode.${value}`),
                        disabled: value === 'Multi-Language' && !canMixLanguages,
                    }))}
                />
                <p className="hint">
                    {!canMixLanguages
                        ? t('practice:setup.hints.singleLanguageAccount')
                        : params.multiLang === 'Multi-Language'
                          ? t('practice:setup.hints.modeDifferent')
                          : params.multiLang === 'Single-Language'
                            ? t('practice:setup.hints.modeSame')
                            : null}
                </p>
            </Field>

            <div>
                <button
                    type="button"
                    className="text-sm font-semibold underline underline-offset-2"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((open) => !open)}
                >
                    {showAdvanced ? t('practice:setup.advanced.hide') : t('practice:setup.advanced.show')}
                </button>
            </div>

            {showAdvanced && (
                <div className="flex flex-col gap-5">
                    <Field label={t('practice:setup.labels.mcDifficulty')}>
                        <ChipGroup
                            label={t('practice:setup.labels.mcDifficulty')}
                            value={params.difficultyMC}
                            disabled={!relevant.mcDifficulty}
                            onChange={(difficultyMC) => change({ difficultyMC })}
                            options={MC_LEVELS.map((value) => ({ value, label: `L${value}` }))}
                        />
                        <p className="hint">
                            {relevant.mcDifficulty
                                ? t(`practice:setup.levels.mc.${params.difficultyMC}`)
                                : params.type === 'Text-Input'
                                  ? t('practice:setup.hints.mcNeedsChoices')
                                  : t('practice:setup.hints.mcNeedsDifferent')}
                        </p>
                    </Field>

                    <Field label={t('practice:setup.labels.tiStrictness')}>
                        <ChipGroup
                            label={t('practice:setup.labels.tiStrictness')}
                            value={params.strictnessTI}
                            disabled={!relevant.tiStrictness}
                            onChange={(strictnessTI) => change({ strictnessTI })}
                            options={TI_LEVELS.map((value) => ({ value, label: `L${value}` }))}
                        />
                        <p className="hint">
                            {relevant.tiStrictness
                                ? t(`practice:setup.levels.ti.${params.strictnessTI}`)
                                : t('practice:setup.hints.tiNeedsTyping')}
                        </p>
                    </Field>

                    <Field label={t('practice:setup.labels.wordOrder')}>
                        <ChipGroup
                            label={t('practice:setup.labels.wordOrder')}
                            value={params.wordSelection}
                            onChange={(wordSelection) => change({ wordSelection })}
                            options={WORD_SELECTIONS.map((value) => ({
                                value,
                                label: t(`practice:setup.options.order.${value}`),
                            }))}
                        />
                        <p className="hint">{t('practice:setup.hints.wordOrder')}</p>
                    </Field>

                    {relevant.nativeLanguage && (
                        <Field label={t('practice:setup.labels.nativeLanguage')}>
                            <ChipGroup
                                label={t('practice:setup.labels.nativeLanguage')}
                                value={params.excludeNative ? 'exclude' : 'include'}
                                onChange={(next) => change({ excludeNative: next === 'exclude' })}
                                options={(['include', 'exclude'] as const).map((value) => ({
                                    value,
                                    label: t(`practice:setup.options.native.${value}`),
                                }))}
                            />
                            <p className="hint">{t('practice:setup.hints.nativeLanguage')}</p>
                        </Field>
                    )}
                </div>
            )}

            {noMatch && <NoMatch onlyUnsupported={onlyPartsWithoutExercises(params.partsOfSpeech)} />}

            {generate.isError && (
                <div className="banner warning items-start" role="alert">
                    <span className="grow">
                        <b>{t('practice:setup.error.title')}</b>
                        <br />
                        {t(practiceErrorKey(generate.error))}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={start}>
                        {t('practice:setup.error.retry')}
                    </Button>
                </div>
            )}

            <div>
                <Button type="submit" disabled={!valid || generate.isPending}>
                    {generate.isPending ? (
                        <>
                            <span className="spinner" />
                            {t('practice:setup.starting')}
                        </>
                    ) : (
                        t('practice:setup.start')
                    )}
                </Button>
            </div>
        </form>
    );
}

const PARTS_WITH_EXERCISES = new Set<PartOfSpeech>([PartOfSpeech.noun, PartOfSpeech.verb]);

function Field({
    label,
    error,
    htmlFor,
    children,
}: {
    label: string;
    error?: string;
    htmlFor?: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="field">
            <label className="label" htmlFor={htmlFor}>
                {label}
            </label>
            {children}
            {error && (
                <p className="err show" role="alert">
                    {t(`practice:setup.validation.${error}`)}
                </p>
            )}
        </div>
    );
}

function NoMatch({ onlyUnsupported }: { onlyUnsupported: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="banner warning items-start" role="status">
            <div>
                <b>{t('practice:setup.noMatch.title')}</b>
                <br />
                {t('practice:setup.noMatch.body')}
                <ul className="ml-5 list-disc">
                    {onlyUnsupported ? (
                        <li>{t('practice:setup.noMatch.reasonOnlyUnsupported')}</li>
                    ) : (
                        <>
                            <li>{t('practice:setup.noMatch.reasonFewWords')}</li>
                            <li>{t('practice:setup.noMatch.reasonMissingForms')}</li>
                        </>
                    )}
                </ul>
                {t('practice:setup.noMatch.hint')}
            </div>
        </div>
    );
}
