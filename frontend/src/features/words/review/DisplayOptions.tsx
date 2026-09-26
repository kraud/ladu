/**
 * The two Review display switches: Display gender (D14 — only offered once a
 * noun is on screen) and Display progress (always). Rendered as a fragment,
 * so the caller's layout decides the arrangement: inline in `TableToolbar` on
 * desktop, stacked in `MobileFilters`' side menu on a phone.
 */
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';

export interface DisplayOptionsProps {
    /** D14: `ReviewPage` decides this from whether any loaded row is a Noun. */
    showGenderSwitch: boolean;
    showGender: boolean;
    onShowGenderChange: (next: boolean) => void;
    showProgress: boolean;
    onShowProgressChange: (next: boolean) => void;
}

export function DisplayOptions({
    showGenderSwitch,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
}: DisplayOptionsProps) {
    const { t } = useTranslation();
    return (
        <>
            {showGenderSwitch && (
                <Switch aria-pressed={showGender} onClick={() => onShowGenderChange(!showGender)}>
                    {t('review:toolbar.displayGender')}
                </Switch>
            )}
            <Switch aria-pressed={showProgress} onClick={() => onShowProgressChange(!showProgress)}>
                {t('review:toolbar.displayProgress')}
            </Switch>
        </>
    );
}
