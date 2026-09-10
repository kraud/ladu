import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { FlagIcon } from '@/components/common/FlagIcon';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { UI_LANGUAGES, languageByLabel } from '@/lib/language';
import type { SessionUser } from '@/stores/authStore';
import { ProfileForm } from '../components/ProfileForm';

/**
 * Account (`/user`). Phase 1 scope: view + edit the profile basics — name,
 * username, and the language selection (>= 2, order = preference). Email and
 * password are managed elsewhere. Tags, friends and drag-to-reorder languages
 * are Phase 7; this page grows into that.
 */
export function AccountPage() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const [editing, setEditing] = useState(false);

    if (!user) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="h1">{t('account:title')}</h1>
                <p className="meta">{t('account:subtitle')}</p>
            </div>

            <section className="card max-w-2xl">
                <div className="flex items-center gap-4 border-b border-border p-5">
                    <span
                        className="avatar h-14 w-14 text-lg"
                        style={{ background: avatarColor(user.name), color: '#fff' }}
                        aria-hidden
                    >
                        {avatarInitials(user.name)}
                    </span>
                    <div className="min-w-0">
                        <div className="h2 text-lg">{user.name}</div>
                        <div className="meta">@{user.username}</div>
                    </div>
                    <span className="grow" />
                    {!editing && (
                        <Button onClick={() => setEditing(true)}>
                            {t('common:buttons.editProfile')}
                        </Button>
                    )}
                </div>

                <div className="p-5">
                    {editing ? (
                        <ProfileForm user={user} onDone={() => setEditing(false)} />
                    ) : (
                        <ProfileView user={user} onEditLanguages={() => setEditing(true)} />
                    )}
                </div>
            </section>
        </div>
    );
}

function ProfileView({
    user,
    onEditLanguages,
}: {
    user: SessionUser;
    onEditLanguages: () => void;
}) {
    const { t } = useTranslation();
    const total = UI_LANGUAGES.length;
    const hasLanguages = user.languages.length > 0;

    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="eyebrow mb-2">{t('account:sections.details')}</p>
                <dl className="flex flex-col gap-1">
                    <InfoRow label={t('loginRegister:formLabels.name')} value={user.name} />
                    <InfoRow
                        label={t('loginRegister:formLabels.username')}
                        value={`@${user.username}`}
                    />
                    <InfoRow label={t('loginRegister:formLabels.email')} value={user.email} />
                </dl>
            </div>

            <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="eyebrow">{t('account:sections.languages')}</p>
                    <span className="hint">
                        {hasLanguages
                            ? t('account:languages.count', {
                                  count: user.languages.length,
                                  total,
                              })
                            : t('account:languages.none')}
                    </span>
                </div>

                {hasLanguages ? (
                    <ul className="flex flex-wrap gap-1.5">
                        {user.languages.map((label) => {
                            const entry = languageByLabel(label);
                            return (
                                <li key={label} className="chip">
                                    {entry && <FlagIcon lang={entry.key} />}
                                    {entry?.native ?? label}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="banner warning items-start">
                        <WarningCircleIcon className="mt-0.5 shrink-0" size={16} weight="bold" />
                        <span>
                            <b>{t('account:languages.emptyTitle')}</b>
                            <br />
                            {t('account:languages.emptyBody')}{' '}
                            <button
                                type="button"
                                className="font-semibold underline underline-offset-2"
                                onClick={onEditLanguages}
                            >
                                {t('account:languages.emptyCta')} →
                            </button>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[96px_1fr] items-baseline gap-3 py-1">
            <dt className="meta">{label}</dt>
            <dd className="min-w-0 break-words text-sm font-medium">{value}</dd>
        </div>
    );
}
