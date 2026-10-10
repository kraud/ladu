import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeAutocompleteHandlers } from '@/test/msw/autocompleteHandlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { mockMobileViewport } from '@/test/viewport';
import { Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';
import type { CaseName, FieldConfig } from './configs/types';
import {
    casesToFieldValues,
    fieldsHaveData,
    fieldsToCases,
    groupHeadingsToPrint,
    TranslationCard,
} from './TranslationCard';

const CASE_NAME = NounCases.singularEN; // arbitrary — these helpers never inspect it.

describe('TranslationCard', () => {
    it.each([
        [Lang.EN, 'English'],
        [Lang.ES, 'Español'],
        [Lang.DE, 'Deutsch'],
        [Lang.EE, 'Eesti'],
    ])('mounts a %s noun card with its native language name and required fields', (lang, native) => {
        renderWithProviders(<TranslationCard lang={lang} />);
        expect(screen.getByText(native)).toBeInTheDocument();
        expect(screen.getByText('Regularity')).toBeInTheDocument();
    });

    it('bottom-aligns the cells of a paired row (an autocomplete field next to a plain one)', () => {
        // Spanish nouns pair the autocomplete trigger (bold label, 2px border, taller)
        // with a plain field. Without `items-end` their input bottoms drift apart.
        renderWithProviders(<TranslationCard lang={Lang.ES} />);

        const row = screen.getByLabelText('Singular').closest('.grid');
        expect(row).toHaveClass('items-end');
        expect(row).toContainElement(screen.getByLabelText('Plural'));
    });

    it('reserves room under a mandatory field and shows its validation message out of the flow', async () => {
        const user = userEvent.setup();
        renderWithProviders(<TranslationCard lang={Lang.EN} />);

        const item = screen.getByLabelText('Singular').closest('[data-slot="form-item"]');
        expect(item).toHaveClass('relative', 'pb-4');

        await user.type(screen.getByLabelText('Singular'), 'abc1');
        await user.tab();

        // `position: absolute` inside the reserved strip: the message adds no height.
        const message = await screen.findByText('Must not include numbers');
        expect(item).toContainElement(message);
        expect(message).toHaveClass('absolute', 'bottom-0', 'truncate');
        // Cut to one line if too long, so the full text is on hover.
        expect(message).toHaveAttribute('title', 'Must not include numbers');
    });

    describe('message room is reserved per row, only where a field is mandatory', () => {
        const itemOf = (label: string) => screen.getByLabelText(label).closest('[data-slot="form-item"]');

        it('a row with a mandatory field reserves room for ALL its cells, optional ones included', () => {
            renderWithProviders(<TranslationCard lang={Lang.DE} />);

            // Singular nominative is mandatory; Plural nominative, its row partner, is not.
            expect(itemOf('Singular nominative')).toHaveClass('pb-4');
            expect(itemOf('Plural nominative')).toHaveClass('pb-4');
        });

        it('a row with no mandatory field is left as it was: no reserved room, message in the flow', async () => {
            const user = userEvent.setup();
            renderWithProviders(<TranslationCard lang={Lang.DE} />);

            expect(itemOf('Singular accusative')).not.toHaveClass('pb-4');
            expect(itemOf('Plural accusative')).not.toHaveClass('pb-4');

            await user.type(screen.getByLabelText('Singular accusative'), 'abc1');
            await user.tab();
            const message = await screen.findByText('Must not include numbers');
            expect(message).not.toHaveClass('absolute');
        });

        it('cells of a row with a mandatory field bottom-align; cells of an optional row stay top-aligned', () => {
            renderWithProviders(<TranslationCard lang={Lang.DE} />);
            const cellOf = (label: string) => screen.getByLabelText(label).closest('[data-slot="form-item"]')?.parentElement;

            expect(cellOf('Singular nominative')).toHaveClass('self-end');
            expect(cellOf('Plural nominative')).toHaveClass('self-end');
            expect(cellOf('Singular accusative')).toHaveClass('self-start');
            expect(cellOf('Plural accusative')).toHaveClass('self-start');
        });

        it('a lone optional field reserves nothing; a lone mandatory field does', () => {
            renderWithProviders(<TranslationCard lang={Lang.DE} />);

            // Regularity is optional, Gender is mandatory (both single-field rows).
            expect(screen.getByText('Regularity').closest('[data-slot="form-item"]')).not.toHaveClass('pb-4');
            expect(screen.getByText('Gender').closest('[data-slot="form-item"]')).toHaveClass('pb-4');
        });
    });

    it('reserves nothing in displayOnly (no messages there)', () => {
        renderWithProviders(
            <TranslationCard
                lang={Lang.EN}
                displayOnly
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
            />,
        );

        const item = screen.getByText('Singular').closest('[data-slot="form-item"]');
        expect(item).not.toHaveClass('pb-4');
    });

    it('hydrates from initialCases', () => {
        renderWithProviders(
            <TranslationCard lang={Lang.EN} initialCases={[{ caseName: NounCases.singularEN, word: 'cat' }]} />
        );
        // The query field is a combobox since Slice E (the type-ahead list).
        expect(screen.getByRole('combobox', { name: 'Singular' })).toHaveValue('cat');
    });

    it('shows Clear and Remove actions when their handlers are passed, unless displayOnly', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} onClear={vi.fn()} onRemove={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('styles Remove as a destructive (red) action, distinct from the neutral Clear', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} onClear={vi.fn()} onRemove={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('text-destructive');
        expect(screen.getByRole('button', { name: 'Clear' })).not.toHaveClass('text-destructive');
    });

    // `CellDialog` renders this card with neither handler — it has nothing for
    // Clear/Remove to do (a cell edits exactly one already-placed language).
    it('hides Clear/Remove when no handler is passed', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} />);
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('hides Clear/Remove in displayOnly mode even when handlers are passed', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} displayOnly onClear={vi.fn()} onRemove={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('disables Remove when removeDisabled is set', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} onClear={vi.fn()} onRemove={vi.fn()} removeDisabled />);
        expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    });

    describe('collapse', () => {
        it('toggling the caret CSS-hides the field body and shows a "word · N of M cases" summary', async () => {
            // The body is hidden via a `hidden` class, not unmounted (see
            // `TranslationCard.tsx`'s own comment on why) — the test harness
            // runs with `css: false` (`vite.config.ts`), so a class-presence
            // check is the meaningful assertion here, not element absence.
            const user = userEvent.setup();
            renderWithProviders(
                <TranslationCard lang={Lang.EN} initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]} />,
            );

            expect(screen.getByLabelText('Singular').closest('.hidden')).not.toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Collapse translation' }));

            expect(screen.getByLabelText('Singular').closest('.hidden')).toBeInTheDocument();
            expect(screen.getByText('house · 1 of 3 cases')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Expand translation' }));
            expect(screen.getByLabelText('Singular').closest('.hidden')).not.toBeInTheDocument();
        });

        it('hides the completion ring while collapsed — the summary text already states the same count', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <TranslationCard lang={Lang.EN} initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]} />,
            );

            expect(document.querySelector('.ring')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Collapse translation' }));
            expect(document.querySelector('.ring')).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Expand translation' }));
            expect(document.querySelector('.ring')).toBeInTheDocument();
        });

        it('shows a muted "nothing entered yet" hint when collapsed with no cases', async () => {
            const user = userEvent.setup();
            renderWithProviders(<TranslationCard lang={Lang.EN} />);

            await user.click(screen.getByRole('button', { name: 'Collapse translation' }));
            expect(screen.getByText('Nothing entered yet')).toBeInTheDocument();
        });

        it('works in displayOnly mode too', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <TranslationCard
                    lang={Lang.EN}
                    displayOnly
                    initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
                />,
            );

            await user.click(screen.getByRole('button', { name: 'Collapse translation' }));
            expect(screen.getByText('house · 1 of 3 cases')).toBeInTheDocument();
        });

        it('keeps reporting completionState/cases through onChange while collapsed (the body is CSS-hidden, not unmounted)', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

            await user.click(screen.getByRole('button', { name: 'Collapse translation' }));
            onChange.mockClear();

            await user.type(screen.getByLabelText('Singular'), 'House');
            await waitFor(() =>
                expect(onChange).toHaveBeenLastCalledWith({
                    cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                    completionState: true,
                    isDirty: true,
                    hasData: true,
                }),
            );
        });
    });

    it('calls onChange with completionState:false while the required field is empty', () => {
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

        expect(onChange).toHaveBeenCalledWith({ cases: [], completionState: false, isDirty: false, hasData: false });
    });

    it('pushes up lowercased cases and flips complete/dirty once the required field is filled', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

        await user.type(screen.getByLabelText('Singular'), 'House');

        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith({
                cases: [{ caseName: NounCases.singularEN, word: 'house' }],
                completionState: true,
                isDirty: true,
                hasData: true,
            }),
        );
    });

    it('resetKey forces a resync back to initialCases (the Clear-button fix)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <TranslationCard lang={Lang.EN} onChange={onChange} resetKey={0} />,
        );

        await user.type(screen.getByLabelText('Singular'), 'House');
        expect(screen.getByLabelText('Singular')).toHaveValue('House');

        // Mirrors `useWordFormState.clearTranslation`: the parent empties
        // `initialCases` *and* bumps `resetKey` in the same update.
        rerender(<TranslationCard lang={Lang.EN} initialCases={[]} onChange={onChange} resetKey={1} />);

        await waitFor(() => expect(screen.getByLabelText('Singular')).toHaveValue(''));
        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith({ cases: [], completionState: false, isDirty: false, hasData: false }),
        );

        // The card still works normally afterward.
        await user.type(screen.getByLabelText('Singular'), 'Cat');
        expect(screen.getByLabelText('Singular')).toHaveValue('Cat');
    });

    it('an unrelated initialCases identity change (the self-echo) does not reset the card when resetKey is unchanged', async () => {
        const user = userEvent.setup();
        const { rerender } = renderWithProviders(<TranslationCard lang={Lang.EN} resetKey={0} />);

        await user.type(screen.getByLabelText('Singular'), 'House');
        expect(screen.getByLabelText('Singular')).toHaveValue('House');

        // A *new* array reference with the same content — exactly what
        // `WordForm` echoes back in as `initialCases` after every keystroke.
        rerender(
            <TranslationCard
                lang={Lang.EN}
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
                resetKey={0}
            />,
        );

        expect(screen.getByLabelText('Singular')).toHaveValue('House');
    });

    it('never calls onChange in displayOnly mode', async () => {
        const onChange = vi.fn();
        renderWithProviders(
            <TranslationCard
                lang={Lang.EN}
                displayOnly
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
                onChange={onChange}
            />,
        );

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('TranslationCard — Verb', () => {
    it('shows a verb grid of up to four tense columns side by side on a desktop, with no scroller', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} pos={PartOfSpeech.verb} />);
        expect(screen.queryByTestId('horizontal-scroller')).not.toBeInTheDocument();
    });

    it('keeps a verb grid of more than two tense columns inside its own horizontal scroller on a phone', () => {
        mockMobileViewport();
        renderWithProviders(<TranslationCard lang={Lang.EN} pos={PartOfSpeech.verb} />);
        const scroller = screen.getByTestId('horizontal-scroller').firstElementChild;
        expect(scroller).not.toBeNull();
        const grid = scroller!.firstElementChild as HTMLElement;
        const columns = grid.style.gridTemplateColumns;
        // The edge fades need measured widths (jsdom has none): see HorizontalScroller.test.tsx.
        expect(Number(/repeat\((\d+)/.exec(columns)?.[1])).toBeGreaterThan(2);
    });

    it('stacks the Spanish infinitive, gerund and participle in one column on a phone, without a scroller', () => {
        mockMobileViewport();
        renderWithProviders(<TranslationCard lang={Lang.ES} pos={PartOfSpeech.verb} />);
        // The infinitive is the autocomplete query field (a combobox since Slice E).
        const infinitive = screen.getByPlaceholderText('Type to autocomplete');
        const grid = infinitive.closest('.grid') as HTMLElement;
        expect(grid.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
        expect(grid.closest('[data-testid="horizontal-scroller"]')).toBeNull();
    });

    it('gives the German infinitive its own row on a phone, with the auxiliary verb and prefix below it and no scroller', () => {
        mockMobileViewport();
        renderWithProviders(<TranslationCard lang={Lang.DE} pos={PartOfSpeech.verb} />);
        // The infinitive is the autocomplete query field (a combobox since Slice E).
        const infinitive = screen.getByPlaceholderText('Type to autocomplete');
        const grid = infinitive.closest('.grid') as HTMLElement;
        expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
        expect(infinitive.closest('.col-span-2')).not.toBeNull();
        expect(grid.closest('[data-testid="horizontal-scroller"]')).toBeNull();
    });

    it('on a phone in display mode, keeps verb pronouns beside their value and puts other labels above it', () => {
        mockMobileViewport();
        // Required fields render even when empty (as '—').
        renderWithProviders(<TranslationCard lang={Lang.EN} pos={PartOfSpeech.verb} displayOnly />);
        const pronounItem = screen.getAllByText('I')[0]!.closest('[data-slot="form-item"]') as HTMLElement;
        expect(pronounItem.className).toContain('flex-row');
    });

    it('on a phone in display mode, puts a verb\'s non-pronoun labels above the value', () => {
        mockMobileViewport();
        renderWithProviders(<TranslationCard lang={Lang.ES} pos={PartOfSpeech.verb} displayOnly />);
        const infinitiveItem = screen.getAllByText('—')[0]!.closest('[data-slot="form-item"]') as HTMLElement;
        expect(infinitiveItem.className).not.toContain('flex-row');
    });

    it('mounts an English verb card with its stacked group heading and hardcoded pronoun labels', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} pos={PartOfSpeech.verb} />);
        expect(screen.getByText('Simple')).toBeInTheDocument();
        expect(screen.getByText('Present')).toBeInTheDocument();
        // "I"/"They" each label 4 fields (once per tense) — assert presence, not uniqueness.
        expect(screen.getAllByText('I').length).toBeGreaterThan(0);
        expect(screen.getAllByText('They').length).toBeGreaterThan(0);
    });

    it('mounts a Spanish verb card printing all three stacked headings once, then only the changed tail', () => {
        renderWithProviders(<TranslationCard lang={Lang.ES} pos={PartOfSpeech.verb} />);
        expect(screen.getByText('Modo indicativo')).toBeInTheDocument();
        expect(screen.getByText('Tiempo simple')).toBeInTheDocument();
        expect(screen.getByText('Presente')).toBeInTheDocument();
        expect(screen.getByText('Pretérito imperfecto')).toBeInTheDocument();
        // "Modo indicativo" and "Tiempo simple" each appear exactly once — not reprinted for the later tense blocks.
        expect(screen.getAllByText('Modo indicativo')).toHaveLength(1);
        expect(screen.getAllByText('Tiempo simple')).toHaveLength(1);
    });

    it('mounts a German verb card with a segmented toggle, multi-select, and a conjugated-auxiliary adornment', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <TranslationCard
                lang={Lang.DE}
                pos={PartOfSpeech.verb}
                initialCases={[{ caseName: VerbCases.auxVerbDE, word: 'haben' }]}
            />,
        );
        expect(screen.getByText('Indikativ')).toBeInTheDocument();
        expect(screen.getByText('Perfekt')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'haben' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'sein' })).not.toBeChecked();
        expect(screen.getByText('Accusative')).toBeInTheDocument();
        // The Perfect tense's adornment reflects the hydrated auxiliaryVerb ("haben" -> "habe" for 1s).
        expect(screen.getByText('habe')).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'sein' }));
        await waitFor(() => expect(screen.getByText('bin')).toBeInTheDocument());
        expect(screen.getByRole('radio', { name: 'sein' })).toBeChecked();

        // Clicking the already-active option again clears the selection.
        await user.click(screen.getByRole('radio', { name: 'sein' }));
        expect(screen.getByRole('radio', { name: 'sein' })).not.toBeChecked();
        expect(screen.getByRole('radio', { name: 'haben' })).not.toBeChecked();
    });

    it('mounts an Estonian verb card whose infinitiveMa pattern relaxes once searchInEnglish is checked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.verb} />);
        expect(screen.getByText('Kindel')).toBeInTheDocument();

        await user.type(screen.getByLabelText('-ma infinitive'), 'dance');
        await user.tab();
        expect(screen.getByText("Please input infinitive form (ends in '-ma').")).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Search verb in english' }));
        await user.click(screen.getByLabelText('-ma infinitive'));
        await user.tab();
        await waitFor(() =>
            expect(screen.queryByText("Please input infinitive form (ends in '-ma').")).not.toBeInTheDocument(),
        );
    });
});

