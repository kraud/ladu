/**
 * An in-memory fake of `GET /api/users/getUserMetrics`, for the metrics
 * data-layer tests (Slice 2) and the Dashboard page (Slices 3-6). Each call
 * to `makeMetricsHandlers()` gets its own isolated response — this endpoint
 * has no request body/params to model, so the "store" is just the response
 * to hand back, defaulting to the all-zero fresh-account shape.
 */
import { http, HttpResponse } from 'msw';
import type { BasicUserMetricsBE } from '@/features/metrics/types';

export const EMPTY_METRICS: BasicUserMetricsBE = {
    totalWords: 0,
    incompleteWordsCount: 0,
    translationsPerLanguage: [],
    translationsPerLanguageAndPOS: [],
    wordsPerPOS: [],
    wordsPerMonth: [],
};

export function makeMetricsHandlers(response: BasicUserMetricsBE = EMPTY_METRICS) {
    const state = { calls: 0 };

    const handlers = [
        http.get('*/api/users/getUserMetrics', () => {
            state.calls += 1;
            return HttpResponse.json(response);
        }),
    ];

    return { handlers, state };
}
