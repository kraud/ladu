import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/features/auth/hooks';
import { DemoAccountCard } from '@/features/demo/components/DemoAccountCard';
import { AccountDetailsCard } from '../components/AccountDetailsCard';
import { LanguagesCard } from '../components/LanguagesCard';

/** The card in edit mode. Only one card is edited at a time. */
type EditingCard = 'details' | 'languages' | null;

/**
 * Account (`/user`): two cards. The account card (name, username, email, sign-in methods, Logout)
 * and the languages card (selected languages, native language, mastered language pairs) take half
 * of the row each on desktop. Below 920px, the app's one breakpoint, they stack in a column. Each card has its own edit button and form. While one card is in edit mode, the edit
 * buttons of both cards are hidden. Tags, friends and drag-to-reorder languages are Phase 7.
 */
export function AccountPage() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const [editing, setEditing] = useState<EditingCard>(null);
    const [confirmingLogout, setConfirmingLogout] = useState(false);
    const logout = useLogout();

    if (!user) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="h1">{t('account:title')}</h1>
                <p className="meta">{t('account:subtitle')}</p>
            </div>

            {user.isDemo && <DemoAccountCard />}

            <div className="grid grid-cols-1 items-start gap-4 min-[921px]:grid-cols-2">
                <AccountDetailsCard
                    user={user}
                    editing={editing === 'details'}
                    canEdit={editing === null}
                    onEdit={() => setEditing('details')}
                    onDone={() => setEditing(null)}
                    onLogout={() => setConfirmingLogout(true)}
                />
                <LanguagesCard
                    user={user}
                    editing={editing === 'languages'}
                    canEdit={editing === null}
                    onEdit={() => setEditing('languages')}
                    onDone={() => setEditing(null)}
                />
            </div>

            <ConfirmDialog
                open={confirmingLogout}
                onOpenChange={setConfirmingLogout}
                title={t('common:header.settings.logoutConfirmTitle')}
                description={t('common:header.settings.logoutConfirmDescription')}
                confirmLabel={t('common:header.settings.logout')}
                destructive={false}
                onConfirm={() => {
                    setConfirmingLogout(false);
                    logout();
                }}
            />
        </div>
    );
}