describe('TranslationCard — Adjective', () => {
    it('switches the Spanish adjective field set when gender changes, dropping the other branch on save', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.ES} pos={PartOfSpeech.adjective} onChange={onChange} />);

        expect(screen.queryByLabelText('Male singular')).not.toBeInTheDocument();
        await user.click(screen.getByRole('radio', { name: 'M/F' }));
        expect(screen.getByLabelText('Male singular')).toBeInTheDocument();
        expect(screen.queryByLabelText('Neutral singular')).not.toBeInTheDocument();

        await user.type(screen.getByLabelText('Male singular'), 'Alto');
        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ cases: [{ caseName: 'maleSingularES', word: 'alto' }] }),
            ),
        );

        // Switching back to Neutral drops the M/F value entirely — gender itself is never persisted.
        await user.click(screen.getByRole('radio', { name: 'Neutral' }));
        await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cases: [] })));
    });
});

describe('TranslationCard — Adverb', () => {
    it('hides German comparative/superlative only once Non-gradable is explicitly picked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<TranslationCard lang={Lang.DE} pos={PartOfSpeech.adverb} />);

        // Visible by default, before gradable has any value. Labels read in the
        // active *interface* language (English here), describing the German
        // field — "Komparativ"/"Superlativ" only appear in the German locale.
        expect(screen.getByLabelText('Comparative')).toBeInTheDocument();
        expect(screen.getByLabelText('Superlative')).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'Non-gradable' }));
        expect(screen.queryByLabelText('Comparative')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Superlative')).not.toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'Gradable' }));
        expect(screen.getByLabelText('Comparative')).toBeInTheDocument();
    });

    it('the Estonian adverb card has the adverb, its comparative and superlative, and the "kõige" box (Slice H4, D27)', () => {
        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.adverb} />);
        expect(screen.getByLabelText('Adverb')).toBeInTheDocument();
        expect(screen.getByLabelText('Comparative')).toBeInTheDocument();
        expect(screen.getByLabelText('Superlative')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /No one-word superlative/ })).toBeInTheDocument();
    });

    it('a part of speech with no form engine shows the "not available yet" card', () => {
        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.preposition} />);
        expect(screen.getByText('That language is not available yet')).toBeInTheDocument();
    });
});

