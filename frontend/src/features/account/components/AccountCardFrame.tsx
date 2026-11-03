import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import type { SessionUser } from '@/stores/authStore';
import { CardFrame } from './CardFrame';

/**
 * The frame of the account card: the avatar, the name and the username on the left of the header,
 * the header buttons (`actions`) on the right, and the body below a divider. The read-only view
 * puts Edit profile and Logout in the header; the edit form puts Save and Cancel there.
 */
export function AccountCardFrame({
    user,
    actions,
    children,
}: {
    user: SessionUser;
    actions: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <CardFrame
            label={t('account:sections.details')}
            lead={
                <span
                    className="avatar h-14 w-14 text-lg"
                    style={{ background: avatarColor(user.name), color: '#fff' }}
                    aria-hidden
                >
                    {avatarInitials(user.name)}
                </span>
            }
            title={<div className="h2 text-lg">{user.name}</div>}
            // A demo's username is synthetic (`demo-<uuid>`): say what the account is instead.
            subtitle={user.isDemo ? t('demo:account.accountLabel') : `@${user.username}`}
            actions={actions}
        >
            {children}
        </CardFrame>
    );
}
