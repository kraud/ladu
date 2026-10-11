import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TagIcon } from '@phosphor-icons/react';
import { PageTitle } from './PageTitle';

describe('PageTitle', () => {
    it('is a heading named by its text, with a decorative accent icon on the left', () => {
        render(<PageTitle icon={TagIcon}>Spring words</PageTitle>);
        const heading = screen.getByRole('heading', { level: 1, name: 'Spring words' });
        const icon = heading.querySelector('svg');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon).toHaveClass('text-(--accent)', 'shrink-0');
        expect(heading.firstElementChild).toBe(icon);
    });
});