describe('TranslationCard — Autocomplete integration (one case per language with a lookup endpoint)', () => {
    it('English verb: typing into simplePresent1s fills the other empty tense fields on Fill', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            englishVerb: {
                status: 'found',
                cases: [
                    { caseName: 'simplePresent1sEN', word: 'run' },
                    { caseName: 'simplePresent2sEN', word: 'run' },
                    { caseName: 'simplePresent3sEN', word: 'runs' },
                ],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(<TranslationCard lang={Lang.EN} pos={PartOfSpeech.verb} />);
        // "I" labels one field per tense (present/past/future/conditional) — the first is simplePresent1s, the query field.
        await user.type(screen.getAllByLabelText('I')[0], 'run');

        await waitFor(() => expect(screen.getByRole('button', { name: /autocomplete/i })).toBeInTheDocument(), { timeout: 2000 });
        await user.click(screen.getByRole('button', { name: /autocomplete/i }));
        await waitFor(() => expect(screen.getAllByLabelText('He/She/it')[0]).toHaveValue('runs'));
    });

    it('Spanish verb: the infinitive drives the lookup', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            spanishVerb: {
                status: 'found',
                cases: [{ caseName: 'indicativePresent1sES', word: 'bailo' }],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(<TranslationCard lang={Lang.ES} pos={PartOfSpeech.verb} />);
        await user.type(screen.getByLabelText('Infinitive non-finite simple'), 'bailar');

        await waitFor(() => expect(fake.requests).toHaveLength(1), { timeout: 2000 });
        expect(fake.requests[0].query).toBe('bailar');
    });

    it('German noun: the singular nominative field drives the lookup and Fill writes the gender radio', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            germanNoun: {
                status: 'found',
                cases: [{ caseName: 'genderDE', word: 'das' }],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(<TranslationCard lang={Lang.DE} pos={PartOfSpeech.noun} />);
        await user.type(screen.getByLabelText('Singular nominative'), 'Haus');

        await waitFor(() => expect(screen.getByRole('button', { name: /autocomplete/i })).toBeInTheDocument(), { timeout: 2000 });
        await user.click(screen.getByRole('button', { name: /autocomplete/i }));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'das' })).toBeChecked());
    });

    it('Estonian verb: the lookup fires off infinitiveMa, gated by the same field the pattern validation uses', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            estonianVerb: { status: 'found', cases: [{ caseName: 'infinitiveDaEE', word: 'tantsida' }] },
        });
        server.use(...fake.handlers);

        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.verb} />);
        await user.type(screen.getByLabelText('-ma infinitive'), 'tantsima');

        await waitFor(() => expect(screen.getByRole('button', { name: /autocomplete/i })).toBeInTheDocument(), { timeout: 2000 });
        await user.click(screen.getByRole('button', { name: /autocomplete/i }));
        await waitFor(() => expect(screen.getByLabelText('-da infinitive')).toHaveValue('tantsida'));
    });
});

