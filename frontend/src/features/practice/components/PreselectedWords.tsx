import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FlagIcon } from '@/components/common/FlagIcon';
import { partOfSpeechLabelKey } from '@/lib/words';
import type { PreselectedWord } from '../preselection';

/** The words a Review selection brought along: count, a collapsible list, and a way to drop them. */
export function PreselectedWords({
    words,
    onClear,
}: {
    words: PreselectedWord[];
    onClear: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const title = t('practice:setup.preselected.title', { count: words.length });

    return (
        <section className="card card-pad flex flex-col gap-2" aria-label={title}>
            <div className="flex flex-wrap items-center gap-2">
                <b className="grow">{title}</b>
                <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                    {open ? t('practice:setup.preselected.hide') : t('practice:setup.preselected.show')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onClear}>
                    {t('practice:setup.preselected.clear')}
                </Button>
            </div>
            {open && (
                <ul className="flex flex-col gap-1">
                    {words.map((word) => (
                        <li key={word.id} className="flex min-w-0 items-center gap-2 text-sm">
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
            )}
            <p className="hint">{t('practice:setup.preselected.limitedTypes')}</p>
        </section>
    );
}
