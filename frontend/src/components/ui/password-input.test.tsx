import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
    it('hides the value by default and shows it after the eye button is pressed', async () => {
        render(<PasswordInput placeholder="pw" />);
        const input = screen.getByPlaceholderText('pw');
        expect(input).toHaveAttribute('type', 'password');

        await userEvent.click(screen.getByRole('button'));
        expect(input).toHaveAttribute('type', 'text');

        await userEvent.click(screen.getByRole('button'));
        expect(input).toHaveAttribute('type', 'password');
    });
});