describe('TranslationCard — type-ahead list on the query field (Slice E, D21)', () => {
    const DER_SEE = { entryId: '11111111-1111-1111-1111-111111111111', lemma: 'See', hint: 'der' };
    const DIE_SEE = { entryId: '22222222-2222-2222-2222-222222222222', lemma: 'See', hint: 'die' };
    const SEELE = { entryId: '33333333-3333-3333-3333-333333333333', lemma: 'Seele', hint: 'die' };
    const seeCases = (gender: string, plural: string) => ({
        status: 'found' as const,
        cases: [
            { caseName: 'genderDE', word: gender },
            { caseName: 'singularNominativDE', word: 'See' },
            { caseName: 'pluralNominativDE', word: plural },
        ],
    });

    /** A German noun card; the main-sense lookup (no entry) answers der See, the entries their own. */
    function setup() {
        const fake = makeAutocompleteHandlers(
            { germanNoun: seeCases('der', 'Seen') },
            {
                suggestions: { germanNoun: [DER_SEE, DIE_SEE, SEELE] },
                entries: { [DIE_SEE.entryId]: seeCases('die', 'Seen') },
            }
        );
        server.use(...fake.handlers);
        renderWithProviders(<TranslationCard lang={Lang.DE} pos={PartOfSpeech.noun} />);
        return { fake, user: userEvent.setup(), field: screen.getByRole('combobox', { name: 'Singular nominative' }) };
    }

    it('from 2 characters, lists the matching dictionary words, a homograph once per meaning with its article', async () => {
        const { user, field } = setup();
        await user.type(field, 'se');

        const list = await screen.findByRole('listbox');
        expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual(['derSee', 'dieSee', 'dieSeele']);
    });

    it('1 character asks for nothing and shows no list', async () => {
        const { fake, user, field } = setup();
        await user.type(field, 's');

        // Longer than the list debounce (150 ms).
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(fake.suggestionRequests).toEqual([]);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('a click on a suggestion fills the card with that exact entry, and the footer shows it as applied', async () => {
        const { fake, user, field } = setup();
        await user.type(field, 'se');
        await user.click(await screen.findByRole('option', { name: 'die See' }));

        await waitFor(() => expect(screen.getByRole('radio', { name: 'die' })).toBeChecked());
        expect(field).toHaveValue('See');
        expect(screen.getByLabelText('Plural nominative')).toHaveValue('Seen');
        expect(fake.requests.map((request) => request.entry)).toContain(DIE_SEE.entryId);
        // The footer reads the same entry: no button that offers to overwrite die with der.
        await waitFor(() => expect(screen.getByText('Autocomplete values applied')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Use autocomplete values' })).not.toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('arrow keys and Enter pick a suggestion too', async () => {
        const { user, field } = setup();
        await user.type(field, 'se');
        await screen.findByRole('listbox');
        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        await waitFor(() => expect(screen.getByRole('radio', { name: 'die' })).toBeChecked());
        expect(field).toHaveValue('See');
    });

    it('typing a whole word fills nothing, and the list stays open (also after the lookup pause) so the word can be clicked', async () => {
        const { user, field } = setup();
        await user.type(field, 'See');
        await screen.findByRole('listbox');

        // Longer than the lookup's pause (500 ms): the list used to close by itself here.
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        // While the list is open the rest of the page is hidden from assistive technology (`hidden: true`).
        expect(screen.getByRole('radio', { name: 'der', hidden: true })).not.toBeChecked();
        expect(screen.getByLabelText('Plural nominative')).toHaveValue('');

        await user.click(screen.getByRole('option', { name: 'die See' }));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'die' })).toBeChecked());
    });

    it('a whole word with ONE match keeps the list open too: the single suggestion can still be clicked', async () => {
        const POLIZEI = { entryId: '44444444-4444-4444-4444-444444444444', lemma: 'Polizei', hint: 'die' };
        const fake = makeAutocompleteHandlers(
            { germanNoun: { status: 'found', cases: [{ caseName: 'genderDE', word: 'die' }, { caseName: 'pluralNominativDE', word: 'Polizeien' }] } },
            { suggestions: { germanNoun: [POLIZEI] } }
        );
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<TranslationCard lang={Lang.DE} pos={PartOfSpeech.noun} />);

        await user.type(screen.getByRole('combobox', { name: 'Singular nominative' }), 'Polizei');
        const option = await screen.findByRole('option', { name: 'die Polizei' });
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(option).toBeInTheDocument();

        await user.click(option);
        await waitFor(() => expect(screen.getByRole('radio', { name: 'die' })).toBeChecked());
        expect(screen.getByLabelText('Plural nominative')).toHaveValue('Polizeien');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('a click outside closes the list of a whole word, and the button is free', async () => {
        const { user, field } = setup();
        await user.type(field, 'See');
        await screen.findByRole('listbox');

        await user.click(document.body);
        await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
        expect(await screen.findByRole('button', { name: 'Use autocomplete values' })).toBeInTheDocument();
    });

    it('a part of a word keeps the list open; Escape closes it', async () => {
        const { user, field } = setup();
        await user.type(field, 'se');
        await screen.findByRole('listbox');

        // Longer than the lookup's pause: the list stays.
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    });

    it('typing after a pick drops it: the lookup goes back to the main sense', async () => {
        const { fake, user, field } = setup();
        await user.type(field, 'se');
        await user.click(await screen.findByRole('option', { name: 'die See' }));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'die' })).toBeChecked());

        await user.type(field, '{Backspace}e');
        await waitFor(() => expect(fake.requests.at(-1)).toMatchObject({ query: 'See', entry: null }), { timeout: 2000 });
        // The list of the whole word is open and hides the button; close it with Escape.
        await user.keyboard('{Escape}');
        // The main sense (der) disagrees with the filled die: the button offers it.
        expect(await screen.findByRole('button', { name: 'Use autocomplete values' })).toBeInTheDocument();
    });

    it('Estonian verb: no list while "Search verb in English" is checked', async () => {
        const fake = makeAutocompleteHandlers({}, { suggestions: { estonianVerb: [{ entryId: DER_SEE.entryId, lemma: 'jooksma' }] } });
        server.use(...fake.handlers);
        const user = userEvent.setup();
        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.verb} />);

        await user.click(screen.getByRole('checkbox', { name: 'Search verb in english' }));
        await user.type(screen.getByLabelText('-ma infinitive'), 'jo');
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(fake.suggestionRequests).toEqual([]);

        await user.click(screen.getByRole('checkbox', { name: 'Search verb in english' }));
        expect(await screen.findByRole('option', { name: 'jooksma' })).toBeInTheDocument();
    });
});

