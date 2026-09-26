/**
 * The word editor sidebar's collapse state, as the UI must read it. The
 * stored preference (`uiStore.wordSidebarCollapsed`) only means "icon rail" on
 * desktop: below 920px the sidebar is always a full drawer, so `collapsed`
 * is forced `false` there. `isMobile` is exposed so callers can render a
 * piece of UI in one place per breakpoint.
 */
import { useIsMobile } from '@/lib/useMediaQuery';
import { useUiStore } from '@/stores/uiStore';

export function useWordSidebar() {
    const preference = useUiStore((s) => s.wordSidebarCollapsed);
    const setCollapsed = useUiStore((s) => s.setWordSidebarCollapsed);
    const isMobile = useIsMobile();
    return { collapsed: preference && !isMobile, setCollapsed, isMobile };
}
