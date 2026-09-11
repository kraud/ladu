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
    caseName: radioField.caseName,
    labelKey: 'wordRelated:wordForm.noun.errors.formEE.searchInEnglishLabel',
    required: false,
};

function Harness({ field, displayOnly, value }: { field: FieldConfig; displayOnly?: boolean; value?: unknown }) {
    const form = useForm({ defaultValues: { [field.name]: value ?? (field.kind === 'checkbox' ? false : '') } });
    return (
        <Form {...form}>
            <FieldRenderer field={field} displayOnly={displayOnly} />
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
});
