import { useEffect, useRef } from 'react';

/** The title of a screen. It takes focus when the screen opens, so a screen reader starts at the new question. */
export function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => ref.current?.focus({ preventScroll: true }), []);

    return (
        <>
            <h1 ref={ref} className="ob-title" tabIndex={-1}>
                {title}
            </h1>
            {subtitle && <p className="ob-sub">{subtitle}</p>}
        </>
    );
}