describe('TranslationCard — Estonian adjective superlative (D20)', () => {
    const CHECKBOX = 'No one-word superlative (kõige + comparative)';

    it('a lookup with only "kõige …" checks the box and shows the superlative as read-only "kõige" + comparative', async () => {
        const user = userEvent.setup();
        server.use(
            ...makeAutocompleteHandlers({
                estonianAdjective: {
                    status: 'found',
                    cases: [
                        { caseName: 'keskvorreEE', word: 'toredam' },
                        { caseName: 'periphrasticSuperlativeEE', word: 'true' },
                    ],
                },
            }).handlers
        );

        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.adjective} />);
        await user.type(screen.getByLabelText('Positive degree'), 'tore');
        await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));

        await waitFor(() => expect(screen.getByRole('checkbox', { name: CHECKBOX })).toBeChecked());
        expect(screen.getByTestId('derived-ulivorre')).toHaveValue('kõige toredam');
        expect(screen.getByTestId('derived-ulivorre')).toHaveAttribute('readonly');
    });

    it('a lookup with a one-word superlative fills it and leaves the box unchecked', async () => {
        const user = userEvent.setup();
        server.use(
            ...makeAutocompleteHandlers({
                estonianAdjective: {
                    status: 'found',
                    cases: [
                        { caseName: 'keskvorreEE', word: 'suurem' },
                        { caseName: 'ulivorreEE', word: 'suurim' },
                        { caseName: 'periphrasticSuperlativeEE', word: 'false' },
                    ],
                },
            }).handlers
        );

        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.adjective} />);
        await user.click(screen.getByRole('checkbox', { name: CHECKBOX })); // checked by hand first …
        await user.type(screen.getByLabelText('Positive degree'), 'suur');
        await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));

        await waitFor(() => expect(screen.getByLabelText('Superlative degree')).toHaveValue('suurim'));
        expect(screen.getByRole('checkbox', { name: CHECKBOX })).not.toBeChecked(); // … and unchecked by the lookup
        expect(screen.queryByTestId('derived-ulivorre')).not.toBeInTheDocument();
    });

    it('the read-only view shows the derived superlative of a saved "kõige …" adjective', () => {
        renderWithProviders(
            <TranslationCard
                lang={Lang.EE}
                pos={PartOfSpeech.adjective}
                displayOnly
                initialCases={[
                    { caseName: 'algvorreEE' as CaseName, word: 'tore' },
                    { caseName: 'keskvorreEE' as CaseName, word: 'toredam' },
                    { caseName: 'periphrasticSuperlativeEE' as CaseName, word: 'true' },
                ]}
            />
        );
        expect(screen.getByTestId('derived-ulivorre')).toHaveTextContent('kõige toredam');
    });
});

