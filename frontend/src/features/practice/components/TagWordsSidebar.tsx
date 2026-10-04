import { useState } from 'react';
import { CaretDownIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TagCombobox } from '@/features/tags/components/TagCombobox';
import type { TagSummary } from '@/features/tags/types';
import type { PreselectedWord } from '../preselection';
import type { PracticeParams } from '../types';
import { describeWords } from '../wordFilter';
import { PreselectedWordList, WordsModeToggle, type WordsMode } from './PreselectedWords';

type Params = Pick<PracticeParams, 'languages' | 'partsOfSpeech'>;

/**
 * The practice sidebar when no words came from Review: the user chooses words by tag. Nothing chosen:
 * a note (all words are used) and a separator, then the tag search. The chosen tags are NOT shown inside
 * the search box; each one is a container below it, with its words (folded at first), a remove button,
 * and the number of words in the header. A tag that is already chosen is not offered again. Together the tags' words are the pre-selected words
 * (`words`, the union the page also uses for Start); the eye button and the used / not used marks are
 * the same as for words from Review.
 */
export function TagWordsSidebar({
    tags,
    onTagsChange,
    byTag,
    words,
    params,
    mode,
    onModeChange,
}: {
    tags: TagSummary[];
    onTagsChange: (next: TagSummary[]) => void;
    byTag: Record<string, PreselectedWord[] | undefined>;
    /** The words of all the chosen tags, each once. */
    words: PreselectedWord[];
    params: Params;
    mode: WordsMode;
    onModeChange: (next: WordsMode) => void;
}) {
    const { t } = useTranslation();
    const used = describeWords(words, params).filter((item) => item.included).length;

    function add(next: unknown[]) {
        // The search box keeps no chips (`selected` is always empty), so a pick arrives alone.
        const picked = next as TagSummary[];
        const fresh = picked.filter((tag) => !tags.some((chosen) => chosen.id === tag.id));
        if (fresh.length > 0) onTagsChange([...tags, ...fresh]);
    }

    return (
        <div className="flex flex-col gap-3">
            {tags.length === 0 && (
                <>
                    <p className="hint">{t('practice:setup.tagsEmpty')}</p>
                    <hr className="rule" />
                </>
            )}

            <div className="field">
                <span className="label">{t('practice:setup.tagsLabel')}</span>
                <TagCombobox
                    mode="filter"
                    selected={[]}
                    excludeIds={new Set(tags.map((tag) => tag.id))}
                    onSelectedChange={add}
                />
            </div>

            {tags.length > 0 && (
                <>
                    <div className="flex items-center gap-2">
                        <b className="grow">{t('practice:setup.preselected.title', { count: words.length })}</b>
                        <WordsModeToggle mode={mode} onModeChange={onModeChange} />
                    </div>
                    <p className="hint">{t('practice:setup.preselected.used', { used, total: words.length })}</p>
                    <div className="flex flex-col gap-2">
                        {tags.map((tag) => (
                            <TagWordsContainer
                                key={tag.id}
                                tag={tag}
                                words={byTag[tag.id]}
                                params={params}
                                mode={mode}
                                onRemove={() => onTagsChange(tags.filter((chosen) => chosen.id !== tag.id))}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/** One chosen tag: name and word count in the header, remove button, and its words (folded at first). */
function TagWordsContainer({
    tag,
    words,
    params,
    mode,
    onRemove,
}: {
    tag: TagSummary;
    words: PreselectedWord[] | undefined;
    params: Params;
    mode: WordsMode;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const count = words?.length ?? tag.wordCount;

    return (
        <section aria-label={tag.label} className="rounded-(--radius) border border-border bg-card">
            <div className="flex items-center gap-1 pr-1">
                <button
                    type="button"
                    className="flex min-w-0 grow items-center gap-1.5 rounded-(--radius) px-2 py-2 text-left text-sm hover:bg-(--accent-soft)"
                    aria-expanded={open}
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? <CaretDownIcon aria-hidden size={14} /> : <CaretRightIcon aria-hidden size={14} />}
                    <span className="min-w-0 truncate font-medium">{tag.label}</span>
                    <span className="meta shrink-0">({count})</span>
                </button>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('practice:setup.tagRemove', { name: tag.label })}
                    title={t('practice:setup.tagRemove', { name: tag.label })}
                    onClick={onRemove}
                >
                    <XIcon size={14} />
                </button>
            </div>
            {open && (
                <div className="border-t border-border px-2 py-1">
                    {words ? (
                        <PreselectedWordList words={words} params={params} mode={mode} />
                    ) : (
                        <p className="hint">{t('practice:setup.tagWordsLoading')}</p>
                    )}
                </div>
            )}
        </section>
    );
}
