import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { relevantSettings } from '../params';
import type { Session } from '../session';
import { PreselectedWordList } from './PreselectedWords';

/**
 * The settings a session was made with (Part C §C.5), collapsed by default.
 * Settings that did nothing for this session (e.g. typing strictness for a
 * choice-only session) are left out. Pre-selected words are listed too.
 */
export function ParametersSummary({ session }: { session: Session }) {
    const { t } = useTranslation();
    const nativeLanguage = useAuthStore((s) => s.user?.nativeLanguage ?? null);
    const [open, setOpen] = useState(false);
    const { params, preselected } = session;
    const relevant = relevantSettings(params, nativeLanguage);

    const rows: [label: string, value: string][] = [
        [
            t('practice:setup.labels.languages'),
            params.languages.map((label) => languageByLabel(label)?.native ?? label).join(', '),
        ],
        [
            t('practice:setup.labels.partsOfSpeech'),
            params.partsOfSpeech.map((pos) => t(partOfSpeechLabelKey(pos))).join(', '),
        ],
        [t('practice:setup.labels.amount'), String(params.amount)],
        [t('practice:setup.labels.answerStyle'), t(`practice:setup.options.type.${params.type}`)],
        [t('practice:setup.labels.languagesPerExercise'), t(`practice:setup.options.mode.${params.multiLang}`)],
        [t('practice:setup.labels.wordOrder'), t(`practice:setup.options.order.${params.wordSelection}`)],
    ];
    if (relevant.mcDifficulty) {
        rows.push([t('practice:setup.labels.mcDifficulty'), t(`practice:setup.levels.mc.${params.difficultyMC}`)]);
    }
    if (relevant.tiStrictness) {
        rows.push([t('practice:setup.labels.tiStrictness'), t(`practice:setup.levels.ti.${params.strictnessTI}`)]);
    }
    if (relevant.nativeLanguage) {
        rows.push([
            t('practice:setup.labels.nativeLanguage'),
            t(`practice:setup.options.native.${params.excludeNative ? 'exclude' : 'include'}`),
        ]);
    }

    return (
        <section className="card card-pad flex flex-col gap-3" aria-label={t('practice:results.settings')}>
            <div className="flex flex-wrap items-center gap-2">
                <b className="grow">{t('practice:results.settings')}</b>
                <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                    {open ? t('practice:results.hideSettings') : t('practice:results.showSettings')}
                </Button>
            </div>
            {open && (
                <>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                        {rows.map(([label, value]) => (
                            <div key={label} className="contents">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="break-words">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {preselected && (
                        <div className="flex flex-col gap-2">
                            <b className="text-sm">
                                {t('practice:results.words')} ({preselected.length})
                            </b>
                            <PreselectedWordList words={preselected} />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
