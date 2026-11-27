/**
 * What reaches Sentry (lib/sentry.ts): crashes, and never what the person typed or owns.
 * The real SDK with the real options, and a transport that keeps the reports in memory.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';
import { rootOptions, sentryOptions } from './sentry';

type Report = Sentry.ErrorEvent;

const sent: Report[] = [];

beforeAll(() => {
    Sentry.init({
        dsn: 'http://key@127.0.0.1:9/1',
        ...sentryOptions,
        transport: () => ({
            send: async ([, items]) => {
                for (const [header, payload] of items) {
                    if (header.type === 'event') sent.push(payload as Report);
                }
                return {};
            },
            flush: async () => true,
        }),
    });
});
beforeEach(() => {
    sent.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Sentry.getIsolationScope().clearBreadcrumbs();
});
afterAll(async () => {
    await Sentry.close();
});

/** Reports one crash and returns it, also as text without the source lines of this file. */
async function report(message: string) {
    Sentry.captureException(new Error(message));
    await Sentry.flush(2000);
    expect(sent).toHaveLength(1);
    const event = sent[0]!;
    const withoutSource = (key: string, value: unknown) =>
        ['pre_context', 'context_line', 'post_context'].includes(key) ? undefined : value;
    return { event, text: JSON.stringify(event, withoutSource) };
}

describe('error reports to Sentry', () => {
    it('does not let Sentry store the IP address', async () => {
        const { event } = await report('crash without user data');

        expect(event.sdk?.settings?.infer_ip).toBe('never');
        expect(event.user?.ip_address).toBeUndefined();
    });

    it.each([
        ['/user/42/verify/secret-value', '/user/42/verify/[token]'],
        ['/resetPassword/42/secret-value', '/resetPassword/42/[token]'],
        ['/auth/callback#token=secret-value', '/auth/callback#token=[token]'],
        ['/auth/callback#ticket=secret-value&mode=link', '/auth/callback#ticket=[token]&mode=link'],
    ])('replaces the token of the page %s', async (path, sentPath) => {
        window.history.pushState({}, '', path);

        const { event, text } = await report(`crash on a page of ${path.length} characters`);

        expect(event.request?.url).toContain(sentPath);
        expect(event.breadcrumbs?.at(-1)?.data?.to).toBe(sentPath);
        expect(text).not.toContain('secret-value');
    });

    it('removes query values and dictionary words from addresses', async () => {
        window.history.pushState({}, '', '/words?search=secret-value');
        Sentry.addBreadcrumb({ category: 'xhr', data: { url: '/api/dictionary/DE/Noun/secret-value' } });

        const { text } = await report('crash after a search');

        expect(text).toContain('/api/dictionary/DE/Noun/[word]');
        expect(text).not.toContain('secret-value');
    });

    it('does not keep console lines or clicks', async () => {
        console.log('secret-value');
        const button = document.body.appendChild(document.createElement('button'));
        button.setAttribute('aria-label', 'Remove secret-value');
        button.click();
        button.remove();

        const { text } = await report('crash after a click');

        expect(text).not.toContain('secret-value');
    });

    it('reports a crash that an error panel catches', async () => {
        const Crash = (): never => {
            throw new Error('crash in a screen');
        };
        const container = document.createElement('div');
        const root = createRoot(container, rootOptions);

        await act(async () => {
            root.render(
                <ErrorBoundary fallback={<p>Error panel</p>}>
                    <Crash />
                </ErrorBoundary>,
            );
        });
        await Sentry.flush(2000);
        act(() => root.unmount());

        expect(sent.map((event) => event.exception?.values?.at(-1)?.value)).toContain('crash in a screen');
    });
});
