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

    it('fires the lookup automatically once the debounced query settles, and shows a "found" status', async () => {
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

        await waitFor(() => expect(fake.requests).toHaveLength(1), { timeout: 2000 });
        await waitFor(
            () => expect(screen.getByTestId('autocomplete-status')).toHaveTextContent(/information about this word/i),
            { timeout: 2000 }
        );
        expect(screen.getByRole('button', { name: /fill in/i })).toBeEnabled();
    });

    it('shows a "not found" status and keeps the Fill button disabled', async () => {
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
        expect(screen.getByRole('button', { name: /fill in/i })).toBeDisabled();
    });

    it('Fill only writes into empty fields — a pre-filled sibling is left untouched', async () => {
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

        function FillHarness() {
            const form = useForm({
                defaultValues: { simplePresent1s: 'run', simplePresent2s: 'ALREADY TYPED', simplePresent3s: '' },
            });
            return (
                <Form {...form}>
                    <AutocompleteRow lang={Lang.EN} pos={PartOfSpeech.verb} fields={enVerbFields} />
                    <input aria-label="simplePresent2s-probe" readOnly value={form.watch('simplePresent2s')} />
                    <input aria-label="simplePresent3s-probe" readOnly value={form.watch('simplePresent3s')} />
                </Form>
            );
        }

        renderWithProviders(<FillHarness />);

        await waitFor(() => expect(screen.getByRole('button', { name: /fill in/i })).toBeEnabled(), { timeout: 2000 });
        await user.click(screen.getByRole('button', { name: /fill in/i }));

        expect(screen.getByLabelText('simplePresent2s-probe')).toHaveValue('ALREADY TYPED');
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
