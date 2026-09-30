import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateProfile } from '@/features/auth/hooks';
import { languageByLabel, UI_LANGUAGES } from '@/lib/language';
import type { SessionUser } from '@/stores/authStore';
import { buildProfileSchema, NO_NATIVE_LANGUAGE, type ProfileValues } from '../schemas';
import { SignInMethodsField } from './SignInMethodsField';

/**
 * The Account profile-edit form: name, username, languages, native language.
 * Email is shown disabled (managed separately); `uiLanguage` rides along in the
 * payload unchanged. `nativeLanguage` is always sent (`updateUser` clears it when
 * the key is absent, `features/auth/types.ts`) — and only when it is still one of
 * the selected languages, because the backend rejects any other value.
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
            nativeLanguage:
                user.nativeLanguage && user.languages.includes(user.nativeLanguage)
                    ? user.nativeLanguage
                    : NO_NATIVE_LANGUAGE,
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
                onSubmit={form.handleSubmit(({ name, username, languages, nativeLanguage }) => {
                    updateProfile.mutate(
                        {
                            email: user.email,
                            name: name.trim(),
                            username: username.trim().replace(/^@/, ''),
                            languages,
                            uiLanguage: user.uiLanguage,
                            nativeLanguage: languages.includes(nativeLanguage) ? nativeLanguage : null,
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
                    <div className="field sm:col-span-2">
                        <span className="label">{t('account:signInMethods.title')}</span>
                        <SignInMethodsField />
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
                    <FormField
                        control={form.control}
                        name="nativeLanguage"
                        render={({ field }) => {
                            // A language that was just unselected can no longer be the native one.
                            const selected = form.watch('languages');
                            const value = selected.includes(field.value) ? field.value : NO_NATIVE_LANGUAGE;
                            const labelOf = (v: string) =>
                                v === NO_NATIVE_LANGUAGE
                                    ? t('account:fields.nativeLanguageNone')
                                    : (languageByLabel(v)?.native ?? v);
                            return (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>{t('account:fields.nativeLanguage')}</FormLabel>
                                    <Select value={value} onValueChange={(next) => field.onChange(next)}>
                                        <SelectTrigger aria-label={t('account:fields.nativeLanguage')}>
                                            <SelectValue>{(v: string) => labelOf(v)}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_NATIVE_LANGUAGE}>{labelOf(NO_NATIVE_LANGUAGE)}</SelectItem>
                                            {selected.map((label) => (
                                                <SelectItem key={label} value={label}>
                                                    {labelOf(label)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="hint">{t('account:fields.nativeLanguageHint')}</p>
                                </FormItem>
                            );
                        }}
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
