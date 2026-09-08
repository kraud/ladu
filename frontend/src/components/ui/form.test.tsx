import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';
import { Input } from './input';

/**
 * form.tsx is hand-authored (see its header comment) rather than
 * CLI-generated, so it has no upstream test coverage to lean on.
 * Exercised here before Slice 3's auth forms are the first real caller.
 */
function EmailField() {
    const form = useForm({ defaultValues: { email: '' }, mode: 'onSubmit' });
    const onSubmit = form.handleSubmit(() => {});
    return (
        <Form {...form}>
            <form onSubmit={onSubmit} noValidate>
                <FormField
                    control={form.control}
                    name="email"
                    rules={{ required: 'Email is required' }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <button type="submit">Submit</button>
            </form>
        </Form>
    );
}

describe('form.tsx (hand-authored RHF bridge)', () => {
    it('associates the label with the control via a generated id', () => {
        render(<EmailField />);
        const input = screen.getByLabelText('Email');
        expect(input).toHaveAttribute('id');
        expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('shows the RHF error message and flips aria-invalid on failed validation', async () => {
        const user = userEvent.setup();
        render(<EmailField />);
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => {
            expect(screen.getByText('Email is required')).toBeInTheDocument();
        });
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });
});
