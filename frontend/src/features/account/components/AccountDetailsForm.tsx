import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpdateProfile } from '@/features/auth/hooks';
import type { SessionUser } from '@/stores/authStore';
import { buildDetailsSchema, type DetailsValues } from '../schemas';
import { AccountCardFrame } from './AccountCardFrame';
import { SignInMethodsField } from './SignInMethodsField';

/**
 * The edit form of the account card: name and username on two rows. Email is shown disabled (managed
 * separately), and the sign-in methods sit below. It draws the whole card: Save and Cancel sit in
 * the header, where Edit profile and Logout are in view mode, so the submit button belongs to the
 * form through the `form` attribute. It sends only `email` (the endpoint checks it),
 * `name` and `username`: `updateUser` keeps every field that is absent, so the language data of
 * the other card cannot change here. A demo account has no form: it cannot change its name or
 * username (demo-access.md D10), so its card has no edit button.
 *
 * Save stays disabled until the form is valid.
 */
export function AccountDetailsForm({ user, onDone }: { user: SessionUser; onDone: () => void }) {
    const { t } = useTranslation();
    const updateProfile = useUpdateProfile();
    const schema = useMemo(() => buildDetailsSchema(t), [t]);

    const form = useForm<DetailsValues>({
        resolver: yupResolver(schema),
        defaultValues: { name: user.name, username: user.username },
        mode: 'onChange',
    });

    const pending = updateProfile.isPending;

    function cancel() {
        onDone();
        toast.info(t('account:toasts.discarded'));
    }

    const formId = 'account-details-form';

    return (
        <Form {...form}>
            <AccountCardFrame
                user={user}
                actions={
                    <>
                        <Button type="submit" form={formId} disabled={pending || !form.formState.isValid}>
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
                    </>
                }
            >
                <form
                    id={formId}
                    noValidate
                    onSubmit={form.handleSubmit(({ name, username }) => {
                        updateProfile.mutate(
                            { email: user.email, name: name.trim(), username: username.trim().replace(/^@/, '') },
                            {
                                onSuccess: () => {
                                    toast.success(t('common:userData.toastMessages.updateSuccess'));
                                    onDone();
                                },
                            },
                        );
                    })}
                >
                    <div className="flex flex-col gap-3">
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
                                        {t('loginRegister:formLabels.username')} <span className="req">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input autoComplete="username" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="field">
                            <label className="label" htmlFor="account-email">
                                {t('loginRegister:formLabels.email')}
                            </label>
                            <Input id="account-email" value={user.email} disabled readOnly aria-describedby="account-email-hint" />
                            <p className="hint" id="account-email-hint">
                                {t('account:fields.emailHint')}
                            </p>
                        </div>
                        <div className="field">
                            <span className="label">{t('account:signInMethods.title')}</span>
                            <SignInMethodsField />
                        </div>
                    </div>
                </form>
            </AccountCardFrame>
        </Form>
    );
}