describe('TranslationCard — bare (inside a dialog that has its own header)', () => {
    it('by default draws the header (name, ring, collapse toggle) and the frame', () => {
        const { container } = renderWithProviders(<TranslationCard lang={Lang.EN} />);
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collapse translation' })).toBeInTheDocument();
        expect(container.firstElementChild).toHaveClass('rounded-lg', 'border', 'bg-card');
    });

    it('bare: no header — no name, no collapse toggle, no completion ring — and no frame', () => {
        const { container } = renderWithProviders(<TranslationCard lang={Lang.EN} bare />);
        expect(screen.queryByText('English')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /translation/i })).not.toBeInTheDocument();
        expect(container.querySelector('.ring')).not.toBeInTheDocument();

        const root = container.firstElementChild as HTMLElement;
        expect(root).not.toHaveClass('border', 'rounded-lg', 'bg-card', 'overflow-hidden');
        expect(root.style.borderTopWidth).toBe(''); // the coloured top line
    });

    it('bare: the fields are still there, without the card padding', () => {
        const { container } = renderWithProviders(<TranslationCard lang={Lang.EN} bare />);
        expect(screen.getByLabelText('Singular')).toBeInTheDocument();
        expect(container.querySelector('.p-4')).not.toBeInTheDocument();
    });

    it('bare: the footer (autocomplete row, Clear) stays, unframed', () => {
        renderWithProviders(<TranslationCard lang={Lang.ES} bare onClear={() => {}} />);
        const footer = screen.getByTestId('autocomplete-status').closest('div.justify-between')!;
        expect(footer).not.toHaveClass('border-t', 'bg-background');
        expect(within(footer as HTMLElement).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('bare: still reports changes upward (the dialog\'s Save depends on it)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} bare onChange={onChange} />);
        await user.type(screen.getByLabelText('Singular'), 'House');
        await waitFor(() =>
            expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ completionState: true, isDirty: true })),
        );
    });

    it('bare + displayOnly (the dialog\'s read-only view): values as text, no header, no frame', () => {
        const { container } = renderWithProviders(
            <TranslationCard
                lang={Lang.EN}
                bare
                displayOnly
                initialCases={[{ caseName: NounCases.singularEN, word: 'house' }]}
            />,
        );
        expect(screen.getByText('house')).toBeInTheDocument();
        expect(screen.queryByText('English')).not.toBeInTheDocument();
        expect(container.firstElementChild).not.toHaveClass('border');
    });
});

