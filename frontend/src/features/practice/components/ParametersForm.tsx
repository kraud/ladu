import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import {
    BookmarkSimpleIcon,
    CaretDownIcon,
    FunnelIcon,
    ListBulletsIcon,
    PencilSimpleLineIcon,
    PlayIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/lib/useMediaQuery';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { SessionUser } from '@/stores/authStore';
import type { PartOfSpeech } from '@/ts/enums';
import { useGenerateExercises } from '../hooks';
import { practiceErrorKey } from '../errors';
import {
    knownLanguages,
    PARTS_OF_SPEECH_WITH_EXERCISES,
    relevantSettings,
    SELECTABLE_PARTS_OF_SPEECH,
    toGenerateBody,
    validateParams,
} from '../params';
import { narrowToPickable } from '../configs';
import { rememberParams } from '../remembered';
import { usePracticeSessionStore } from '../sessionStore';
import type { PreselectedWord } from '../preselection';
import type { ConfigDraft } from './SaveConfigDialog';
import type {
    CardTypeParam,
    DifficultyMC,
    LanguageMode,
    PracticeParams,
    StrictnessTI,
    WordSelection,
} from '../types';
import { ChipGroup } from './ChipGroup';
import { NoMatchNotice } from './NoMatchNotice';
import { OptionRow } from './OptionRow';

const CARD_TYPES: CardTypeParam[] = ['Text-Input', 'Multiple-Choice', 'Random'];
const LANGUAGE_MODES: LanguageMode[] = ['Multi-Language', 'Single-Language', 'Random'];
const WORD_SELECTIONS: WordSelection[] = ['Exercise-Performance', 'Random'];
const MC_LEVELS: DifficultyMC[] = [0, 1, 2, 3];
const TI_LEVELS: StrictnessTI[] = [1, 2, 3];

/**
 * Stage 1 of practice (Part C §C.3): every setting, the validation, and Start.
 * It owns the working copy of the settings; each change is also reported up so
 * the page can mirror it into the URL (C5). The typed amount is kept as text,
 * so an empty or fractional value can be shown as an error and never reaches
 * the URL.
 *
 * Layout follows `mockups/practice.html`: one card of rows, the Advanced block
 * as its last row, then the banners and the Start row below the card.
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
    onSaveConfig,
    startBlockedReason,
    tagIds,
    actionsHost,
}: {
    user: SessionUser;
    initialParams: PracticeParams;
    preselected: PreselectedWord[] | null;
    onParamsChange: (params: PracticeParams) => void;
    /** After the session was stored: the page stops showing the set-up. */
    onStarted: () => void;
    /** "Save configuration": the page opens the save dialog (outside this form) for these settings and words. */
    onSaveConfig: (draft: ConfigDraft) => void;
    /** Why Start and Save cannot be used now (the words of the chosen tags are loading, or there are none). */
    startBlockedReason?: string;
    /** The tags the pre-selected words were chosen by, saved with a configuration. */
    tagIds?: string[] | null;
    /**
     * Where the Start / Save buttons go. Absent: inline under the form. An element: a portal into it
     * (the page's fixed bottom bar). `null`: nowhere yet (the bar is not on screen).
     */
    actionsHost?: HTMLElement | null;
}) {
    const { t } = useTranslation();
    const generate = useGenerateExercises();
    const startSession = usePracticeSessionStore((s) => s.start);
    const languagesRow = useRef<HTMLDivElement>(null);
    const formId = useId();
    const isMobile = useIsMobile();

    const [chosen, setParams] = useState(initialParams);
    // The word types follow the pre-selected words as they change (tags added or removed): a type
    // none of the words has cannot stay selected. `chosen` keeps the user's own pick for when it fits again.
    const params = narrowToPickable(chosen, preselected);
    const [amountText, setAmountText] = useState(String(initialParams.amount));
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [noMatch, setNoMatch] = useState(false);

    const accountLanguages = knownLanguages(user.languages);
    const canMixLanguages = accountLanguages.length >= 2;
    // A word type can be picked when it has exercises today and (with a pre-selection) one of the words has it.
    const pickablePos = SELECTABLE_PARTS_OF_SPEECH.filter(
        (pos) =>
            PARTS_OF_SPEECH_WITH_EXERCISES.includes(pos) &&
            (!preselected || preselected.some((word) => word.partOfSpeech === pos)),
    );
    const nothingToPick = pickablePos.length === 0;

    const amount = amountText.trim() === '' ? Number.NaN : Number(amountText);
    const errors = validateParams({ ...params, amount });
    const valid = Object.keys(errors).length === 0;
    const relevant = relevantSettings(params, user.nativeLanguage);
    const nativeName = user.nativeLanguage
        ? (languageByLabel(user.nativeLanguage)?.native ?? user.nativeLanguage)
        : '';

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
        if (!valid || generate.isPending || startBlockedReason) return;
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

    function adjustSettings() {
        setNoMatch(false);
        setShowAdvanced(true);
        languagesRow.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }

    const modeHint = !canMixLanguages
        ? t('practice:setup.hints.singleLanguageAccount')
        : params.multiLang === 'Multi-Language'
          ? t('practice:setup.hints.modeDifferent')
          : params.multiLang === 'Single-Language'
            ? t('practice:setup.hints.modeSame')
            : t('practice:setup.hints.modeMixed');

    // Start and Save. In the page they sit in a bar fixed to the bottom of the window (`actionsHost`, the
    // layout's footer slot), so they are always in reach; the form is the `form=` of the submit button.
    // On a phone the bar stays one row: small buttons, short labels, the hint above them.
    const hint = startBlockedReason ?? (!valid ? t('practice:setup.fixToStart') : null);
    const actionButtons = (
        <>
            {hint && <span className={isMobile ? 'hint basis-full' : 'hint mr-auto'}>{hint}</span>}
            <div className="flex flex-nowrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size={isMobile ? 'sm' : 'default'}
                    disabled={!valid || !!startBlockedReason}
                    onClick={() =>
                        onSaveConfig({
                            params: { ...params, amount },
                            wordIds: preselected?.map((word) => word.id) ?? null,
                            tagIds: tagIds ?? null,
                        })
                    }
                >
                    <BookmarkSimpleIcon aria-hidden size={14} />
                    {t(isMobile ? 'practice:configs.saveShort' : 'practice:configs.save')}
                </Button>
                <Button
                    type="submit"
                    form={formId}
                    size={isMobile ? 'sm' : 'default'}
                    className={isMobile ? undefined : 'min-w-37.5'}
                    disabled={!valid || generate.isPending || !!startBlockedReason}
                >
                    {generate.isPending ? (
                        <>
                            <span className="spinner" />
                            {t(isMobile ? 'practice:setup.startingShort' : 'practice:setup.starting')}
                        </>
                    ) : (
                        <>
                            <PlayIcon aria-hidden weight="fill" size={14} />
                            {t(isMobile ? 'practice:setup.startShort' : 'practice:setup.start')}
                        </>
                    )}
                </Button>
            </div>
        </>
    );

    return (
        <form
            id={formId}
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                start();
            }}
        >
            <div className="card flex flex-col px-4.5 py-4">
                <Row
                    rowRef={languagesRow}
                    label={t('practice:setup.labels.languages')}
                    hint={
                        params.languages.length === accountLanguages.length
                            ? t('practice:setup.hints.languagesAll')
                            : t('practice:setup.hints.languagesCount', {
                                  count: params.languages.length,
                                  total: accountLanguages.length,
                              })
                    }
                    error={errors.languages}
                >
                    <div role="group" aria-label={t('practice:setup.labels.languages')} className="flex flex-wrap gap-1.5">
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
                </Row>

                <Row
                    label={t('practice:setup.labels.partsOfSpeech')}
                    hint={
                        preselected && nothingToPick
                            ? t('practice:setup.hints.preselectedNoExercises')
                            : preselected
                              ? t('practice:setup.hints.posPreselected')
                              : t('practice:setup.hints.noExercisesYet')
                    }
                    error={errors.partsOfSpeech}
                >
                    <div
                        role="group"
                        aria-label={t('practice:setup.labels.partsOfSpeech')}
                        className="flex flex-wrap gap-1.5"
                    >
                        {SELECTABLE_PARTS_OF_SPEECH.map((pos) => {
                            const pickable = pickablePos.includes(pos);
                            return (
                                <span key={pos} title={pickable ? undefined : disabledReason(pos, t)}>
                                    <button
                                        type="button"
                                        className="chip disabled:cursor-not-allowed disabled:opacity-45"
                                        aria-pressed={params.partsOfSpeech.includes(pos)}
                                        disabled={!pickable}
                                        onClick={() => change({ partsOfSpeech: toggle(params.partsOfSpeech, pos) })}
                                    >
                                        {t(partOfSpeechLabelKey(pos))}
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                </Row>

                <Row
                    label={t('practice:setup.labels.amount')}
                    htmlFor="practice-amount"
                    hint={t('practice:setup.hints.amountRange')}
                    error={errors.amount}
                >
                    <Input
                        id="practice-amount"
                        type="number"
                        min={1}
                        max={100}
                        step={1}
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
                </Row>

                <Row label={t('practice:setup.labels.answerStyle')}>
                    <ChipGroup
                        label={t('practice:setup.labels.answerStyle')}
                        value={params.type}
                        onChange={(type) => change({ type })}
                        options={CARD_TYPES.map((value) => ({ value, label: t(`practice:setup.options.type.${value}`) }))}
                    />
                </Row>

                <Row label={t('practice:setup.labels.languagesPerExercise')}>
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
                    <p className="hint">{modeHint}</p>
                </Row>

                <Row>
                    <div className="w-full overflow-hidden rounded-(--radius) border border-border">
                        <button
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2 bg-(--bg) px-3.5 py-2.5 text-left text-[13.5px] font-semibold"
                            aria-expanded={showAdvanced}
                            onClick={() => setShowAdvanced((open) => !open)}
                        >
                            {t('practice:setup.advanced.title')}
                            <CaretDownIcon
                                aria-hidden
                                size={14}
                                className={`text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {showAdvanced && (
                            <div className="px-3.5 pb-1.5">
                                <OptionRow
                                    label={t('practice:setup.labels.mcDifficulty')}
                                    icon={ListBulletsIcon}
                                    hint={
                                        params.type !== 'Text-Input' && !relevant.mcDifficulty
                                            ? t('practice:setup.hints.mcNeedsDifferent')
                                            : t('practice:setup.hints.mcNeedsChoices')
                                    }
                                    value={params.difficultyMC}
                                    disabled={!relevant.mcDifficulty}
                                    onChange={(difficultyMC) => change({ difficultyMC })}
                                    options={MC_LEVELS.map((value) => ({
                                        value,
                                        label: t('practice:setup.levels.label', { level: value }),
                                        description: t(`practice:setup.levels.mc.${value}`),
                                    }))}
                                />
                                <OptionRow
                                    label={t('practice:setup.labels.tiStrictness')}
                                    icon={PencilSimpleLineIcon}
                                    hint={t('practice:setup.hints.tiNeedsTyping')}
                                    value={params.strictnessTI}
                                    disabled={!relevant.tiStrictness}
                                    onChange={(strictnessTI) => change({ strictnessTI })}
                                    options={TI_LEVELS.map((value) => ({
                                        value,
                                        label: t('practice:setup.levels.label', { level: value }),
                                        description: t(`practice:setup.levels.ti.${value}`),
                                    }))}
                                />
                                <OptionRow
                                    label={t('practice:setup.labels.wordOrder')}
                                    icon={FunnelIcon}
                                    hint={t('practice:setup.hints.wordOrder')}
                                    value={params.wordSelection}
                                    onChange={(wordSelection) => change({ wordSelection })}
                                    options={WORD_SELECTIONS.map((value) => ({
                                        value,
                                        label: t(`practice:setup.options.order.${value}`),
                                    }))}
                                />
                                {relevant.nativeLanguage && (
                                    <OptionRow
                                        label={t('practice:setup.labels.nativeLanguage')}
                                        hint={t('practice:setup.hints.nativeLanguageNamed', { language: nativeName })}
                                        value={params.excludeNative ? 'exclude' : 'include'}
                                        onChange={(next) => change({ excludeNative: next === 'exclude' })}
                                        options={(['include', 'exclude'] as const).map((value) => ({
                                            value,
                                            label: t(`practice:setup.options.native.${value}`),
                                            description: t(`practice:setup.options.nativeDesc.${value}`, {
                                                language: nativeName,
                                            }),
                                        }))}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </Row>
            </div>

            {noMatch && <NoMatchNotice onAdjust={adjustSettings} />}

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

            {actionsHost === undefined ? (
                <div className="mt-1 flex flex-wrap items-center gap-3">{actionButtons}</div>
            ) : (
                actionsHost &&
                createPortal(
                    // The layout's footer gives this the page's column, so the right edge is the settings card's.
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 py-2.5 sm:py-3">{actionButtons}</div>,
                    actionsHost,
                )
            )}
        </form>
    );
}

/** Why a word-type chip cannot be picked (shown as its tooltip). */
function disabledReason(pos: PartOfSpeech, t: (key: string) => string): string {
    return PARTS_OF_SPEECH_WITH_EXERCISES.includes(pos)
        ? t('practice:setup.hints.notInPreselection')
        : t('practice:setup.hints.noExercisesYet');
}

/**
 * One row of the settings card: a label with an inline hint, the control, and
 * the field error. Rows are separated by a line (mockup `.set-row`).
 */
function Row({
    label,
    hint,
    error,
    htmlFor,
    rowRef,
    children,
}: {
    label?: string;
    hint?: string;
    error?: string;
    htmlFor?: string;
    rowRef?: Ref<HTMLDivElement>;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div
            ref={rowRef}
            className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-1"
        >
            {label && (
                <div className="flex flex-wrap items-baseline gap-2">
                    <label className="label" htmlFor={htmlFor}>
                        {label}
                    </label>
                    {hint && <span className="hint">{hint}</span>}
                </div>
            )}
            {children}
            {error && (
                <p className="err show" role="alert">
                    {t(`practice:setup.validation.${error}`)}
                </p>
            )}
        </div>
    );
}
