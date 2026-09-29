import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FlagIcon } from '@/components/common/FlagIcon';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { PreselectedWord } from '../preselection';

/**
 * The words a hand-off (today: Review's "Practice" action; later: a tag's word
 * list) brought along. The title is source-neutral on purpose. The list is open
 * at first and can be collapsed. Removing the pre-selection asks first, because
 * the words cannot be brought back without going to the source again.
 */
export function PreselectedWords({
    words,
    onClear,
}: {
    words: PreselectedWord[];
    onClear: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const title = t('practice:setup.preselected.title', { count: words.length });

    return (
        <section className="card card-pad flex flex-col gap-2" aria-label={title}>
            <div className="flex flex-wrap items-center gap-2">
                <b className="grow">{title}</b>
                <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                    {open ? t('practice:setup.preselected.hide') : t('practice:setup.preselected.show')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                    {t('practice:setup.preselected.clear')}
                </Button>
            </div>
            <p className="hint">{t('practice:setup.preselected.note')}</p>
            {open && <PreselectedWordList words={words} />}
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
        </section>
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
