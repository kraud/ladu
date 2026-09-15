import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form } from '@/components/ui/form';
import { renderWithProviders } from '@/test/render';
import { Lang, PartOfSpeech } from '@/ts/enums';
import { getFormConfig } from './configs';
import type { FieldConfig } from './configs/types';
import { FieldRenderer } from './FieldRenderer';

const enConfig = getFormConfig(PartOfSpeech.noun, Lang.EN)!;
const esConfig = getFormConfig(PartOfSpeech.noun, Lang.ES)!;

const textField = enConfig.fields.find((f) => f.name === 'singular')!;
const radioField = enConfig.fields.find((f) => f.name === 'regularity')!;
const genderField = esConfig.fields.find((f) => f.name === 'gender')!;

const checkboxField: FieldConfig = {
    kind: 'checkbox',
    name: 'searchInEnglish',
    caseName: radioField.caseName!,
    labelKey: 'wordRelated:wordForm.noun.errors.formEE.searchInEnglishLabel',
    required: false,
};

const selectField: FieldConfig = {
    kind: 'select',
    name: 'auxiliaryVerb',
    caseName: radioField.caseName!,
    labelKey: 'auxiliaryVerb',
    required: true,
    options: [
        { value: 'haben', label: 'haben' },
        { value: 'sein', label: 'sein' },
    ],
};

const toggleField: FieldConfig = {
    kind: 'toggle',
    name: 'auxiliaryVerb',
    caseName: radioField.caseName!,
    labelKey: 'auxiliaryVerb',
    required: false,
    options: [
        { value: 'haben', label: 'haben' },
        { value: 'sein', label: 'sein' },
    ],
};

const multiSelectField: FieldConfig = {
    kind: 'multi-select',
    name: 'verbCases',
    caseName: radioField.caseName!,
    labelKey: 'verbCases',
    required: false,
    options: [
        { value: 'accusativeDE', label: 'Accusative' },
        { value: 'dativeDE', label: 'Dative' },
        { value: 'genitiveDE', label: 'Genitive' },
    ],
    encode: (selected) => selected.join(','),
    decode: (word) => (word ? word.split(',') : []),
};

const visibleWhenField: FieldConfig = {
    kind: 'text',
    name: 'neutralSingular',
    caseName: radioField.caseName!,
    labelKey: 'neutralSingular',
    required: true,
    lowercase: true,
    visibleWhen: { field: 'gender', equals: 'Neutral' },
};

const adornedField: FieldConfig = {
    kind: 'text',
    name: 'indicativePerfect1s',
    caseName: radioField.caseName!,
    labelKey: 'indicativePerfect1s',
    required: false,
    lowercase: true,
    adornment: { watchField: 'auxiliaryVerb', values: { haben: 'habe', sein: 'bin' } },
};

function defaultValueFor(field: FieldConfig): unknown {
    if (field.kind === 'checkbox') return false;
    if (field.kind === 'multi-select') return [];
    return '';
}

function Harness({ field, displayOnly, value }: { field: FieldConfig; displayOnly?: boolean; value?: unknown }) {
    const form = useForm({ defaultValues: { [field.name]: value ?? defaultValueFor(field) } });
    return (
        <Form {...form}>
            <FieldRenderer field={field} displayOnly={displayOnly} />
        </Form>
    );
}

/** Mounts several fields on one shared RHF instance — for cases where one field's rendering depends on a sibling's live value (`visibleWhen`, `adornment`). */
function MultiHarness({ fields, defaultValues }: { fields: FieldConfig[]; defaultValues: Record<string, unknown> }) {
    const form = useForm({ defaultValues });
    return (
        <Form {...form}>
            {fields.map((f) => (
                <FieldRenderer key={f.name} field={f} />
            ))}
        </Form>
    );
}

