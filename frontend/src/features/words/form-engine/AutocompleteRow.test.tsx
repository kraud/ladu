import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import { makeAutocompleteHandlers } from '@/test/msw/autocompleteHandlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Lang, PartOfSpeech } from '@/ts/enums';
import type { DictionaryResponse } from '@/features/autocomplete/types';
import { AutocompleteRow, LOOKUP_DEBOUNCE_MS } from './AutocompleteRow';
import { getFormConfig } from './configs';

const enVerbFields = getFormConfig(PartOfSpeech.verb, Lang.EN)!.fields;
const esAdjectiveFields = getFormConfig(PartOfSpeech.adjective, Lang.ES)!.fields;
const deAdverbFields = getFormConfig(PartOfSpeech.adverb, Lang.DE)!.fields;
const deVerbFields = getFormConfig(PartOfSpeech.verb, Lang.DE)!.fields;
const eeVerbFields = getFormConfig(PartOfSpeech.verb, Lang.EE)!.fields;

function Harness({
    lang,
    pos,
    fields,
    defaultValues,
}: {
    lang: Lang;
    pos: PartOfSpeech;
    fields: typeof enVerbFields;
    defaultValues: Record<string, unknown>;
}) {
    const form = useForm({ defaultValues });
    return (
        <Form {...form}>
            <AutocompleteRow lang={lang} pos={pos} fields={fields} />
        </Form>
    );
}

