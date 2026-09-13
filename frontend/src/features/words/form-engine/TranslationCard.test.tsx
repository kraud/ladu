import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Lang, NounCases, PartOfSpeech, VerbCases } from '@/ts/enums';
import type { FieldConfig } from './configs/types';
import { casesToFieldValues, fieldsToCases, groupHeadingsToPrint, TranslationCard } from './TranslationCard';

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

    it('hydrates from initialCases', () => {
        renderWithProviders(
            <TranslationCard lang={Lang.EN} initialCases={[{ caseName: NounCases.singularEN, word: 'cat' }]} />
        );
        expect(screen.getByDisplayValue('cat')).toBeInTheDocument();
    });

    it('shows Clear and Remove actions unless displayOnly', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} />);
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('hides Clear/Remove in displayOnly mode', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} displayOnly />);
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('disables Remove when removeDisabled is set', () => {
        renderWithProviders(<TranslationCard lang={Lang.EN} removeDisabled />);
        expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    });

    it('calls onChange with completionState:false while the required field is empty', () => {
        const onChange = vi.fn();
        renderWithProviders(<TranslationCard lang={Lang.EN} onChange={onChange} />);

        expect(onChange).toHaveBeenCalledWith({ cases: [], completionState: false, isDirty: false });
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
            expect(onChange).toHaveBeenLastCalledWith({ cases: [], completionState: false, isDirty: false }),
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

    it('mounts a German verb card with select, multi-select, and a conjugated-auxiliary adornment', async () => {
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
        expect(screen.getByRole('combobox', { name: 'Auxiliary verb' })).toHaveTextContent('haben');
        expect(screen.getByText('Accusative')).toBeInTheDocument();
        // The Perfect tense's adornment reflects the hydrated auxiliaryVerb ("haben" -> "habe" for 1s).
        expect(screen.getByText('habe')).toBeInTheDocument();

        await user.click(screen.getByRole('combobox', { name: 'Auxiliary verb' }));
        await user.click(screen.getByRole('option', { name: 'sein' }));
        await waitFor(() => expect(screen.getByText('bin')).toBeInTheDocument());
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

    it('there is no Estonian adverb card', () => {
        renderWithProviders(<TranslationCard lang={Lang.EE} pos={PartOfSpeech.adverb} />);
        expect(screen.getByText('That language is not available yet')).toBeInTheDocument();
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

    it('still drops checkboxes (no PoS backs a case with one)', () => {
        const checkbox: FieldConfig = {
            kind: 'checkbox',
            name: 'searchInEnglish',
            caseName: CASE_NAME,
            labelKey: 'searchInEnglish',
            required: false,
        };
        expect(fieldsToCases([checkbox], { searchInEnglish: true })).toEqual([]);
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
