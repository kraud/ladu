import { useState } from 'react';
import { EyeClosedIcon, EyeIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { cn } from '@/lib/utils';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { PreselectedWord } from '../preselection';
import type { PracticeParams } from '../types';
import { describeWords } from '../wordFilter';

/** `visible`: every word, the unused ones marked. `hidden`: only what the settings would use. */
export type WordsMode = 'visible' | 'hidden';

/** The eye button: eye = every word shown (unused ones marked), eye closed = the unused ones left out. */
export function WordsModeToggle({ mode, onModeChange }: { mode: WordsMode; onModeChange: (next: WordsMode) => void }) {
    const { t } = useTranslation();
    const label = t(mode === 'visible' ? 'practice:setup.preselected.hideUnused' : 'practice:setup.preselected.showAll');
    return (
        <button
            type="button"
            className="icon-btn"
            aria-label={label}
            title={label}
            onClick={() => onModeChange(mode === 'visible' ? 'hidden' : 'visible')}
        >
            {mode === 'visible' ? <EyeIcon size={16} /> : <EyeClosedIcon size={16} />}
        </button>
    );
}

/**
 * The words a hand-off (today: Review's "Practice" action; later: a tag's word
 * list) brought along: the content of the practice sidebar, on the set-up and on
 * the results page. The title is source-neutral on purpose. The list follows the
 * settings (`params`): the eye button chooses between showing the unused words
 * marked (eye) or leaving them out (eye closed). The sidebar itself collapses, so
 * the list has no hide button of its own. `onClear` is only given on the set-up:
 * removing the pre-selection asks first, because the words cannot be brought back
 * without going to the source again.
 */
export function PreselectedWords({
    words,
    params,
    mode,
    onModeChange,
    onClear,
}: {
    words: PreselectedWord[];
    params: Pick<PracticeParams, 'languages' | 'partsOfSpeech'>;
    mode: WordsMode;
    onModeChange: (next: WordsMode) => void;
    onClear?: () => void;
}) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const title = t('practice:setup.preselected.title', { count: words.length });
    const used = describeWords(words, params).filter((item) => item.included).length;

    return (
        <div className="flex flex-col gap-2" aria-label={title} role="group">
            <div className="flex flex-wrap items-center gap-2">
                <b className="grow">{title}</b>
                <WordsModeToggle mode={mode} onModeChange={onModeChange} />
                {onClear && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                        {t('practice:setup.preselected.clear')}
                    </Button>
                )}
            </div>
            <p className="hint">{t('practice:setup.preselected.used', { used, total: words.length })}</p>
            {onClear && <p className="hint">{t('practice:setup.preselected.note')}</p>}
            <PreselectedWordList words={words} params={params} mode={mode} />
            {onClear && (
                <ConfirmDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    title={t('practice:setup.preselected.confirm.title')}
                    description={t('practice:setup.preselected.confirm.body')}
                    confirmLabel={t('practice:setup.preselected.confirm.confirm')}
                    cancelLabel={t('practice:setup.preselected.confirm.cancel')}
                    destructive={false}
                    onConfirm={onClear}
                />
            )}
        </div>
    );
}

/**
 * Flags | word | word type, as three fixed columns: the words start at one point and the
 * types sit at the right edge, whatever the number of flags. With `params`, the list shows
 * what the settings would use (see `describeWords`); without, every word as it is.
 */
export function PreselectedWordList({
    words,
    params,
    mode = 'visible',
}: {
    words: PreselectedWord[];
    params?: Pick<PracticeParams, 'languages' | 'partsOfSpeech'>;
    mode?: WordsMode;
}) {
    const { t } = useTranslation();
    const described = params
        ? describeWords(words, params)
        : words.map((word) => ({ word, included: true, activeLanguages: word.languages }));
    const shown = mode === 'hidden' ? described.filter((item) => item.included) : described;

    if (shown.length === 0) return <p className="hint">{t('practice:setup.preselected.noneUsed')}</p>;

    return (
        <ul className="flex flex-col">
            {shown.map(({ word, included, activeLanguages }) => (
                <li
                    key={word.id}
                    data-used={included}
                    className={cn(
                        'grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border py-1.5 text-sm last:border-b-0',
                        !included && 'text-muted-foreground line-through',
                    )}
                >
                    {/* Hidden mode leaves out the unselected languages; visible mode grays them. */}
                    <span className="flex gap-1">
                        {(mode === 'hidden' ? activeLanguages : word.languages).map((key) => (
                            <FlagIcon key={key} lang={key} muted={!included || !activeLanguages.includes(key)} />
                        ))}
                    </span>
                    <span className="min-w-0 break-words font-medium">{word.label}</span>
                    <span className="meta text-right">{t(partOfSpeechLabelKey(word.partOfSpeech))}</span>
                </li>
            ))}
        </ul>
    );
}
