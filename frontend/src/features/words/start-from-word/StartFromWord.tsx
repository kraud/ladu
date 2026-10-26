/**
 * "Start from a word" (Slice G): the section above the part-of-speech list on `/addWord`.
 * The user chooses the language of the word they will type (only the languages of the account;
 * default: the UI language) and a part of speech (`Any type`, or one), then types. The list shows the
 * senses of the matching words in that language. A pick opens the preview (`SensePreview`); its
 * "Create draft" hands the looked-up words to `onDraft`.
 *
 * The language select says which language the typed text is in; the other languages are the targets,
 * filled from the picked sense (decisions G-a to G-j in autocomplete-slice-g-one-term-to-word.md).
 *
 * The heading has the sparkle icon (accent colour) in a left column and the title and hint in the right one,
 * as the dashboard's greeting has its hand-waving icon: 32 px on a desktop, as tall as the text beside it on a phone.
 *
 * Layout: on a desktop the section takes half the row, aligned left, and the three controls share one
 * line (language as flag + two-letter code, part of speech, the word). On a phone it takes the full
 * row: the two selects share a line, 50% each, with the full language names; the word is underneath.
 * The controls have no visible labels; the placeholder says what to type, from the two selects
 * ("Type the verb in Spanish").
 *
 * `header` is the page title row and `children` the part-of-speech list: both show with the section
 * (the list under an "or create manually" line) and are hidden while the preview is open; the preview
 * has its own title and back arrow, which return here.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SparkleIcon } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { SenseSuggestion, WordDraft } from '@/features/autocomplete/types';
import { UI_LANGUAGES } from '@/lib/language';
import { useColumnHeightVar } from '@/lib/useColumnHeightVar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useMediaQuery';
import { partOfSpeechLabelKey } from '@/lib/words';
import { useAuthStore } from '@/stores/authStore';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { SensePreview } from './SensePreview';
import { SenseTypeAhead } from './SenseTypeAhead';

/** The parts of speech a draft can be made for (the translation table covers these six). */
const DRAFT_PARTS_OF_SPEECH = [
    PartOfSpeech.noun,
    PartOfSpeech.verb,
    PartOfSpeech.adjective,
    PartOfSpeech.adverb,
    PartOfSpeech.conjunction,
    PartOfSpeech.preposition,
];

/** The last chosen language, kept per browser: a convenience, so every access is wrapped. */
export const REMEMBERED_LANGUAGE_KEY = 'ladu.startFromWord.language';

function loadRememberedLanguage(): string | null {
    try {
        return localStorage.getItem(REMEMBERED_LANGUAGE_KEY);
    } catch {
        return null;
    }
}

function rememberLanguage(language: string): void {
    try {
        localStorage.setItem(REMEMBERED_LANGUAGE_KEY, language);
    } catch {
        /* storage unavailable or full: the next visit starts from the UI language */
    }
}

