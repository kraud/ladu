import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from './app/Providers';
import './i18n';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <Providers />
    </StrictMode>,
);
