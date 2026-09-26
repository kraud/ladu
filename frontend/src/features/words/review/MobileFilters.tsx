/**
 * The phone's filter menu (below 920px): a "Filters" button in the toolbar
 * row opens a side menu (`Sheet`, from the left) holding the filter groups in
 * one column — `FilterBar layout="menu"` — followed by the two display
 * switches. The search box and the "x of y words" label stay in the toolbar.
 * The button shows how many filters are active, so a hidden menu never hides
 * that the table is filtered.
 *
 * `ReviewPage` renders this INSTEAD of the inline filter bar on a phone
 * (`useIsMobile`), so each control exists once at every width.
 */
import { useTranslation } from 'react-i18next';
import { SlidersHorizontalIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { activeFilterCount, FilterBar, type FilterBarProps } from './FilterBar';
import { DisplayOptions, type DisplayOptionsProps } from './DisplayOptions';

export type MobileFiltersProps = Omit<FilterBarProps, 'layout'> & DisplayOptionsProps;

export function MobileFilters({
    showGenderSwitch,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
    ...filterProps
}: MobileFiltersProps) {
    const { t } = useTranslation();
    const activeCount = activeFilterCount(filterProps.gender, filterProps.pos, filterProps.hasQuery);

    return (
        <Sheet>
            <SheetTrigger render={<Button type="button" variant="outline" className="gap-2" />}>
                <SlidersHorizontalIcon size={16} />
                {t('review:filters.title')}
                {activeCount > 0 && <span className="active-pill">{activeCount}</span>}
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto p-4">
                <SheetHeader className="p-0">
                    <SheetTitle>{t('review:filters.title')}</SheetTitle>
                </SheetHeader>
                <FilterBar {...filterProps} layout="menu" />
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <span className="label">{t('review:filters.display')}</span>
                    <DisplayOptions
                        showGenderSwitch={showGenderSwitch}
                        showGender={showGender}
                        onShowGenderChange={onShowGenderChange}
                        showProgress={showProgress}
                        onShowProgressChange={onShowProgressChange}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
