import { describe, expect, it } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore — sidebar defaults', () => {
    it('every sidebar starts collapsed on a desktop except the practice results', () => {
        // `test/setup.ts` resets the live store between tests, so the real defaults are read from the initial state.
        expect(useUiStore.getInitialState().sidebarCollapsed).toEqual({
            review: true,
            tag: true,
            word: true,
            practice: true,
            practiceResults: false,
        });
    });
});
