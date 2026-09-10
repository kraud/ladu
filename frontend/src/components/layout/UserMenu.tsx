import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { featureFlags } from '@/app/feature-flags';
import { useLogout } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor, avatarInitials } from '@/lib/avatar';

/**
 * Avatar dropdown. Menu actions are dispatched by **stable id**, never by the
 * translated label the old `Header` string-compared against
 * (`pages-auth-shell.md:218`).
 */
type MenuAction = 'dashboard' | 'account' | 'notifications' | 'logout';

export function UserMenu() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const logout = useLogout();
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    const { id: userId, name } = user;
    const initials = avatarInitials(name);

    function run(action: MenuAction) {
        switch (action) {
            case 'dashboard':
                void navigate({ to: '/' });
                return;
            case 'account':
                void navigate({ to: '/user' });
                return;
            case 'notifications':
                if (!featureFlags.notifications) {
                    toast.info(t('common:header.notImplemented'));
                    return;
                }
                void navigate({
                    to: '/user/$userId/notifications',
                    params: { userId },
                });
                return;
            case 'logout':
                logout();
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="avatar"
                style={{ background: avatarColor(name), color: '#fff' }}
                aria-label={t('common:header.settings.openSettings')}
            >
                {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{name || user.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => run('dashboard')}>
                    {t('common:header.settings.dashboard')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => run('account')}>
                    {t('common:header.settings.account')}
                </DropdownMenuItem>
                {featureFlags.notifications && (
                    <DropdownMenuItem onClick={() => run('notifications')}>
                        {t('common:header.settings.notifications')}
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => run('logout')}>
                    {t('common:header.settings.logout')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
