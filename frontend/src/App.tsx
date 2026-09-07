import { useTranslation } from 'react-i18next';

export function App() {
    const { t } = useTranslation('common');
    return (
        <main className="min-h-screen flex items-center justify-center">
            <h1 className="text-2xl font-bold">{t('appTitle', { defaultValue: 'Ladu' })}</h1>
        </main>
    );
}
