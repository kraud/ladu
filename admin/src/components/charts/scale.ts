/**
 * Clean axis ticks for a count chart: 0, then equal steps of 1, 2, 5, 10, 20, 50, ... up
 * to the first step that reaches the largest value. At most 5 ticks, always whole numbers.
 */
export function niceTicks(max: number): number[] {
    if (!Number.isFinite(max) || max <= 0) return [0, 1, 2];

    const roughStep = max / 4;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= roughStep) ?? magnitude * 10;
    // Counts are whole numbers: a step below 1 would label the axis 0.5, 1.5...
    const whole = Math.max(1, step);

    const ticks = [0];
    while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + whole);
    return ticks;
}
