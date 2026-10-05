/**
 * The Review display switches: Display owner, Display word type, Display gender (D14 — only offered once a
 * noun is on screen) and Display progress (always). Rendered as a fragment,
 * so the caller's layout decides the arrangement: inline in `TableToolbar` on
 * desktop, stacked in the slide-in menu (a `SidebarLayout` section) on a phone.
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
    /** Review's owner and word-type column switches; other tables leave them out (no switch). */
    showOwner?: boolean;
    onShowOwnerChange?: (next: boolean) => void;
    showPos?: boolean;
    onShowPosChange?: (next: boolean) => void;
}

export function DisplayOptions({
    showGenderSwitch,
    showGender,
    onShowGenderChange,
    showProgress,
    onShowProgressChange,
    showOwner,
    onShowOwnerChange,
    showPos,
    onShowPosChange,
}: DisplayOptionsProps) {
    const { t } = useTranslation();
    return (
        <>
            {showGenderSwitch && (
                <Switch aria-pressed={showGender} onClick={() => onShowGenderChange(!showGender)}>
                    {t('review:toolbar.displayGender')}
                </Switch>
            )}
            {onShowOwnerChange && (
                <Switch aria-pressed={showOwner} onClick={() => onShowOwnerChange(!showOwner)}>
                    {t('review:toolbar.displayOwner')}
                </Switch>
            )}
            {onShowPosChange && (
                <Switch aria-pressed={showPos} onClick={() => onShowPosChange(!showPos)}>
                    {t('review:toolbar.displayType')}
                </Switch>
            )}
            <Switch aria-pressed={showProgress} onClick={() => onShowProgressChange(!showProgress)}>
                {t('review:toolbar.displayProgress')}
            </Switch>
        </>
    );
}
