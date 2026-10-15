/**
 * The demo start transition (demo-access.md D18): its timing and the lines it shows. A plain
 * module, so `useStartDemo` and `DemoTransition` share one source, and tests can make it short.
 */

/** The line keys in the `demo` namespace (`transition.lines.*`). Each start shows `lineCount` of them. */
export const DEMO_TRANSITION_LINES = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6'] as const;

/**
 * The timing. The screen stays for at least `lineCount × lineMs` (and longer when the server is
 * slower), then fades out in `fadeMs`. Tests set smaller values and put them back.
 */
export const demoTransitionTiming = {
    lineCount: 3,
    lineMs: 1000,
    fadeMs: 500,
};

/** The shortest time the screen is on: every line is shown for its full time. */
export function demoTransitionMinMs(): number {
    return demoTransitionTiming.lineCount * demoTransitionTiming.lineMs;
}

/** `count` different line keys in a random order, so a second demo does not show the same three. */
export function pickDemoTransitionLines(count = demoTransitionTiming.lineCount, random: () => number = Math.random): string[] {
    const pool: string[] = [...DEMO_TRANSITION_LINES];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, count);
}

/** True when the visitor asks for less motion: the screen then has no fade and no line animation. */
export function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}
