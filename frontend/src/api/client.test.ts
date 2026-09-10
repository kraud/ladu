import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient, onUnauthorized } from './client';
import { useAuthStore } from '@/stores/authStore';

const unsubs: Array<() => void> = [];
afterEach(() => {
    while (unsubs.length) unsubs.pop()?.();
});

describe('apiClient interceptors', () => {
    it('attaches the session bearer token to outgoing requests', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'tok-abc' });
        let seen: string | null = null;
        server.use(
            http.get('*/api/ping', ({ request }) => {
                seen = request.headers.get('authorization');
                return HttpResponse.json({ ok: true });
            }),
        );

        await apiClient.get('/ping');
        expect(seen).toBe('Bearer tok-abc');
    });

    it('sends no Authorization header when there is no session', async () => {
        let seen: string | null = 'unset';
        server.use(
            http.get('*/api/ping', ({ request }) => {
                seen = request.headers.get('authorization');
                return HttpResponse.json({ ok: true });
            }),
        );

        await apiClient.get('/ping');
        expect(seen).toBeNull();
    });

    it('on 401 clears the session and notifies onUnauthorized subscribers', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'tok' });
        const handler = vi.fn();
        unsubs.push(onUnauthorized(handler));
        server.use(http.get('*/api/ping', () => new HttpResponse(null, { status: 401 })));

        await expect(apiClient.get('/ping')).rejects.toMatchObject({ response: { status: 401 } });

        expect(useAuthStore.getState().token).toBeNull();
        expect(useAuthStore.getState().user).toBeNull();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('leaves the session intact on a non-401 error', async () => {
        useAuthStore.getState().setSession({ id: 'u1', email: 'a@x.com', token: 'tok' });
        const handler = vi.fn();
        unsubs.push(onUnauthorized(handler));
        server.use(http.get('*/api/ping', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

        await expect(apiClient.get('/ping')).rejects.toBeTruthy();

        expect(useAuthStore.getState().token).toBe('tok');
        expect(handler).not.toHaveBeenCalled();
    });
});
