/**
 * What the app reports to Sentry (`main.tsx` starts it): crashes, and never what the person
 * typed or owns (passwords, login tokens, words, tag names). The backend has the same rules
 * in `backend/lib/sentry.ts`.
 */
import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import type { RootOptions } from 'react-dom/client';

/** Text that can be in any part of a report, and what replaces it. */
const SECRETS: [RegExp, string][] = [
    // The token of an emailed link: `.../verify/:token`, `/resetPassword/:id/:token`.
    [/(\/verify\/|\/resetPassword\/[^/\s"'?#]+\/)[^/\s"'?#]+/gi, '$1[token]'],
    // Google sign-in comes back with `/auth/callback#token=...` or `#ticket=...`.
    [/([#&?](?:token|ticket)=)[^&\s"']+/gi, '$1[token]'],
    // The word in a dictionary address.
    [/(\/dictionary\/(?:translate\/)?[^/\s"'?#]+\/[^/\s"'?#]+\/)[^\s"'?#]+/gi, '$1[word]'],
];

const scrubText = (text: string): string =>
    SECRETS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);

/** Applies `scrubText` to every string of a report, in place. */
function scrub<T>(value: T, seen = new Set<object>()): T {
    if (typeof value === 'string') return scrubText(value) as T;
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) {
        // The SDK's own working data. It is never sent.
        if (key !== 'sdkProcessingMetadata') object[key] = scrub(object[key], seen);
    }
    return value;
}

/** `Sentry.init` settings. By default the SDK collects almost everything it can see. */
export const sentryOptions = {
    // No bodies, cookies, query values or user data (so Sentry does not store the IP address).
    // Headers stay (operator guide 04, "Sentry").
    dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
        queues: false,
        genAI: { inputs: false, outputs: false },
        mcp: { inputs: false, outputs: false },
        graphQL: { document: false, variables: false },
        frameContextLines: 7,
    },
    // A console line can hold anything. A click is recorded with the label of the button,
    // which can hold a word or a tag name.
    beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
        const category = breadcrumb.category ?? '';
        return category === 'console' || category.startsWith('ui.') ? null : breadcrumb;
    },
    beforeSend(event: ErrorEvent): ErrorEvent {
        const headers = event.request?.headers;
        if (headers?.Referer) headers.Referer = headers.Referer.split(/[?#]/)[0] ?? '';
        return scrub(event);
    },
};

/**
 * React does not throw an error that an error panel catches (ours, or the router's), so the
 * SDK cannot see it by itself. This reports it, and keeps the console line.
 */
export const rootOptions: RootOptions = {
    onCaughtError: Sentry.reactErrorHandler((error) => console.error(error)),
};
