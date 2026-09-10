import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { useUpdateProfile } from '@/features/auth/hooks';
import { UI_LANGUAGES } from '@/lib/language';
import type { SessionUser } from '@/stores/authStore';
import { buildProfileSchema, type ProfileValues } from '../schemas';

/**
 * The Account profile-edit form: name, username, languages. Email is shown
 * disabled (managed separately); `nativeLanguage` and `uiLanguage` ride along in
 * the payload unchanged — `updateUser` clears `nativeLanguage` when the key is
 * absent, so it must always be sent (`features/auth/types.ts`).
 *
 * Save stays disabled until the form is valid — in particular until >= 2
 * languages are selected (the same gate the backend now enforces).
 */
export function ProfileForm({ user, onDone }: { user: SessionUser; onDone: () => void }) {
    const { t } = useTranslation();
    const updateProfile = useUpdateProfile();
    const schema = useMemo(() => buildProfileSchema(t), [t]);

    const form = useForm<ProfileValues>({
        resolver: yupResolver(schema),
        defaultValues: {
            name: user.name,
            username: user.username,
            languages: user.languages,
        },
        mode: 'onChange',
    });

    const pending = updateProfile.isPending;
    const total = UI_LANGUAGES.length;

    function cancel() {
        onDone();
        toast.info(t('account:toasts.discarded'));
    }

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit(({ name, username, languages }) => {
                    updateProfile.mutate(
                        {
                            email: user.email,
                            name: name.trim(),
                            username: username.trim().replace(/^@/, ''),
                            languages,
                            uiLanguage: user.uiLanguage,
                            nativeLanguage: user.nativeLanguage,
                        },
                        {
                            onSuccess: () => {
                                toast.success(t('common:userData.toastMessages.updateSuccess'));
                                onDone();
                            },
                        },
                    );
                })}
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    {t('loginRegister:formLabels.name')} <span className="req">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input autoComplete="name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    {t('loginRegister:formLabels.username')}{' '}
                                    <span className="req">*</span>
                                </FormLabel>
                                <FormControl>
                                    <Input autoComplete="username" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="field sm:col-span-2">
                        <label className="label" htmlFor="account-email">
                            {t('loginRegister:formLabels.email')}
                        </label>
                        <Input
                            id="account-email"
                            value={user.email}
                            disabled
                            readOnly
                            aria-describedby="account-email-hint"
                        />
                        <p className="hint" id="account-email-hint">
                            {t('account:fields.emailHint')}
                        </p>
                    </div>
                    <FormField
                        control={form.control}
                        name="languages"
                        render={({ field, fieldState }) => (
                            <FormItem className="sm:col-span-2">
                                <div className="flex items-baseline justify-between gap-3">
                                    <FormLabel>
                                        {t('account:sections.languages')}{' '}
                                        <span className="req">*</span>
                                    </FormLabel>
                                    <span className="hint">
                                        {t('account:languages.count', {
                                            count: field.value.length,
                                            total,
                                        })}
                                    </span>
                                </div>
                                <LanguagePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    aria-invalid={!!fieldState.error}
                                />
                                <p className="hint">{t('account:languages.orderHint')}</p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="mt-5 flex gap-2">
                    <Button type="submit" disabled={pending || !form.formState.isValid}>
                        {pending ? (
                            <>
                                <span className="spinner" />
                                {t('common:status.saving')}
                            </>
                        ) : (
                            t('common:buttons.saveChanges')
                        )}
                    </Button>
                    <Button type="button" variant="secondary" disabled={pending} onClick={cancel}>
                        {t('common:buttons.cancel')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
