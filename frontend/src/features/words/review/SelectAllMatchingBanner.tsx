import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export interface SelectAllMatchingBannerProps {
    /** Your own words that match the filters, over all pages (`useOwnWordsTotal`). */
    matchingTotal: number;
    /** Words selected now, on any page. */
    selectedCount: number;
    /** Own words on the current page. */
    pageSelectableCount: number;
    /** True when every own word on the current page is selected. */
    pageFullySelected: boolean;
    /** The fetch of all matching words is running. */
    isSelecting: boolean;
    onSelectAll: () => void;
    onClear: () => void;
}

/**
 * Shown after the header checkbox selected the whole page, when more of your own
 * words match the filters on other pages: one click selects all of them. Once
 * they are all selected, it says so and offers to clear the selection.
 */
export function SelectAllMatchingBanner({
    matchingTotal,
    selectedCount,
    pageSelectableCount,
    pageFullySelected,
    isSelecting,
    onSelectAll,
    onClear,
}: SelectAllMatchingBannerProps) {
    const { t } = useTranslation();

    if (!pageFullySelected || matchingTotal <= pageSelectableCount) return null;

    const allSelected = selectedCount >= matchingTotal;

    return (
        <div className="bulkbar" role="status" data-testid="select-all-matching">
            <span className="grow" style={{ fontSize: 13 }}>
                {allSelected
                    ? t('review:bulk.allMatchingSelected', { count: matchingTotal })
                    : t('review:bulk.pageSelected')}
            </span>
            {allSelected ? (
                <Button type="button" variant="outline" size="sm" onClick={onClear}>
                    {t('review:bulk.clearSelection')}
                </Button>
            ) : (
                <Button type="button" variant="outline" size="sm" disabled={isSelecting} onClick={onSelectAll}>
                    {t('review:bulk.selectAllMatching', { count: matchingTotal })}
                </Button>
            )}
        </div>
    );
}
