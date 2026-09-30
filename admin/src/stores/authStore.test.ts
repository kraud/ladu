import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { staffFixture } from '@/test/msw/handlers';
import { fakeToken } from '@/test/token';

describe('authStore', () => {
    it('keeps the current token when the profile is refreshed without one', () => {
        const token = fakeToken();
        useAuthStore.getState().setSession(staffFixture, token);

        useAuthStore.getState().setSession({ ...staffFixture, role: 'viewer' });

        expect(useAuthStore.getState()).toMatchObject({ token, staff: { role: 'viewer' } });
    });

    it('persists under its own key, not the learner app key', () => {
        useAuthStore.getState().setSession(staffFixture, fakeToken());

        expect(localStorage.getItem('ladu-admin.session')).not.toBeNull();
        expect(localStorage.getItem('ladu.session')).toBeNull();
    });

    it('clears the session', () => {
        useAuthStore.getState().setSession(staffFixture, fakeToken());
        useAuthStore.getState().clearSession();

        expect(useAuthStore.getState()).toMatchObject({ staff: null, token: null });
    });
});
