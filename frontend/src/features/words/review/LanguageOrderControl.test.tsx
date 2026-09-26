import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { LangKey } from '@/features/words/types';
import { LanguageOrderControl } from './LanguageOrderControl';

/** Wraps the control with locally-owned `active` state, for round-trip (hide-then-show) tests. */
function Controlled({ initialActive, allLanguages }: { initialActive: LangKey[]; allLanguages: LangKey[] }) {
    const [active, setActive] = useState(initialActive);
    return <LanguageOrderControl active={active} allLanguages={allLanguages} onChange={setActive} />;
}

describe('LanguageOrderControl — rendering', () => {
    it('renders every active and hidden language as a flag chip, with no visible text label', () => {
        const { container } = renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE']}
                allLanguages={['EN', 'DE', 'ES', 'EE']}
                onChange={vi.fn()}
            />,
        );
        expect(container.querySelector('[data-lang="EN"]')).toBeInTheDocument();
        expect(container.querySelector('[data-lang="DE"]')).toBeInTheDocument();
        expect(container.querySelector('[data-lang="ES"]')).toBeInTheDocument();
        expect(container.querySelector('[data-lang="EE"]')).toBeInTheDocument();
        // No 2-letter label or eye icon — only the flag toggle and the two arrows remain.
        expect(screen.queryByText('EN')).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-lang="EN"] button')).toHaveLength(3);
    });
});

describe('LanguageOrderControl — the ± / hide / show fallback (ui/00-global.md:69)', () => {
    it('moving a chip later reorders Active', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <LanguageOrderControl active={['EN', 'DE']} allLanguages={['EN', 'DE']} onChange={onChange} />,
        );
        await user.click(screen.getByRole('button', { name: 'Move English later' }));
        expect(onChange).toHaveBeenCalledWith(['DE', 'EN']);
    });

    it('the first chip cannot move earlier; the last cannot move later', () => {
        renderWithProviders(
            <LanguageOrderControl active={['EN', 'DE']} allLanguages={['EN', 'DE']} onChange={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: 'Move English earlier' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move Deutsch later' })).toBeDisabled();
    });

    it('hiding an active chip drops it, when above the floor', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE', 'ES']}
                allLanguages={['EN', 'DE', 'ES']}
                onChange={onChange}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Hide Deutsch' }));
        expect(onChange).toHaveBeenCalledWith(['EN', 'ES']);
    });

    it('hide is disabled once only MIN_VISIBLE_LANGUAGES remain', () => {
        renderWithProviders(
            <LanguageOrderControl active={['EN', 'DE']} allLanguages={['EN', 'DE']} onChange={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: 'Hide English' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Hide Deutsch' })).toBeDisabled();
    });

    it('showing a hidden chip appends it to Active', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE']}
                allLanguages={['EN', 'DE', 'ES']}
                onChange={onChange}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Show Español' }));
        expect(onChange).toHaveBeenCalledWith(['EN', 'DE', 'ES']);
    });

    it('a hidden chip has no working order — both its arrows are disabled', () => {
        renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE']}
                allLanguages={['EN', 'DE', 'ES']}
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: 'Move Español earlier' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move Español later' })).toBeDisabled();
    });

    it('a hidden chip renders with the greyed-out marker; a visible one does not', () => {
        const { container } = renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE']}
                allLanguages={['EN', 'DE', 'ES']}
                onChange={vi.fn()}
            />,
        );
        expect(container.querySelector('[data-lang="ES"]')).toHaveAttribute('data-hidden');
        expect(container.querySelector('[data-lang="EN"]')).not.toHaveAttribute('data-hidden');
    });

    it('clicking the flag itself toggles visibility — there is no separate icon button', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <LanguageOrderControl
                active={['EN', 'DE', 'ES']}
                allLanguages={['EN', 'DE', 'ES']}
                onChange={onChange}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Hide Deutsch' }));
        expect(onChange).toHaveBeenCalledWith(['EN', 'ES']);
    });
});

describe('LanguageOrderControl — hiding preserves position (round trip)', () => {
    function chipOrder(container: HTMLElement): (string | null)[] {
        return Array.from(container.querySelectorAll('.lang-chip')).map((el) => el.getAttribute('data-lang'));
    }

    it('a hidden language reappears where it was, not appended to the end', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <Controlled initialActive={['EN', 'DE', 'ES']} allLanguages={['EN', 'DE', 'ES']} />,
        );
        expect(chipOrder(container)).toEqual(['EN', 'DE', 'ES']);

        await user.click(screen.getByRole('button', { name: 'Hide Deutsch' }));
        // Position in the row is unchanged — only visibility flipped.
        expect(chipOrder(container)).toEqual(['EN', 'DE', 'ES']);

        await user.click(screen.getByRole('button', { name: 'Show Deutsch' }));
        expect(chipOrder(container)).toEqual(['EN', 'DE', 'ES']);
    });

    it('hiding the first language keeps the remaining two in their original relative order', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <Controlled initialActive={['EN', 'DE', 'ES']} allLanguages={['EN', 'DE', 'ES']} />,
        );

        await user.click(screen.getByRole('button', { name: 'Hide English' }));
        expect(chipOrder(container)).toEqual(['EN', 'DE', 'ES']);
    });

    it('a manual reorder is preserved after a hide/show round trip elsewhere', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <Controlled initialActive={['EN', 'DE', 'ES']} allLanguages={['EN', 'DE', 'ES']} />,
        );

        // Swap EN and DE.
        await user.click(screen.getByRole('button', { name: 'Move Deutsch earlier' }));
        expect(chipOrder(container)).toEqual(['DE', 'EN', 'ES']);

        // Hide and re-show ES — must not disturb the DE/EN swap.
        await user.click(screen.getByRole('button', { name: 'Hide Español' }));
        await user.click(screen.getByRole('button', { name: 'Show Español' }));
        expect(chipOrder(container)).toEqual(['DE', 'EN', 'ES']);
    });
});

describe('LanguageOrderControl — title and hint layout', () => {
    const props = { active: ['EN', 'DE'] as LangKey[], allLanguages: ['EN', 'DE', 'ES'] as LangKey[], onChange: vi.fn() };
    const head = () => screen.getByText('Language order').parentElement!;

    it('keeps the title and the hint side by side by default (the bar above the table)', () => {
        renderWithProviders(<LanguageOrderControl {...props} />);
        expect(head()).toHaveClass('fhead');
        expect(head()).not.toHaveClass('flex-col');
        expect(head()).toContainElement(screen.getByText(/Use the arrows to reorder/));
    });

    it('stacked: puts the title above the hint, left-aligned', () => {
        renderWithProviders(<LanguageOrderControl {...props} stacked />);
        expect(head()).toHaveClass('fhead', 'flex-col', 'items-start');
        expect(head()).toContainElement(screen.getByText(/Use the arrows to reorder/));
    });
});