describe('fieldsToCases', () => {
    const multiSelect: FieldConfig = {
        kind: 'multi-select',
        name: 'verbCases',
        caseName: CASE_NAME,
        labelKey: 'verbCases',
        required: false,
        options: [
            { value: 'accusativeDE', label: 'Accusative' },
            { value: 'dativeDE', label: 'Dative' },
            { value: 'genitiveDE', label: 'Genitive' },
        ],
        encode: (selected) => selected.map((v) => v[0].toUpperCase()).join(''),
        decode: (word) =>
            word
                .split('')
                .map((letter) => ({ A: 'accusativeDE', D: 'dativeDE', G: 'genitiveDE' })[letter])
                .filter((v): v is string => !!v),
    };

    it('capitalizes the first letter of a capitalize text field, and keeps the rest as typed', () => {
        const field: FieldConfig = {
            kind: 'text',
            name: 'singularNominativ',
            caseName: CASE_NAME,
            labelKey: 'x',
            required: false,
            lowercase: false,
            capitalize: true,
        };
        expect(fieldsToCases([field], { singularNominativ: 'haus' })).toEqual([{ caseName: CASE_NAME, word: 'Haus' }]);
        expect(fieldsToCases([field], { singularNominativ: 'eBook' })).toEqual([{ caseName: CASE_NAME, word: 'EBook' }]);
    });

    it('drops a field marked persisted: false, even when it has a value', () => {
        const gender: FieldConfig = {
            kind: 'radio',
            name: 'gender',
            caseName: CASE_NAME,
            labelKey: 'gender',
            required: true,
            persisted: false,
            options: [{ value: 'Neutral', label: 'Neutral' }],
        };
        expect(fieldsToCases([gender], { gender: 'Neutral' })).toEqual([]);
    });

    it('drops a field hidden by visibleWhen, even when it has a leftover value', () => {
        const neutralSingular: FieldConfig = {
            kind: 'text',
            name: 'neutralSingular',
            caseName: CASE_NAME,
            labelKey: 'neutralSingular',
            required: true,
            lowercase: true,
            visibleWhen: { field: 'gender', equals: 'Neutral' },
        };
        expect(fieldsToCases([neutralSingular], { gender: 'M/F', neutralSingular: 'leftover' })).toEqual([]);
    });

    it('keeps a visibleWhen field once its controlling sibling matches', () => {
        const neutralSingular: FieldConfig = {
            kind: 'text',
            name: 'neutralSingular',
            caseName: CASE_NAME,
            labelKey: 'neutralSingular',
            required: true,
            lowercase: true,
            visibleWhen: { field: 'gender', equals: 'Neutral' },
        };
        expect(fieldsToCases([neutralSingular], { gender: 'Neutral', neutralSingular: 'Kind' })).toEqual([
            { caseName: CASE_NAME, word: 'kind' },
        ]);
    });

    it('drops a form-only checkbox (persisted: false, e.g. Estonian searchInEnglish)', () => {
        const checkbox: FieldConfig = { kind: 'checkbox', name: 'searchInEnglish', labelKey: 'searchInEnglish', required: false, persisted: false };
        expect(fieldsToCases([checkbox], { searchInEnglish: true })).toEqual([]);
    });

    describe('a stored checkbox and a derived text field (Estonian superlative, D20)', () => {
        const flag: FieldConfig = { kind: 'checkbox', name: 'periphrasticSuperlative', caseName: CASE_NAME, labelKey: 'flag', required: false };
        const comparative: FieldConfig = { kind: 'text', name: 'keskvorre', caseName: 'keskvorreEE' as CaseName, labelKey: 'k', required: false, lowercase: true };
        const superlative: FieldConfig = {
            kind: 'text',
            name: 'ulivorre',
            caseName: 'ulivorreEE' as CaseName,
            labelKey: 'u',
            required: false,
            lowercase: true,
            derivedWhen: { when: { field: 'periphrasticSuperlative', equals: true }, prefix: 'kõige ', fromField: 'keskvorre' },
        };
        const fields = [comparative, superlative, flag];

        it('checked: the flag is stored as "true" and the derived superlative is not stored', () => {
            expect(fieldsToCases(fields, { keskvorre: 'toredam', ulivorre: 'leftover', periphrasticSuperlative: true })).toEqual([
                { caseName: 'keskvorreEE', word: 'toredam' },
                { caseName: CASE_NAME, word: 'true' },
            ]);
        });

        it('unchecked: the flag is not stored and the superlative is', () => {
            expect(fieldsToCases(fields, { keskvorre: 'suurem', ulivorre: 'suurim', periphrasticSuperlative: false })).toEqual([
                { caseName: 'keskvorreEE', word: 'suurem' },
                { caseName: 'ulivorreEE', word: 'suurim' },
            ]);
        });

        it('hydrates the checkbox from a stored "true", and leaves it unchecked otherwise', () => {
            expect(casesToFieldValues(fields, [{ caseName: CASE_NAME, word: 'true' }]).periphrasticSuperlative).toBe(true);
            expect(casesToFieldValues(fields, []).periphrasticSuperlative).toBe(false);
        });
    });

    it('encodes a multi-select selection into the acronym string', () => {
        expect(fieldsToCases([multiSelect], { verbCases: ['accusativeDE', 'genitiveDE'] })).toEqual([
            { caseName: CASE_NAME, word: 'AG' },
        ]);
    });

    it('drops a multi-select field when nothing is selected (encodes to "")', () => {
        expect(fieldsToCases([multiSelect], { verbCases: [] })).toEqual([]);
    });

    describe('casesToFieldValues (the encode round trip)', () => {
        it('decodes the stored acronym back into the selected option values', () => {
            expect(casesToFieldValues([multiSelect], [{ caseName: CASE_NAME, word: 'AG' }])).toEqual({
                verbCases: ['accusativeDE', 'genitiveDE'],
            });
        });

        it('round-trips through encode then decode unchanged', () => {
            const selected = ['dativeDE', 'genitiveDE'];
            const encoded = multiSelect.encode(selected);
            const decoded = multiSelect.decode(encoded);
            expect(decoded).toEqual(selected);
        });

        it('defaults an absent multi-select case to an empty selection', () => {
            expect(casesToFieldValues([multiSelect], [])).toEqual({ verbCases: [] });
        });
    });
});

