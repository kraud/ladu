/**
 * Ephemeral client UI state — the second of the *three* stores the rewrite
 * allows (`authStore`, `uiStore`, and the practice session store in
 * `features/practice/sessionStore.ts`). Nothing here is server state and
 * nothing here persists.
 *
 * Every field is unused in Phase 1; the store exists now so the "only three
 * stores" rule is visible from the first slice and later phases extend this
 * file instead of reaching for a fourth store or a Context.
 */
import { create } from 'zustand';
import type { PreselectedWord } from '@/features/practice/preselection';
import type { PartOfSpeech } from '@/ts/enums';

type SearchMode = 'words' | 'tags';
export type SidebarId = 'review' | 'word' | 'practice' | 'practiceResults';

interface UiState {
    /** PoS chosen on the Add Word step, remembered across the form (Phase 2). */
    selectedPoS: PartOfSpeech | null;
    setSelectedPoS: (pos: PartOfSpeech | null) => void;

    /** Header global-search word/tag toggle (Phase 3). */
    searchMode: SearchMode;
    setSearchMode: (mode: SearchMode) => void;

    /**
     * Collapsed (icon rail) state of each page's `SidebarLayout`, by page. The word
     * editor starts collapsed: the translation cards are the main content, and the
     * clue/tags are one click away on the rail. So does Practice's set-up (the words
     * list is empty until words come from Review or tags are chosen); it opens when
     * words arrive. The results page has its own entry and starts open. Shared across create/edit/view so the
     * state does not reset when a user toggles Edit on `/word/:id`. Session-scoped, not persisted.
     */
    sidebarCollapsed: Record<SidebarId, boolean>;
    setSidebarCollapsed: (id: SidebarId, collapsed: boolean) => void;

    /**
     * Words handed from Review's "Practice" bulk action to the practice
     * parameters screen (Phase 5, C4). Not in the URL — a long id list does not
     * belong there. The parameters screen reads it and clears it (`null`).
     */
    practicePreselection: PreselectedWord[] | null;
    setPracticePreselection: (words: PreselectedWord[] | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
    selectedPoS: null,
    setSelectedPoS: (selectedPoS) => set({ selectedPoS }),

    searchMode: 'words',
    setSearchMode: (searchMode) => set({ searchMode }),

    sidebarCollapsed: { review: false, word: true, practice: true, practiceResults: false },
    setSidebarCollapsed: (id, collapsed) =>
        set((state) => ({ sidebarCollapsed: { ...state.sidebarCollapsed, [id]: collapsed } })),

    practicePreselection: null,
    setPracticePreselection: (practicePreselection) => set({ practicePreselection }),
}));
