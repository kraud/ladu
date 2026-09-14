import * as React from 'react';
import { cn } from 'cn';

/**
 * A plain `<button aria-pressed>` with a sliding-track knob — the mockup's
 * `.switch` (`MOCKUPS/review.html:159-161`), not `@base-ui/react/switch`.
 * Per D9 (ported mockup CSS over new primitives), this is a small enough
 * presentational shape that porting the exact markup is simpler than
 * onboarding a new base-ui primitive for one consumer. Styling lives in
 * `styles/globals.css` (`.switch` / `.track`, ported from the mockup).
 */
const Switch = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, children, 'aria-pressed': ariaPressed, ...props }, ref) => {
        return (
            <button
                ref={ref}
                type="button"
                data-slot="switch"
                role="switch"
                aria-checked={ariaPressed}
                aria-pressed={ariaPressed}
                className={cn('switch', className)}
                {...props}
            >
                <span className="track" />
                {children}
            </button>
        );
    },
);
Switch.displayName = 'Switch';

export { Switch };
