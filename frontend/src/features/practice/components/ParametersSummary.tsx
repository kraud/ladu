import { useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { relevantSettings } from '../params';
import type { Session } from '../session';
import { PreselectedWordList } from './PreselectedWords';

/**
 * "Settings used" (Part C §C.5, mockup `details.settings-summary`): a bordered
 * disclosure, closed at first. Settings that did nothing for this session (e.g.
 * typing strictness for a choice-only session) are left out. The exercise count is
 * the number made, with the number asked when it was more. Pre-selected words are listed.
 */
export function ParametersSummary({ session }: { session: Session }) {
    const { t } = useTranslation();
    const nativeLanguage = useAuthStore((s) => s.user?.nativeLanguage ?? null);
    const [open, setOpen] = useState(false);
    const { params, preselected } = session;
    const relevant = relevantSettings(params, nativeLanguage);
    const created = session.exercises.length;
    const level = (n: number, description: string) => `${t('practice:setup.levels.label', { level: n })} — ${description}`;

    const rows: [label: string, value: string][] = [
        [
            t('practice:setup.labels.languages'),
            params.languages.map((label) => languageByLabel(label)?.native ?? label).join(', '),
        ],
        [
            t('practice:setup.labels.partsOfSpeech'),
            params.partsOfSpeech.map((pos) => t(partOfSpeechLabelKey(pos))).join(', '),
        ],
        [
            t('practice:setup.labels.amount'),
            created < session.requested
                ? t('practice:results.amountShort', { created, requested: session.requested })
                : String(created),
        ],
        [t('practice:setup.labels.answerStyle'), t(`practice:setup.options.type.${params.type}`)],
        [t('practice:setup.labels.languagesPerExercise'), t(`practice:setup.options.mode.${params.multiLang}`)],
        [t('practice:setup.labels.wordOrder'), t(`practice:setup.options.order.${params.wordSelection}`)],
    ];
    if (relevant.mcDifficulty) {
        rows.push([
            t('practice:setup.labels.mcDifficulty'),
            level(params.difficultyMC, t(`practice:setup.levels.mc.${params.difficultyMC}`)),
        ]);
    }
    if (relevant.tiStrictness) {
        rows.push([
            t('practice:setup.labels.tiStrictness'),
            level(params.strictnessTI, t(`practice:setup.levels.ti.${params.strictnessTI}`)),
        ]);
    }
    if (relevant.nativeLanguage && nativeLanguage) {
        const choice = params.excludeNative ? 'exclude' : 'include';
        const language = languageByLabel(nativeLanguage)?.native ?? nativeLanguage;
        rows.push([
            t('practice:setup.labels.nativeLanguage'),
            `${t(`practice:setup.options.native.${choice}`)} — ${t(`practice:setup.options.nativeDesc.${choice}`, { language })}`,
        ]);
    }

    return (
        <section className="overflow-hidden rounded-(--radius) border border-border" aria-label={t('practice:results.settings')}>
            <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 bg-(--bg) px-3.5 py-2.5 text-left text-[13.5px] font-semibold"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                {t('practice:results.settings')}
                <CaretDownIcon
                    aria-hidden
                    size={14}
                    className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="flex flex-col gap-3 px-3.5 pt-1 pb-3">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13.5px] sm:grid-cols-[200px_1fr] sm:gap-y-1.5">
                        {rows.map(([label, value]) => (
                            <div key={label} className="contents">
                                <dt className="mt-2 text-muted-foreground sm:mt-0">{label}</dt>
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
                </div>
            )}
        </section>
    );
}