export function StartFromWord({
    onDraft,
    header,
    children,
}: {
    onDraft: (draft: WordDraft) => void;
    header?: ReactNode;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const isMobile = useIsMobile();

    // The account languages; a session with none (should not happen) falls back to all of them.
    const accountLanguages = useMemo(() => {
        const own = UI_LANGUAGES.filter((language) => user?.languages.includes(language.label));
        return own.length > 0 ? own : UI_LANGUAGES;
    }, [user?.languages]);

    // The last chosen language if the account still has it, else the UI language.
    const [language, setLanguage] = useState<string>(
        () =>
            (
                accountLanguages.find((l) => l.label === loadRememberedLanguage()) ??
                accountLanguages.find((l) => l.label === user?.uiLanguage) ??
                accountLanguages[0]
            ).label,
    );
    const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | 'Any'>('Any');
    const [text, setText] = useState('');
    const [picked, setPicked] = useState<SenseSuggestion | null>(null);
    // The phone icon is as tall as the title and hint beside it, like the dashboard's greeting (`--start-h`).
    const { containerRef: headingRef, columnRef: headingTextRef } = useColumnHeightVar<HTMLDivElement>('--start-h');

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

    const entry = UI_LANGUAGES.find((l) => l.label === language) ?? UI_LANGUAGES[0];
    // Desktop: the two-letter code; phone: the full name.
    const languageText = (label: string) => {
        const found = UI_LANGUAGES.find((l) => l.label === label);
        return isMobile ? (found?.native ?? label) : (found?.key ?? label);
    };
    const partOfSpeechName = (value: PartOfSpeech | 'Any') =>
        value === 'Any' ? t('wordRelated:startFromWord.anyPartOfSpeech') : t(partOfSpeechLabelKey(value));
    const inLanguage = t(`wordRelated:startFromWord.inLanguage.${language.toLowerCase()}`);
    const placeholder =
        partOfSpeech === 'Any'
            ? t('wordRelated:startFromWord.placeholderAny', { inLanguage })
            : t('wordRelated:startFromWord.placeholderPos', { partOfSpeech: partOfSpeechName(partOfSpeech).toLowerCase(), inLanguage });

    return (
        <div className="flex flex-col gap-4">
            {header}
            <section
                data-testid="start-from-word"
                className={cn('flex flex-col gap-3 rounded-xl border border-(--border) p-4', !isMobile && 'w-1/2')}
            >
                {/* Icon in the left column; title and hint in the right one (like the dashboard's greeting). */}
                <div ref={headingRef} className="flex items-center gap-3">
                    <span aria-hidden data-testid="start-icon" className="size-8 shrink-0 text-(--accent) max-[920px]:size-[var(--start-h,2rem)]">
                        <SparkleIcon className="size-full" />
                    </span>
                    <div ref={headingTextRef} className="flex min-w-0 flex-col gap-1">
                        <h2 className="h2">{t('wordRelated:startFromWord.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('wordRelated:startFromWord.description')}</p>
                    </div>
                </div>
                <div className={isMobile ? 'grid grid-cols-2 gap-3' : 'flex items-center gap-3'}>
                    <Select<string> value={language} onValueChange={(value) => {
                            if (!value) return;
                            setLanguage(value);
                            rememberLanguage(value);
                        }}
                    >
                        <SelectTrigger
                            aria-label={t('wordRelated:startFromWord.languageLabel')}
                            data-testid="start-language"
                            className={isMobile ? 'w-full' : 'shrink-0'}
                        >
                            <SelectValue>
                                {(value: string) => (
                                    <span className="flex items-center gap-2">
                                        <FlagIcon lang={value} />
                                        {languageText(value)}
                                    </span>
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                            {accountLanguages.map((l) => (
                                <SelectItem key={l.label} value={l.label}>
                                    <span className="flex items-center gap-2">
                                        <FlagIcon lang={l.label} />
                                        {languageText(l.label)}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select<PartOfSpeech | 'Any'> value={partOfSpeech} onValueChange={(value) => value && setPartOfSpeech(value)}>
                        <SelectTrigger
                            aria-label={t('wordRelated:startFromWord.partOfSpeechLabel')}
                            data-testid="start-pos"
                            className={isMobile ? 'w-full' : 'shrink-0'}
                        >
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
                    <div className={isMobile ? 'col-span-2' : 'min-w-0 flex-1'}>
                        <SenseTypeAhead
                            language={entry.label as Lang}
                            partOfSpeech={partOfSpeech}
                            partsOfSpeech={DRAFT_PARTS_OF_SPEECH}
                            accountLanguages={accountLanguages.map((l) => l.label)}
                            value={text}
                            onValueChange={setText}
                            onPick={(suggestion) => {
                                setText(suggestion.word);
                                setPicked(suggestion);
                            }}
                            label={t('wordRelated:startFromWord.wordLabel')}
                            placeholder={placeholder}
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
