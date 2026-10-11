import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TagIcon } from '@phosphor-icons/react';
import { PageTitle } from './PageTitle';

describe('PageTitle', () => {
    it('is a heading named by its text, with a decorative accent icon on the left', () => {
        render(<PageTitle icon={TagIcon}>Spring words</PageTitle>);
        const heading = screen.getByRole('heading', { level: 1, name: 'Spring words' });
        const icon = heading.querySelector('svg');
        // The icon's wrapper is hidden from assistive technology: the heading's name is the text.
        expect(heading.firstElementChild).toHaveAttribute('aria-hidden', 'true');
        expect(icon).toHaveClass('text-(--accent)');
        expect(heading.firstElementChild).toContainElement(icon as SVGElement);
        // A plain title keeps the plain row.
        expect(heading.className).not.toContain('-ml-1');
    });

    it('a section title lines up with the phone header: an icon column as wide as the hamburger button, and the logo\'s start', () => {
        render(<PageTitle icon={TagIcon} section>Tags</PageTitle>);
        const heading = screen.getByRole('heading', { name: 'Tags' });
        expect(heading).toHaveClass('max-[920px]:-ml-1', 'max-[920px]:gap-3');
        expect(heading.firstElementChild).toHaveClass('max-[920px]:w-10', 'max-[920px]:justify-center');
    });
});
