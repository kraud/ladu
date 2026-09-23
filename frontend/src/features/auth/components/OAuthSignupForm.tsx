import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguageTiles } from '@/components/common/LanguageTiles';
import { decodeJwtPayload } from '@/lib/jwt';
import { labelByI18nCode } from '@/lib/language';
import { AuthLayout } from './AuthLayout';
import { useOAuthSignupComplete } from '../hooks';
import { buildOAuthSignupSchema, type OAuthSignupValues } from '../schemas';
import type { OAuthSignupTicketPreview } from '../types';

/**
 * Outcome (b)'s screen (oauth-login-strategy.md Phase 3) — a brand-new
 * Google identity with no account to log into yet. Username + languages
 * only: name and email already came from the verified ID token, carried
 * through in `ticket`. The username field is prefilled from the email's
 * local part (decoded client-side, unverified — purely a UX suggestion; the
 * server independently re-derives everything from its own verified copy of
 * the ticket) but stays editable, same as regular registration.
 */
export function OAuthSignupForm({ ticket }: { ticket: string }) {
    const { t, i18n } = useTranslation();
    const complete = useOAuthSignupComplete();
    const schema = useMemo(() => buildOAuthSignupSchema(t), [t]);

    const email = useMemo(() => decodeJwtPayload<OAuthSignupTicketPreview>(ticket)?.email ?? '', [ticket]);
    const defaultUsername = useMemo(() => email.split('@')[0] ?? '', [email]);

    const form = useForm<OAuthSignupValues>({
        resolver: yupResolver(schema),
        defaultValues: { username: defaultUsername, languages: [] },
        // The submit button stays disabled until >= 2 languages are picked —
        // same UX rule as RegisterForm's step 2.
        mode: 'onChange',
    });

    const pending = complete.isPending;
    const languages = form.watch('languages');

    return (
        <AuthLayout
            blurb={t('loginRegister:brand.subRegister')}
            title={t('loginRegister:oauth.signupTitle')}
            subtitle={t('loginRegister:oauth.signupSubtitle')}
        >
            <Form {...form}>
                <form
                    noValidate
                    onSubmit={form.handleSubmit(({ username, languages: langs }) => {
                        complete.mutate({
                            ticket,
                            username,
                            languages: langs,
                            uiLanguage: labelByI18nCode(i18n.language),
                        });
                    })}
                >
                    <section className="step-pane">
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

                        <FormField
                            control={form.control}
                            name="languages"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <LanguageTiles value={field.value} onChange={field.onChange} />
                                    {fieldState.error && (
                                        <p className="err show" style={{ marginTop: 8 }}>
                                            {fieldState.error.message}
                                        </p>
                                    )}
                                </FormItem>
                            )}
                        />

                        <div className="step-actions">
                            <span className="hint grow">
                                {languages.length === 0
                                    ? t('loginRegister:register.languageCountEmpty')
                                    : t('loginRegister:register.languageCountSelected', {
                                          count: languages.length,
                                      })}
                            </span>
                            <Button type="submit" disabled={pending || !form.formState.isValid}>
                                {pending ? (
                                    <>
                                        <span className="spinner" />
                                        {t('loginRegister:register.submitting')}
                                    </>
                                ) : (
                                    t('loginRegister:register.submit')
                                )}
                            </Button>
                        </div>
                    </section>
                </form>
            </Form>
        </AuthLayout>
    );
}