describe('FieldRenderer', () => {
    it('renders a text field as an editable input', () => {
        renderWithProviders(<Harness field={textField} />);
        expect(screen.getByLabelText('Singular')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders a radio field with one option per value', () => {
        renderWithProviders(<Harness field={radioField} />);
        expect(screen.getByText('Regularity')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'regular' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'irregular' })).toBeInTheDocument();
    });

    it('renders a checkbox field', () => {
        renderWithProviders(<Harness field={checkboxField} />);
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('lets the user pick a radio option', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Harness field={radioField} />);
        const irregular = screen.getByRole('radio', { name: 'irregular' });
        await user.click(irregular);
        expect(irregular).toBeChecked();
    });

    it('clicking an already-selected radio option unselects it', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Harness field={radioField} value="irregular" />);
        const irregular = screen.getByRole('radio', { name: 'irregular' });
        expect(irregular).toBeChecked();

        await user.click(irregular);

        expect(irregular).not.toBeChecked();
        expect(screen.getByRole('radio', { name: 'regular' })).not.toBeChecked();
    });

    it('displayOnly: hides a non-required empty field entirely', () => {
        renderWithProviders(<Harness field={radioField} displayOnly value="" />);
        expect(screen.queryByText('Regularity')).not.toBeInTheDocument();
    });

    it('displayOnly: still shows a required field, as static text (not an input)', () => {
        renderWithProviders(<Harness field={textField} displayOnly value="cat" />);
        expect(screen.getByText('Singular')).toBeInTheDocument();
        expect(screen.getByText('cat')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('displayOnly: a required-but-empty field still renders (never gated)', () => {
        renderWithProviders(<Harness field={genderField} displayOnly value="" />);
        expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('displayOnly: a non-required field with a value still renders', () => {
        renderWithProviders(<Harness field={radioField} displayOnly value="regular" />);
        expect(screen.getByText('Regularity')).toBeInTheDocument();
        expect(screen.getByText('regular')).toBeInTheDocument();
    });

    describe('select field', () => {
        it('renders a select with one option per value and lets the user pick one', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness field={selectField} />);

            await user.click(screen.getByRole('combobox'));
            const option = await screen.findByRole('option', { name: 'sein' });
            await user.click(option);

            expect(screen.getByRole('combobox')).toHaveTextContent('sein');
        });

        it('displayOnly: shows the matched option label as static text', () => {
            renderWithProviders(<Harness field={selectField} displayOnly value="haben" />);
            expect(screen.getByText('haben')).toBeInTheDocument();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });
    });

    describe('toggle field', () => {
        it('renders both options at once and lets the user pick one', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness field={toggleField} />);

            const haben = screen.getByRole('radio', { name: 'haben' });
            const sein = screen.getByRole('radio', { name: 'sein' });
            expect(haben).not.toBeChecked();
            expect(sein).not.toBeChecked();

            await user.click(sein);

            expect(sein).toBeChecked();
            expect(haben).not.toBeChecked();
        });

        it('clicking the already-active option clears the selection', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness field={toggleField} value="haben" />);
            const haben = screen.getByRole('radio', { name: 'haben' });
            expect(haben).toBeChecked();

            await user.click(haben);

            expect(haben).not.toBeChecked();
            expect(screen.getByRole('radio', { name: 'sein' })).not.toBeChecked();
        });

        it('displayOnly: shows the matched option label as static text', () => {
            renderWithProviders(<Harness field={toggleField} displayOnly value="sein" />);
            expect(screen.getByText('sein')).toBeInTheDocument();
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        });
    });

    describe('multi-select field', () => {
        it('renders one checkbox per option and toggles independently', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Harness field={multiSelectField} />);

            const accusative = screen.getByRole('checkbox', { name: 'Accusative' });
            const dative = screen.getByRole('checkbox', { name: 'Dative' });
            expect(accusative).not.toBeChecked();

            await user.click(accusative);
            await user.click(dative);

            expect(accusative).toBeChecked();
            expect(dative).toBeChecked();
            expect(screen.getByRole('checkbox', { name: 'Genitive' })).not.toBeChecked();
        });

        it('displayOnly: joins the selected labels', () => {
            renderWithProviders(
                <Harness field={multiSelectField} displayOnly value={['accusativeDE', 'genitiveDE']} />,
            );
            expect(screen.getByText('Accusative, Genitive')).toBeInTheDocument();
        });

        it('displayOnly: an empty selection is hidden (non-required, empty)', () => {
            renderWithProviders(<Harness field={multiSelectField} displayOnly value={[]} />);
            expect(screen.queryByText('verbCases')).not.toBeInTheDocument();
        });
    });

    describe('visibleWhen', () => {
        const genderField: FieldConfig = {
            kind: 'radio',
            name: 'gender',
            caseName: radioField.caseName!,
            labelKey: 'gender',
            required: true,
            options: [
                { value: 'Neutral', label: 'Neutral' },
                { value: 'M/F', label: 'M/F' },
            ],
        };

        it('hides the field until the controlling sibling matches, and shows it once it does', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <MultiHarness
                    fields={[genderField, visibleWhenField]}
                    defaultValues={{ gender: 'M/F', neutralSingular: '' }}
                />,
            );

            expect(screen.queryByLabelText('neutralSingular')).not.toBeInTheDocument();

            await user.click(screen.getByRole('radio', { name: 'Neutral' }));
            expect(screen.getByLabelText('neutralSingular')).toBeInTheDocument();

            await user.click(screen.getByRole('radio', { name: 'M/F' }));
            expect(screen.queryByLabelText('neutralSingular')).not.toBeInTheDocument();
        });
    });

    describe('adornment', () => {
        it('shows the prefix mapped from the watched sibling value, and none when there is no entry', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <MultiHarness
                    fields={[selectField, adornedField]}
                    defaultValues={{ auxiliaryVerb: '', indicativePerfect1s: '' }}
                />,
            );

            expect(screen.queryByText('habe')).not.toBeInTheDocument();

            await user.click(screen.getByRole('combobox'));
            await user.click(await screen.findByRole('option', { name: 'haben' }));
            expect(screen.getByText('habe')).toBeInTheDocument();
        });
    });
});