describe('AutocompleteRow', () => {
    it('renders nothing for a (language, PoS) pair with no lookup endpoint', () => {
        const { container } = renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.preposition} fields={[]} defaultValues={{}} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows just the magnifying-glass icon and a support label before any query is typed', () => {
        renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} defaultValues={{ simplePresent1s: '' }} />
        );
        expect(screen.getByText('Autocomplete support')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /autocomplete/i })).not.toBeInTheDocument();
    });

    it('fires the lookup automatically once the debounced query settles, and shows the "use values" button while a found case is still blank — no status text once a match exists', async () => {
        const fake = makeAutocompleteHandlers({
            englishVerb: {
                status: 'found',
                cases: [
                    { caseName: 'simplePresent1sEN', word: 'run' },
                    { caseName: 'simplePresent3sEN', word: 'runs' },
                ],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} defaultValues={{ simplePresent1s: 'run' }} />
        );

        await waitFor(() => expect(fake.requests).toHaveLength(1), { timeout: 2000 });
        // `simplePresent3s` is still blank while the lookup has "runs" for it — not a match yet.
        await waitFor(
            () => expect(screen.getByRole('button', { name: /use autocomplete values/i })).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(screen.queryByTestId('autocomplete-status')).not.toBeInTheDocument();
    });

    it('draws the ready button in the brand colour (accent fill, border and text), in both themes', async () => {
        const fake = makeAutocompleteHandlers({
            englishVerb: {
                status: 'found',
                cases: [{ caseName: 'simplePresent3sEN', word: 'runs' }],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} defaultValues={{ simplePresent1s: 'run' }} />
        );

        const button = await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 });
        expect(button).toHaveClass('border-(--accent)', 'bg-(--accent-soft)', 'text-(--accent-strong)');
        // The outline variant's own dark fill/border must be overridden too.
        expect(button).toHaveClass('dark:border-(--accent)', 'dark:bg-(--accent-soft)');
    });

    it('shows "values applied" instead of a button once every case the lookup found already matches the form — no click needed', async () => {
        // Mirrors opening an existing translation that was originally saved
        // from this same autocomplete suggestion: the query field is already
        // hydrated, the lookup fires on mount, and its one case (the query
        // field's own value) already matches.
        const fake = makeAutocompleteHandlers({
            englishVerb: {
                status: 'found',
                cases: [{ caseName: 'simplePresent1sEN', word: 'run' }],
            },
        });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} defaultValues={{ simplePresent1s: 'run' }} />
        );

        await waitFor(() => expect(screen.getByText('Autocomplete values applied')).toBeInTheDocument(), {
            timeout: 2000,
        });
        expect(screen.queryByRole('button', { name: /use autocomplete values/i })).not.toBeInTheDocument();
    });

    it('reverts to the button once an edit makes a previously-matching field disagree with the already-fetched lookup — no new request', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            englishVerb: {
                status: 'found',
                cases: [
                    { caseName: 'simplePresent1sEN', word: 'run' },
                    { caseName: 'simplePresent3sEN', word: 'runs' },
                ],
            },
        });
        server.use(...fake.handlers);

        function SiblingFieldHarness() {
            const form = useForm({ defaultValues: { simplePresent1s: 'run', simplePresent3s: 'runs' } });
            return (
                <Form {...form}>
                    <AutocompleteRow lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} />
                    <input aria-label="simplePresent3s-editable" {...form.register('simplePresent3s')} />
                </Form>
            );
        }

        renderWithProviders(<SiblingFieldHarness />);

        await waitFor(() => expect(screen.getByText('Autocomplete values applied')).toBeInTheDocument(), {
            timeout: 2000,
        });

        // Editing the *query* field itself re-fires the lookup — instead,
        // edit the sibling field the lookup already has an answer for, and
        // see the comparison flip on its own, with no additional request.
        await user.clear(screen.getByLabelText('simplePresent3s-editable'));
        await user.type(screen.getByLabelText('simplePresent3s-editable'), 'sprints');

        await waitFor(
            () => expect(screen.getByRole('button', { name: /use autocomplete values/i })).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(fake.requests).toHaveLength(1);
    });

    it('a partial result (a guess) shows the "not fully sure" notice next to the button, and keeps it after applying', async () => {
        const user = userEvent.setup();
        const fake = makeAutocompleteHandlers({
            spanishNoun: {
                status: 'partial',
                cases: [
                    { caseName: 'genderES', word: 'la' },
                    { caseName: 'singularES', word: 'zorplata' },
                ],
            },
        });
        server.use(...fake.handlers);
        const esNounFields = getFormConfig(PartOfSpeech.noun, Lang.ES)!.fields;

        renderWithProviders(
            <Harness lang={Lang.ES} pos={PartOfSpeech.noun} fields={esNounFields} defaultValues={{ singular: 'zorplata' }} />
        );

        const button = await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 });
        expect(screen.getByTestId('autocomplete-partial')).toHaveTextContent("We're not fully sure, but here's our best guess.");

        await user.click(button);
        await waitFor(() => expect(screen.getByText('Autocomplete values applied')).toBeInTheDocument());
        expect(screen.getByTestId('autocomplete-partial')).toBeInTheDocument();
    });

    it('a found result shows no "not fully sure" notice', async () => {
        const fake = makeAutocompleteHandlers({
            englishVerb: { status: 'found', cases: [{ caseName: 'simplePresent3sEN', word: 'runs' }] },
        });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} defaultValues={{ simplePresent1s: 'run' }} />
        );

        await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 });
        expect(screen.queryByTestId('autocomplete-partial')).not.toBeInTheDocument();
    });

    it('shows a "not found" status and renders no Autocomplete button — nothing to fill', async () => {
        const fake = makeAutocompleteHandlers({ englishVerb: { status: 'not-found', cases: [] } });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness
                lang={Lang.EN}
                pos={PartOfSpeech.verb}
                fields={enVerbFields}
                defaultValues={{ simplePresent1s: 'zzzznotaverb' }}
            />
        );

        await waitFor(() => expect(screen.getByTestId('autocomplete-status')).toHaveTextContent(/don't know this word/i), {
            timeout: 2000,
        });
        expect(screen.queryByRole('button', { name: /autocomplete/i })).not.toBeInTheDocument();
    });

    it('Apply overwrites every field the lookup found, including one that already holds a different (potentially wrong) value', async () => {
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

        function ApplyHarness() {
            const form = useForm({
                defaultValues: { simplePresent1s: 'run', simplePresent2s: 'WRONG VALUE', simplePresent3s: '' },
            });
            return (
                <Form {...form}>
                    <AutocompleteRow lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} />
                    <input aria-label="simplePresent2s-probe" readOnly value={form.watch('simplePresent2s')} />
                    <input aria-label="simplePresent3s-probe" readOnly value={form.watch('simplePresent3s')} />
                </Form>
            );
        }

        renderWithProviders(<ApplyHarness />);

        await waitFor(() => expect(screen.getByRole('button', { name: /use autocomplete values/i })).toBeInTheDocument(), {
            timeout: 2000,
        });
        await user.click(screen.getByRole('button', { name: /use autocomplete values/i }));

        // The pre-existing (wrong) value is replaced, not preserved.
        expect(screen.getByLabelText('simplePresent2s-probe')).toHaveValue('run');
        expect(screen.getByLabelText('simplePresent3s-probe')).toHaveValue('runs');
    });

    it('reads the Estonian searchInEnglish checkbox as the extra query param', async () => {
        const fake = makeAutocompleteHandlers({
            estonianVerb: { status: 'found', cases: [{ caseName: 'infinitiveMaEE', word: 'jooksma' }] },
        });
        server.use(...fake.handlers);

        renderWithProviders(
            <Harness
                lang={Lang.EE}
                pos={PartOfSpeech.verb}
                fields={eeVerbFields}
                defaultValues={{ infinitiveMa: 'jooksma', searchInEnglish: true }}
            />
        );

        await waitFor(() => expect(fake.requests).toHaveLength(1), { timeout: 2000 });
        expect(fake.requests[0]).toEqual({ path: 'Estonian/Verb', query: 'jooksma', searchInEnglish: true, entry: null });
    });
    describe('adjectives and adverbs (Slice H3)', () => {
        /** Shows the form values the lookup writes, so a test can read hidden-branch fields too. */
        function Probe({ lang, pos, fields, defaultValues, names }: { lang: Lang; pos: PartOfSpeech; fields: typeof enVerbFields; defaultValues: Record<string, unknown>; names: string[] }) {
            const form = useForm({ defaultValues });
            return (
                <Form {...form}>
                    <AutocompleteRow lang={lang} pos={pos} fields={fields} />
                    {names.map((name) => (
                        <input key={name} aria-label={`${name}-probe`} readOnly value={String(form.watch(name) ?? '')} />
                    ))}
                </Form>
            );
        }

        const NEUTRAL: DictionaryResponse = { status: 'found', cases: [{ caseName: 'neutralSingularES', word: 'feliz' }, { caseName: 'neutralPluralES', word: 'felices' }] };
        const GENDERED: DictionaryResponse = {
            status: 'found',
            cases: [
                { caseName: 'maleSingularES', word: 'rojo' },
                { caseName: 'malePluralES', word: 'rojos' },
                { caseName: 'femaleSingularES', word: 'roja' },
                { caseName: 'femalePluralES', word: 'rojas' },
            ],
        };
        const SPANISH = ['gender', 'neutralSingular', 'neutralPlural', 'maleSingular', 'femaleSingular', 'femalePlural'];

        it('Spanish: a Neutral word typed while M/F is chosen switches the card to Neutral and fills its fields', async () => {
            const user = userEvent.setup();
            const fake = makeAutocompleteHandlers({ spanishAdjective: NEUTRAL });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.ES} pos={PartOfSpeech.adjective} fields={esAdjectiveFields} defaultValues={{ gender: 'M/F', maleSingular: 'feliz' }} names={SPANISH} />
            );

            await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));

            expect(fake.requests[0]).toMatchObject({ path: 'Spanish/Adjective', query: 'feliz' });
            expect(screen.getByLabelText('gender-probe')).toHaveValue('Neutral');
            expect(screen.getByLabelText('neutralSingular-probe')).toHaveValue('feliz');
            expect(screen.getByLabelText('neutralPlural-probe')).toHaveValue('felices');
        });

        it('Spanish: a gendered word fills the M/F cells; the query is read from the Neutral field when that branch is shown', async () => {
            const user = userEvent.setup();
            const fake = makeAutocompleteHandlers({ spanishAdjective: GENDERED });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.ES} pos={PartOfSpeech.adjective} fields={esAdjectiveFields} defaultValues={{ gender: 'Neutral', neutralSingular: 'rojo' }} names={SPANISH} />
            );

            await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));

            expect(fake.requests[0]).toMatchObject({ path: 'Spanish/Adjective', query: 'rojo' });
            expect(screen.getByLabelText('gender-probe')).toHaveValue('M/F');
            expect(screen.getByLabelText('femaleSingular-probe')).toHaveValue('roja');
            expect(screen.getByLabelText('femalePlural-probe')).toHaveValue('rojas');
        });

        it('Spanish: once the card shows the branch the lookup stands for, it reads "applied"', async () => {
            const fake = makeAutocompleteHandlers({ spanishAdjective: NEUTRAL });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.ES} pos={PartOfSpeech.adjective} fields={esAdjectiveFields} defaultValues={{ gender: 'Neutral', neutralSingular: 'feliz', neutralPlural: 'felices' }} names={SPANISH} />
            );
            await waitFor(() => expect(screen.getByText('Autocomplete values applied')).toBeInTheDocument(), { timeout: 2000 });
        });

        it('Spanish: no lookup before a gender is chosen (neither input is shown)', async () => {
            const fake = makeAutocompleteHandlers({ spanishAdjective: NEUTRAL });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.ES} pos={PartOfSpeech.adjective} fields={esAdjectiveFields} defaultValues={{}} names={SPANISH} />
            );
            await new Promise((resolve) => setTimeout(resolve, LOOKUP_DEBOUNCE_MS + 200));
            expect(fake.requests).toHaveLength(0);
        });

        it('an always-reflexive German verb: the lookup checks the "Reflexive verb" box (H5, D28)', async () => {
            const user = userEvent.setup();
            const fake = makeAutocompleteHandlers({
                germanVerb: { status: 'found', cases: [{ caseName: 'infinitiveDE', word: 'sputen' }, { caseName: 'reflexiveDE', word: 'true' }] },
            });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.DE} pos={PartOfSpeech.verb} fields={deVerbFields} defaultValues={{ infinitive: 'sputen', reflexive: false }} names={['reflexive']} />
            );

            await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));
            expect(screen.getByLabelText('reflexive-probe')).toHaveValue('true');
        });

        it('German adverb: the lookup sets Gradable first, so comparative and superlative are filled even after Non-gradable was chosen', async () => {
            const user = userEvent.setup();
            const fake = makeAutocompleteHandlers({
                germanAdverb: {
                    status: 'found',
                    cases: [
                        { caseName: 'gradableDE', word: 'Gradable' },
                        { caseName: 'adverbDE', word: 'oft' },
                        { caseName: 'comparativeDE', word: 'öfter' },
                        { caseName: 'superlativeDE', word: 'öftesten' },
                    ],
                },
            });
            server.use(...fake.handlers);
            renderWithProviders(
                <Probe lang={Lang.DE} pos={PartOfSpeech.adverb} fields={deAdverbFields} defaultValues={{ gradable: 'Non-gradable', adverb: 'oft' }} names={['gradable', 'comparative', 'superlative']} />
            );

            await user.click(await screen.findByRole('button', { name: /use autocomplete values/i }, { timeout: 2000 }));

            expect(screen.getByLabelText('gradable-probe')).toHaveValue('Gradable');
            expect(screen.getByLabelText('comparative-probe')).toHaveValue('öfter');
            expect(screen.getByLabelText('superlative-probe')).toHaveValue('öftesten');
        });
    });
});
