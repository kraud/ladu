import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { thirdPartyNotices } from './third-party-notices';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        // Writes dist/THIRD-PARTY-NOTICES.txt. The three extra packages reach
        // the build through `@import` in src/styles.css, not through JavaScript.
        thirdPartyNotices({
            title: 'Ladu web app',
            extraPackages: ['tailwindcss', 'tw-animate-css', 'shadcn'],
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:5001',
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        css: false,
    },
});
