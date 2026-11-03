import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { useOAuthIdentities } from '@/features/auth/hooks';
import type { SessionUser } from '@/stores/authStore';
import { AccountCardFrame } from './AccountCardFrame';
import { AccountDetailsForm } from './AccountDetailsForm';
import { InfoRow } from './InfoRow';

/**
 * The account card (left on desktop): avatar, name, username, email, sign-in methods, and the
 * Logout button. It has its own edit button, shown only while no card is being edited. While the
 * card is edited, `AccountDetailsForm` draws the whole card: Save and Cancel replace Edit profile
 * and Logout in the header. A demo has nothing to edit here (demo-access.md D10): it shows a note
 * and no edit button.
 */
export function AccountDetailsCard({
    user,
    editing,
    canEdit,
    onEdit,
    onDone,
    onLogout,
}: {
    user: SessionUser;
    editing: boolean;
    /** true while neither card is in edit mode */
    canEdit: boolean;
    onEdit: () => void;
    onDone: () => void;
    onLogout: () => void;
}) {
    const { t } = useTranslation();
    // A demo has no sign-in methods and no real username or email (demo-access.md D10).
    const identities = useOAuthIdentities({ enabled: !user.isDemo });

    if (editing) return <AccountDetailsForm user={user} onDone={onDone} />;

    return (
        <AccountCardFrame
            user={user}
            actions={
                <>
                    {canEdit && !user.isDemo && <Button onClick={onEdit}>{t('common:buttons.editProfile')}</Button>}
                    <Button variant="outline" onClick={onLogout}>
                        {t('common:header.settings.logout')}
                    </Button>
                </>
            }
        >
            <p className="eyebrow mb-2">{t('account:sections.details')}</p>
            <dl className="flex flex-col gap-1">
                {user.isDemo ? (
                    <p className="hint">{t('demo:account.namesLocked')}</p>
                ) : (
                    <>
                        <InfoRow label={t('loginRegister:formLabels.name')}>{user.name}</InfoRow>
                        <InfoRow label={t('loginRegister:formLabels.username')}>@{user.username}</InfoRow>
                        <InfoRow label={t('loginRegister:formLabels.email')}>{user.email}</InfoRow>
                    </>
                )}
                {identities.data && (
                    <div className="grid grid-cols-[96px_1fr] items-baseline gap-3 py-1">
                        <dt className="meta">{t('account:signInMethods.title')}</dt>
                        <dd className="flex min-w-0 flex-wrap gap-1.5">
                            {identities.data.hasPassword && (
                                <span className="chip">{t('account:signInMethods.passwordLabel')}</span>
                            )}
                            {identities.data.identities.some((i) => i.provider === 'google') && (
                                <span className="chip">
                                    <GoogleIcon width={14} height={14} />
                                    {t('account:signInMethods.googleLabel')}
                                </span>
                            )}
                        </dd>
                    </div>
                )}
            </dl>
        </AccountCardFrame>
    );
}
