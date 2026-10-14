/**
 * The Review display switches, grouped by feature like the filters: Badges (Gender, D14 — only
 * offered once a noun is on screen — and Progress) and Columns (Owner and Word type). Rendered as
 * a fragment of groups, for the pinned "Table Display Options" section of the side menu.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnsIcon, MedalIcon } from '@phosphor-icons/react';
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
    const group = (icon: ReactNode, title: string, switches: ReactNode) => (
        <div className="fb-group">
            <h3 className="label flex items-center gap-1.5">
                <span aria-hidden="true" className="[&_svg]:size-3.5">
                    {icon}
                </span>
                {title}
            </h3>
            <div className="flex flex-wrap gap-2">{switches}</div>
        </div>
    );
    return (
        <>
            {group(
                <MedalIcon />,
                t('review:filters.displayBadges'),
                <>
                    {showGenderSwitch && (
                        <Switch aria-pressed={showGender} onClick={() => onShowGenderChange(!showGender)}>
                            {t('review:toolbar.displayGender')}
                        </Switch>
                    )}
                    <Switch aria-pressed={showProgress} onClick={() => onShowProgressChange(!showProgress)}>
                        {t('review:toolbar.displayProgress')}
                    </Switch>
                </>,
            )}
            {(onShowOwnerChange || onShowPosChange) &&
                group(
                    <ColumnsIcon />,
                    t('review:filters.displayColumns'),
                    <>
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
                    </>,
                )}
        </>
    );
}
