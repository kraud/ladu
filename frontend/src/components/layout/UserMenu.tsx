import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor, avatarInitials } from '@/lib/avatar';

/**
 * The header avatar — a plain link to the profile (`/user`). It used to open a
 * menu; Dashboard now lives on the Ladu logo and Logout on the profile page.
 */
export function UserMenu() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    return (
        <Link
            to="/user"
            className="avatar max-[920px]:size-10 max-[920px]:text-sm"
            style={{ background: avatarColor(user.name), color: '#fff' }}
            aria-label={t('common:header.settings.account')}
            title={t('common:header.settings.account')}
        >
            {avatarInitials(user.name)}
        </Link>
    );
}