describe('groupHeadingsToPrint', () => {
    const present: FieldConfig = {
        kind: 'text',
        name: 'presentEN',
        caseName: CASE_NAME,
        labelKey: 'presentEN',
        required: false,
        lowercase: true,
        group: [{ heading: 'Present', level: 2 }],
    };
    const presentTwo: FieldConfig = { ...present, name: 'presentEN2' };
    const past: FieldConfig = { ...present, name: 'pastEN', group: [{ heading: 'Past', level: 2 }] };
    const ungrouped: FieldConfig = { ...present, name: 'regularity', group: undefined };

    const indicativePresent: FieldConfig = {
        ...present,
        name: 'indicativePresentES',
        group: [
            { heading: 'Modo indicativo', level: 1 },
            { heading: 'Tiempo simple', level: 2 },
            { heading: 'Presente', level: 2 },
        ],
    };
    const indicativeImperfect: FieldConfig = {
        ...indicativePresent,
        name: 'indicativeImperfectES',
        group: [
            { heading: 'Modo indicativo', level: 1 },
            { heading: 'Tiempo simple', level: 2 },
            { heading: 'Pret. imperfecto', level: 2 },
        ],
    };

    it('prints the whole stack for the first field of a group', () => {
        expect(groupHeadingsToPrint([present], 0)).toEqual([{ heading: 'Present', level: 2 }]);
    });

    it('prints nothing for a later field in the same group', () => {
        expect(groupHeadingsToPrint([present, presentTwo], 1)).toEqual([]);
    });

    it('prints again once the group heading changes', () => {
        expect(groupHeadingsToPrint([present, past], 1)).toEqual([{ heading: 'Past', level: 2 }]);
    });

    it('prints nothing for a field with no group at all', () => {
        expect(groupHeadingsToPrint([ungrouped], 0)).toEqual([]);
    });

    it('prints the stack for a grouped field directly following an ungrouped one', () => {
        expect(groupHeadingsToPrint([ungrouped, present], 1)).toEqual([{ heading: 'Present', level: 2 }]);
    });

    it('prints only the tail that changed in a multi-level stack', () => {
        expect(groupHeadingsToPrint([indicativePresent, indicativeImperfect], 1)).toEqual([
            { heading: 'Pret. imperfecto', level: 2 },
        ]);
    });

    it('prints the full multi-level stack the first time it appears', () => {
        expect(groupHeadingsToPrint([indicativePresent], 0)).toEqual(indicativePresent.group);
    });
});

describe('fieldsHaveData', () => {
    const base = { caseName: CASE_NAME, labelKey: 'x', required: false };
    const text: FieldConfig = { ...base, kind: 'text', name: 'singular', lowercase: false };
    const radio: FieldConfig = {
        ...base,
        kind: 'radio',
        name: 'gender',
        persisted: false,
        options: [{ value: 'Neutral', label: 'Neutral' }],
    };
    const checkbox: FieldConfig = { ...base, kind: 'checkbox', name: 'searchInEnglish', persisted: false };
    const multi: FieldConfig = {
        ...base,
        kind: 'multi-select',
        name: 'verbCases',
        options: [{ value: 'dativeDE', label: 'Dative' }],
        encode: () => '',
        decode: () => [],
    };

    it('is false for blank, whitespace-only and default values', () => {
        expect(fieldsHaveData([text, radio, multi], { singular: '', gender: '', verbCases: [] })).toBe(false);
        expect(fieldsHaveData([text], { singular: '   ' })).toBe(false);
    });

    it('counts typed text, a chosen radio (even one that is never persisted) and a ticked option', () => {
        expect(fieldsHaveData([text], { singular: 'house' })).toBe(true);
        expect(fieldsHaveData([radio], { gender: 'Neutral' })).toBe(true);
        expect(fieldsHaveData([multi], { verbCases: ['dativeDE'] })).toBe(true);
    });

    it('ignores a form-only checkbox — a ticked "search in English" alone is not data', () => {
        expect(fieldsHaveData([checkbox], { searchInEnglish: true })).toBe(false);
    });
});
