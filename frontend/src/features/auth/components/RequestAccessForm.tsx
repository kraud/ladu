import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Link } from '@tanstack/react-router';
import { useCaptcha } from '@/features/captcha/useCaptcha';
import { useAccess, useRequestAccess } from '@/features/access/hooks';
import { buildRequestAccessSchema, type RequestAccessValues } from '../schemas';

/**
 * The form on `/request` (access-requests.md R3): the checkbox "I have an account" (it picks the
 * list the owner sees the request on), the email, and the button. The button stays off until the
 * email has a valid format, and, while the captcha is on, until the widget gives a token.
 * When the gate for the ticked kind is open, a request has no use: the form says so, links to the
 * real page, and keeps the button off (the server refuses it too, 409 `access_not_needed`).
 * `onSent` tells the page to show its "received" message: the server answers the same 202 for
 * every email, so the page never learns more.
 */
export function RequestAccessForm({ initialHasAccount, onSent }: { initialHasAccount: boolean; onSent: () => void }) {
    const { t } = useTranslation();
    const requestAccess = useRequestAccess();
    const captcha = useCaptcha('access_request');
    const { registration, login } = useAccess();
    const schema = useMemo(() => buildRequestAccessSchema(t), [t]);

    const form = useForm<RequestAccessValues>({
        resolver: yupResolver(schema),
        defaultValues: { email: '', hasAccount: initialHasAccount },
        mode: 'onChange',
    });

    const hasAccount = form.watch('hasAccount');
    const openAlready = (hasAccount ? login : registration).mode === 'open';

    return (
        <Form {...form}>
            <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit(({ email, hasAccount }) =>
                    requestAccess.mutate(
                        { email, hasAccount, captchaToken: captcha.token },
                        // A token works once: ask for a new one after a refusal.
                        { onSuccess: onSent, onError: captcha.reset },
                    ),
                )}
            >
                <FormField
                    control={form.control}
                    name="hasAccount"
                    render={({ field }) => (
                        <FormItem>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                                <span>{t('loginRegister:request.hasAccount')}</span>
                            </label>
                            <p className="hint">{t('loginRegister:request.hasAccountHint')}</p>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('loginRegister:formLabels.email')}</FormLabel>
                            <FormControl>
                                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {openAlready && (
                    <div className="banner info items-start" role="status">
                        <p>
                            {t('loginRegister:request.notNeeded')}{' '}
                            <Link to={hasAccount ? '/login' : '/register'}>
                                {hasAccount
                                    ? t('loginRegister:switchSectionButtons.signIn')
                                    : t('loginRegister:switchSectionButtons.createAccount')}
                            </Link>
                        </p>
                    </div>
                )}
                {captcha.widget}
                <Button
                    type="submit"
                    className="mt-1 w-full"
                    disabled={requestAccess.isPending || openAlready || !form.formState.isValid || !captcha.ready}
                >
                    {requestAccess.isPending ? (
                        <>
                            <span className="spinner" />
                            {t('loginRegister:request.submitting')}
                        </>
                    ) : (
                        t('loginRegister:request.submit')
                    )}
                </Button>
            </form>
        </Form>
    );
}
