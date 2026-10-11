/**
 * "Start from a word" (Slice G, step G4): the section above the part-of-speech list on `/addWord`.
 * The user chooses the language of the word they will type (only the languages of the account;
 * default: the UI language) and a part of speech (`Any`, or one), then types. The list shows the
 * senses of the matching words in that language. A pick opens the preview (`SensePreview`); its
 * "Create draft" hands the looked-up words to `onDraft`.
 *
 * The language select says which language the typed text is in; the other languages are the targets,
 * filled from the picked sense (decisions G-a to G-j in autocomplete-slice-g-one-term-to-word.md).
 *
 * `children` is the part-of-speech list: it shows under an "or" line, and is hidden while the
 * preview is open (the preview replaces the whole gate).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { SenseSuggestion, WordDraft } from '@/features/autocomplete/types';
import { UI_LANGUAGES } from '@/lib/language';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { SensePreview } from './SensePreview';
import { SenseTypeAhead } from './SenseTypeAhead';

/** The parts of speech a draft can be made for (the translation table covers these four). */
const DRAFT_PARTS_OF_SPEECH = [PartOfSpeech.noun, PartOfSpeech.verb, PartOfSpeech.adjective, PartOfSpeech.adverb];

export function StartFromWord({ onDraft, children }: { onDraft: (draft: WordDraft) => void; children?: ReactNode }) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);

    // The account languages; a session with none (should not happen) falls back to all four.
    const accountLanguages = useMemo(() => {
        const own = UI_LANGUAGES.filter((language) => user?.languages.includes(language.label));
        return own.length > 0 ? own : UI_LANGUAGES;
    }, [user?.languages]);

    const [language, setLanguage] = useState<string>(
        () => (accountLanguages.find((l) => l.label === user?.uiLanguage) ?? accountLanguages[0]).label,
    );
    const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | 'Any'>('Any');
    const [text, setText] = useState('');
    const [picked, setPicked] = useState<SenseSuggestion | null>(null);

    if (picked) {
        return (
            <SensePreview
                suggestion={picked}
                startLanguage={language}
                languages={[language, ...accountLanguages.map((l) => l.label).filter((label) => label !== language)]}
                onBack={() => setPicked(null)}
                onDraft={onDraft}
            />
        );
    }

    const nativeName = (label: string) => UI_LANGUAGES.find((l) => l.label === label)?.native ?? label;
    const partOfSpeechName = (value: PartOfSpeech | 'Any') =>
        value === 'Any' ? t('wordRelated:startFromWord.anyPartOfSpeech') : t(partOfSpeechLabelKey(value));

    return (
        <div className="flex flex-col gap-4">
            <section data-testid="start-from-word" className="flex flex-col gap-3 rounded-xl border border-(--border) p-4">
                <div className="flex flex-col gap-1">
                    <h2 className="h2">{t('wordRelated:startFromWord.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('wordRelated:startFromWord.description')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[11rem_11rem_1fr]">
                    <div className="flex flex-col gap-1">
                        <span className="label-n">{t('wordRelated:startFromWord.languageLabel')}</span>
                        <Select<string> value={language} onValueChange={(value) => value && setLanguage(value)}>
                            <SelectTrigger aria-label={t('wordRelated:startFromWord.languageLabel')} data-testid="start-language">
                                <SelectValue>
                                    {(value: string) => (
                                        <span className="flex items-center gap-2">
                                            <FlagIcon lang={value} />
                                            {nativeName(value)}
                                        </span>
                                    )}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {accountLanguages.map((l) => (
                                    <SelectItem key={l.label} value={l.label}>
                                        <span className="flex items-center gap-2">
                                            <FlagIcon lang={l.label} />
                                            {l.native}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="label-n">{t('wordRelated:startFromWord.partOfSpeechLabel')}</span>
                        <Select<PartOfSpeech | 'Any'> value={partOfSpeech} onValueChange={(value) => value && setPartOfSpeech(value)}>
                            <SelectTrigger aria-label={t('wordRelated:startFromWord.partOfSpeechLabel')} data-testid="start-pos">
                                <SelectValue>{(value: PartOfSpeech | 'Any') => partOfSpeechName(value)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {(['Any', ...DRAFT_PARTS_OF_SPEECH] as const).map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {partOfSpeechName(value)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="label-n">{t('wordRelated:startFromWord.wordLabel')}</span>
                        <SenseTypeAhead
                            language={language as Lang}
                            partOfSpeech={partOfSpeech}
                            value={text}
                            onValueChange={setText}
                            onPick={(suggestion) => {
                                setText(suggestion.word);
                                setPicked(suggestion);
                            }}
                            label={t('wordRelated:startFromWord.wordLabel')}
                        />
                    </div>
                </div>
            </section>
            {children && (
                <>
                    <div className="flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground">{t('wordRelated:startFromWord.orLine')}</span>
                        <Separator className="flex-1" />
                    </div>
                    {children}
                </>
            )}
        </div>
    );
}
