/**
 * The Review display options, grouped by feature like the filters: Badges (Gender, D14 — only
 * offered once a noun is on screen — and Progress) and Columns (Owner and Word type). Rendered as
 * a fragment of groups (Language order first), for the pinned "Display options" section of the side menu.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnsIcon, EyeIcon, MedalIcon, TranslateIcon } from '@phosphor-icons/react';
import { Switch } from '@/components/ui/switch';
import type { SidebarSection } from '@/components/layout/sidebar/SidebarLayout';

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
    /** The language-order control; shown first, as its own group. */
    languageOrder?: ReactNode;
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
    languageOrder,
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
            {languageOrder && (
                <div className="fb-group">
                    <h3 className="label flex items-center gap-1.5">
                        <span aria-hidden="true" className="[&_svg]:size-3.5">
                            <TranslateIcon />
                        </span>
                        {t('review:filters.languageOrder')}
                    </h3>
                    {languageOrder}
                </div>
            )}
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

/** The side-menu section that holds the options: pinned to the bottom, under its own title (Review and the tag page). */
export function buildDisplaySection(label: string, props: DisplayOptionsProps): SidebarSection {
    return {
        id: 'display',
        label,
        icon: <EyeIcon size={18} />,
        pinBottom: true,
        content: (
            <div className="flex flex-col gap-4">
                <DisplayOptions {...props} />
            </div>
        ),
    };
}
