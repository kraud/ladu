import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { decodeJwtPayload } from '@/lib/jwt';
import { AuthLayout } from './AuthLayout';
import { useOAuthLinkComplete } from '../hooks';
import { buildOAuthLinkSchema, type OAuthLinkValues } from '../schemas';
import type { OAuthTicketPreview } from '../types';

/**
 * Outcome (c)'s screen (oauth-login-strategy.md Phase 4) — this Google
 * sign-in's email matches an existing password account. One password field:
 * proving the existing account's password is what actually authorizes the
 * link (never auto-linked on email match alone — see "Open questions" in
 * the plan doc). A wrong password rejects and stays on this same screen for
 * a retry; the ticket isn't consumed either way, so nothing needs restarting.
 */
export function OAuthLinkForm({ ticket }: { ticket: string }) {
    const { t } = useTranslation();
    const link = useOAuthLinkComplete();
    const schema = useMemo(() => buildOAuthLinkSchema(t), [t]);

    const email = useMemo(() => decodeJwtPayload<OAuthTicketPreview>(ticket)?.email ?? '', [ticket]);

    const form = useForm<OAuthLinkValues>({
        resolver: yupResolver(schema),
        defaultValues: { password: '' },
    });

    const pending = link.isPending;

    return (
        <AuthLayout
            blurb={t('loginRegister:brand.subLogin')}
            title={t('loginRegister:oauth.linkTitle')}
            subtitle={t('loginRegister:oauth.linkSubtitle', { email })}
        >
            <Form {...form}>
                <form
                    noValidate
                    onSubmit={form.handleSubmit(({ password }) => {
                        link.mutate({ ticket, password });
                    })}
                >
                    <section className="step-pane">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {t('loginRegister:formLabels.password')} <span className="req">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="password" autoComplete="current-password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="step-actions">
                            <Button type="submit" disabled={pending} className="w-full">
                                {pending ? (
                                    <>
                                        <span className="spinner" />
                                        {t('loginRegister:oauth.linkingSubmitting')}
                                    </>
                                ) : (
                                    t('loginRegister:oauth.linkSubmit')
                                )}
                            </Button>
                        </div>
                    </section>
                </form>
            </Form>
        </AuthLayout>
    );
}
