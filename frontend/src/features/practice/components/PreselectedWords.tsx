import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { PreselectedWord } from '../preselection';

/**
 * The words a hand-off (today: Review's "Practice" action; later: a tag's word
 * list) brought along: the content of the practice sidebar. The title is
 * source-neutral on purpose. The sidebar itself collapses, so the list has no
 * hide button of its own. Removing the pre-selection asks first, because the
 * words cannot be brought back without going to the source again.
 */
export function PreselectedWords({
    words,
    onClear,
}: {
    words: PreselectedWord[];
    onClear: () => void;
}) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const title = t('practice:setup.preselected.title', { count: words.length });

    return (
        <div className="flex flex-col gap-2" aria-label={title} role="group">
            <div className="flex flex-wrap items-center gap-2">
                <b className="grow">{title}</b>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                    {t('practice:setup.preselected.clear')}
                </Button>
            </div>
            <p className="hint">{t('practice:setup.preselected.note')}</p>
            <PreselectedWordList words={words} />
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
        </div>
    );
}

/** The words with flags, main form and word type — shared by the set-up panel and the results summary. */
export function PreselectedWordList({ words }: { words: PreselectedWord[] }) {
    const { t } = useTranslation();
    return (
        <ul className="flex flex-col">
            {words.map((word) => (
                <li
                    key={word.id}
                    className="flex min-w-0 items-center gap-2.5 border-b border-border py-1.5 text-sm last:border-b-0"
                >
                    <span className="flex shrink-0 gap-1">
                        {word.languages.map((key) => (
                            <FlagIcon key={key} lang={key} />
                        ))}
                    </span>
                    <span className="min-w-0 break-words font-medium">{word.label}</span>
                    <span className="meta shrink-0">{t(partOfSpeechLabelKey(word.partOfSpeech))}</span>
                </li>
            ))}
        </ul>
    );
}
