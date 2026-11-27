import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

// The app's real i18next setup (`i18n.ts`), which starts when it is imported.
describe('the language files the app asks for', () => {
    it('uses the language without its region: a saved "es-ES" loads only the "es" and "en" files', async () => {
        const asked: string[] = [];
        server.use(
            http.get('*/locales/:lng/:file', ({ params }) => {
                asked.push(String(params.lng));
                return HttpResponse.json({});
            }),
        );
        localStorage.setItem('i18nextLng', 'es-ES');

        const { default: i18n } = await import('./i18n');
        await vi.waitFor(() => expect(i18n.isInitialized).toBe(true));

        expect([...new Set(asked)].sort()).toEqual(['en', 'es']);
        expect(document.documentElement.getAttribute('lang')).toBe('es');
    });
});
