import { describe, expect, it } from 'vitest';
import { isCopyleft, packageFromModuleId, renderNotices } from './third-party-notices';

describe('packageFromModuleId', () => {
    it('finds a plain package', () => {
        expect(packageFromModuleId('/app/node_modules/react/index.js')).toEqual({
            name: 'react',
            root: '/app/node_modules/react',
        });
    });

    it('keeps the scope of a scoped package', () => {
        expect(packageFromModuleId('/app/node_modules/@tanstack/react-query/build/index.js')).toEqual({
            name: '@tanstack/react-query',
            root: '/app/node_modules/@tanstack/react-query',
        });
    });

    it('uses the innermost node_modules for a nested package', () => {
        expect(
            packageFromModuleId('/app/frontend/node_modules/@base-ui/react/node_modules/@base-ui/utils/esm/a.js'),
        ).toEqual({
            name: '@base-ui/utils',
            root: '/app/frontend/node_modules/@base-ui/react/node_modules/@base-ui/utils',
        });
    });

    it('ignores our own source, virtual modules, and strips query strings', () => {
        expect(packageFromModuleId('/app/frontend/src/main.tsx')).toBeNull();
        expect(packageFromModuleId('\0commonjsHelpers.js')).toBeNull();
        expect(packageFromModuleId('/app/node_modules/zod/index.js?commonjs-es-import')?.name).toBe('zod');
    });
});

describe('isCopyleft', () => {
    it('flags strong copyleft', () => {
        expect(isCopyleft('GPL-3.0-only')).toBe(true);
        expect(isCopyleft('AGPL-3.0')).toBe(true);
        expect(isCopyleft('LGPL-2.1-or-later')).toBe(true);
    });

    it('accepts permissive and weak-copyleft licences', () => {
        expect(isCopyleft('MIT')).toBe(false);
        expect(isCopyleft('Apache-2.0')).toBe(false);
        expect(isCopyleft('MPL-2.0')).toBe(false);
    });

    it('accepts a dual licence with a permissive choice', () => {
        expect(isCopyleft('(MIT OR GPL-3.0)')).toBe(false);
        expect(isCopyleft('(GPL-2.0 OR GPL-3.0)')).toBe(true);
    });
});

describe('renderNotices', () => {
    it('lists each package with its licence text', () => {
        const out = renderNotices('Test app', [
            {
                name: 'left-pad',
                version: '1.0.0',
                licence: 'MIT',
                source: 'https://example.test/left-pad',
                author: 'Some Author',
                texts: [{ file: 'LICENSE', text: 'Copyright (c) Someone' }],
            },
            { name: 'no-file', version: '2.0.0', licence: 'ISC', source: '', author: '', texts: [] },
        ]);
        expect(out).toContain('Author: Some Author');
        expect(out).toContain('THIRD-PARTY NOTICES - Test app');
        expect(out).toContain('2 packages.');
        expect(out).toContain('left-pad@1.0.0');
        expect(out).toContain('Copyright (c) Someone');
        expect(out).toContain('no-file@2.0.0');
        expect(out).toContain('ships no licence file');
    });
});
