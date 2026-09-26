import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import { makeAutocompleteHandlers } from '@/test/msw/autocompleteHandlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { AutocompleteRow } from './AutocompleteRow';
import { getFormConfig } from './configs';

const enVerbFields = getFormConfig(PartOfSpeech.verb, Lang.EN)!.fields;
const enNounFields = getFormConfig(PartOfSpeech.noun, Lang.EN)!.fields;
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
            <Harness lang={Lang.EN} pos={PartOfSpeech.noun} fields={enNounFields} defaultValues={{}} />
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
                foundVerb: true,
                verbData: {
                    language: 'English',
                    cases: [
                        { caseName: 'simplePresent1sEN', word: 'run' },
                        { caseName: 'simplePresent3sEN', word: 'runs' },
                    ],
                },
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
                foundVerb: true,
                verbData: { language: 'English', cases: [{ caseName: 'simplePresent3sEN', word: 'runs' }] },
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
                foundVerb: true,
                verbData: { language: 'English', cases: [{ caseName: 'simplePresent1sEN', word: 'run' }] },
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
                foundVerb: true,
                verbData: {
                    language: 'English',
                    cases: [
                        { caseName: 'simplePresent1sEN', word: 'run' },
                        { caseName: 'simplePresent3sEN', word: 'runs' },
                    ],
                },
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

    it('shows a "not found" status and renders no Autocomplete button — nothing to fill', async () => {
        const fake = makeAutocompleteHandlers({ englishVerb: { foundVerb: false } });
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
                foundVerb: true,
                verbData: {
                    language: 'English',
                    cases: [
                        { caseName: 'simplePresent1sEN', word: 'run' },
                        { caseName: 'simplePresent2sEN', word: 'run' },
                        { caseName: 'simplePresent3sEN', word: 'runs' },
                    ],
                },
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
            estonianVerb: { searchResult: [{ wordClasses: ['verb'], wordForms: [{ code: 'Sup', value: 'jooksma' }] }] },
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
        expect(fake.requests[0].query).toBe('jooksma');
    });
});
