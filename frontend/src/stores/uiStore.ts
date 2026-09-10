/**
 * Ephemeral client UI state — the second of the *three* stores the rewrite
 * allows (`authStore`, `uiStore`, and later practice's pre-selected-words
 * hand-off). Nothing here is server state and nothing here persists.
 *
 * Every field is unused in Phase 1; the store exists now so the "only three
 * stores" rule is visible from the first slice and later phases extend this
 * file instead of reaching for a fourth store or a Context.
 */
import { create } from 'zustand';
import type { PartOfSpeech } from '@/ts/enums';

type SearchMode = 'words' | 'tags';

interface UiState {
    /** PoS chosen on the Add Word step, remembered across the form (Phase 2). */
    selectedPoS: PartOfSpeech | null;
    setSelectedPoS: (pos: PartOfSpeech | null) => void;

    /** Header global-search word/tag toggle (Phase 3). */
    searchMode: SearchMode;
    setSearchMode: (mode: SearchMode) => void;

    /** Review filter sidebar collapsed state (Phase 3). */
    reviewSidebarCollapsed: boolean;
    setReviewSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
    selectedPoS: null,
    setSelectedPoS: (selectedPoS) => set({ selectedPoS }),

    searchMode: 'words',
    setSearchMode: (searchMode) => set({ searchMode }),

    reviewSidebarCollapsed: false,
    setReviewSidebarCollapsed: (reviewSidebarCollapsed) => set({ reviewSidebarCollapsed }),
}));
