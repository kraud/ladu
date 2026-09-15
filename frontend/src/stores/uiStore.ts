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
type ReviewFilterPosition = 'top' | 'sidebar';

interface UiState {
    /** PoS chosen on the Add Word step, remembered across the form (Phase 2). */
    selectedPoS: PartOfSpeech | null;
    setSelectedPoS: (pos: PartOfSpeech | null) => void;

    /** Header global-search word/tag toggle (Phase 3). */
    searchMode: SearchMode;
    setSearchMode: (mode: SearchMode) => void;

    /** Review filter bar collapsed to its header row (top) or an icon rail (sidebar). */
    reviewSidebarCollapsed: boolean;
    setReviewSidebarCollapsed: (collapsed: boolean) => void;

    /** Review filter bar's position: a bar above the table, or a collapsible left sidebar. */
    reviewFilterPosition: ReviewFilterPosition;
    setReviewFilterPosition: (position: ReviewFilterPosition) => void;

    /**
     * Word editor's left action sidebar (`WordEditorLayout`) collapsed to an
     * icon rail. Shared across create/edit/view so the state doesn't reset
     * when a user toggles Edit on `/word/:id` — session-scoped like
     * `reviewSidebarCollapsed`, not persisted.
     */
    wordSidebarCollapsed: boolean;
    setWordSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
    selectedPoS: null,
    setSelectedPoS: (selectedPoS) => set({ selectedPoS }),

    searchMode: 'words',
    setSearchMode: (searchMode) => set({ searchMode }),

    reviewSidebarCollapsed: false,
    setReviewSidebarCollapsed: (reviewSidebarCollapsed) => set({ reviewSidebarCollapsed }),

    reviewFilterPosition: 'top',
    setReviewFilterPosition: (reviewFilterPosition) => set({ reviewFilterPosition }),

    wordSidebarCollapsed: false,
    setWordSidebarCollapsed: (wordSidebarCollapsed) => set({ wordSidebarCollapsed }),
}));
