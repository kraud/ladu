import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useRequestReset, useSetPassword } from '../hooks';
import {
    buildResetRequestSchema,
    buildResetSetSchema,
    type ResetRequestValues,
    type ResetSetValues,
} from '../schemas';

/**
 * One route, two modes (snapshot `pages-auth-shell.md` — ResetPassword):
 * "set" when both `userId` and `tokenId` are in the URL, "request" otherwise.
 * Each mode is a self-contained form so the value shapes and schemas stay
 * cleanly typed.
 */
export function ResetPasswordForm(
    props: { mode: 'request' } | { mode: 'set'; userId: string; tokenId: string },
) {
    return props.mode === 'set' ? (
        <SetPasswordForm userId={props.userId} tokenId={props.tokenId} />
    ) : (
        <RequestResetForm />
    );
}

function RequestResetForm() {
    const { t } = useTranslation();
    const requestReset = useRequestReset();
    const schema = useMemo(() => buildResetRequestSchema(t), [t]);

    const form = useForm<ResetRequestValues>({
        resolver: yupResolver(schema),
        defaultValues: { email: '' },
    });

    return (
        <Form {...form}>
            <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) => requestReset.mutate(values))}
            >
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('loginRegister:formLabels.email')}</FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="mt-1 w-full" disabled={requestReset.isPending}>
                    {requestReset.isPending ? (
                        <>
                            <span className="spinner" />
                            {t('loginRegister:resetPassword.submittingRequest')}
                        </>
                    ) : (
                        t('loginRegister:resetPassword.submitRequest')
                    )}
                </Button>
            </form>
        </Form>
    );
}

function SetPasswordForm({ userId, tokenId }: { userId: string; tokenId: string }) {
    const { t } = useTranslation();
    const setPassword = useSetPassword();
    const schema = useMemo(() => buildResetSetSchema(t), [t]);

    const form = useForm<ResetSetValues>({
        resolver: yupResolver(schema),
        defaultValues: { password: '', password2: '' },
    });

    return (
        <Form {...form}>
            <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit(({ password }) =>
                    // The payload key is `token` (= the URL's tokenId), not `tokenId`.
                    setPassword.mutate({ userId, password, token: tokenId }),
                )}
            >
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {t('loginRegister:formLabels.newPassword')} <span className="req">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input type="password" autoComplete="new-password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password2"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {t('loginRegister:formLabels.confirmNewPassword')}{' '}
                                <span className="req">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input type="password" autoComplete="new-password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="mt-1 w-full" disabled={setPassword.isPending}>
                    {setPassword.isPending ? (
                        <>
                            <span className="spinner" />
                            {t('loginRegister:resetPassword.submittingSet')}
                        </>
                    ) : (
                        t('loginRegister:resetPassword.submitSet')
                    )}
                </Button>
            </form>
        </Form>
    );
}
