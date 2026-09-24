import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useOAuthIdentities, useConnectOAuthProvider, useDisconnectOAuthIdentity } from '@/features/auth/hooks';

/**
 * Connect/Disconnect controls for the Account profile's edit mode
 * (oauth-login-strategy.md Phase 5) — shown only here, never on the
 * read-only `ProfileView`, matching how the rest of the profile already
 * works (no separate settings page).
 */
export function SignInMethodsField() {
    const { t } = useTranslation();
    const { data } = useOAuthIdentities();
    const connect = useConnectOAuthProvider();
    const disconnect = useDisconnectOAuthIdentity();
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    if (!data) return null;

    const googleIdentity = data.identities.find((i) => i.provider === 'google');

    return (
        <div className="flex flex-wrap items-center gap-2">
            {data.hasPassword && <span className="chip">{t('account:signInMethods.passwordLabel')}</span>}

            {googleIdentity ? (
                <>
                    <span className="chip">
                        <GoogleIcon width={14} height={14} />
                        {t('account:signInMethods.googleLabel')}
                    </span>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={disconnect.isPending}
                        onClick={() => setConfirmingId(googleIdentity.id)}
                    >
                        {t('account:signInMethods.disconnect')}
                    </Button>
                </>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate('google')}
                >
                    <GoogleIcon width={14} height={14} />
                    {t('account:signInMethods.connect')}
                </Button>
            )}

            <ConfirmDialog
                open={confirmingId !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirmingId(null);
                }}
                title={t('account:signInMethods.confirmDisconnectTitle')}
                description={t('account:signInMethods.confirmDisconnectDescription')}
                confirmLabel={t('account:signInMethods.disconnect')}
                onConfirm={() => {
                    if (confirmingId) disconnect.mutate(confirmingId);
                    setConfirmingId(null);
                }}
            />
        </div>
    );
}
