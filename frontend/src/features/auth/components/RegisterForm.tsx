import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguageTiles } from '@/components/common/LanguageTiles';
import { useRegister } from '../hooks';
import { buildRegisterSchema, type RegisterValues } from '../schemas';
import { labelByI18nCode } from '@/lib/language';

const DEFAULTS: RegisterValues = {
    name: '',
    username: '',
    email: '',
    password: '',
    password2: '',
    languages: [],
};

const STEP1_FIELDS = ['name', 'username', 'email', 'password', 'password2'] as const;

/**
 * Two in-page steps over one `useForm` (`MOCKUPS/auth/register.html`):
 * profile data, then a dedicated language-tiles screen. "Continue" only
 * validates step 1's fields client-side — the account is created by a
 * single `POST /api/users` fired from step 2, carrying both. `password2`
 * is enforced by the schema and never sent.
 */
export function RegisterForm() {
    const { t, i18n } = useTranslation();
    const register = useRegister();
    const schema = useMemo(() => buildRegisterSchema(t), [t]);
    const [step, setStep] = useState<1 | 2>(1);

    const form = useForm<RegisterValues>({
        resolver: yupResolver(schema),
        defaultValues: DEFAULTS,
        // The "Create account" button stays disabled until the form is valid —
        // in particular until >= 2 languages are picked.
        mode: 'onChange',
    });

    const pending = register.isPending;
    const languages = form.watch('languages');

    async function goToStep2() {
        const ok = await form.trigger(STEP1_FIELDS);
        if (ok) setStep(2);
    }

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit(
                    ({ name, username, email, password, languages: langs }) => {
                        // `password2` is enforced by the schema and never sent.
                        register.mutate({
                            name,
                            username,
                            email,
                            password,
                            languages: langs,
                            uiLanguage: labelByI18nCode(i18n.language),
                        });
                    },
                    // Belt-and-braces: if a step-1 field is somehow still invalid
                    // when step 2 submits, bounce back instead of leaving the
                    // user stuck on step 2 with no visible error.
                    (errors) => {
                        if (STEP1_FIELDS.some((name) => name in errors)) setStep(1);
                    },
                )}
            >
                {step === 1 && (
                    <section className="step-pane">
                        <span className="step-pill">{t('loginRegister:register.step1Pill')}</span>
                        <div className="form-head">
                            <h1 className="h2">{t('loginRegister:register.step1Title')}</h1>
                            <p>{t('loginRegister:register.step1Subtitle')}</p>
                        </div>

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
                                            <Input autoComplete="name" placeholder="Kai Rebane" {...field} />
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
                                            <Input autoComplete="username" placeholder="kai" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>
                                            {t('loginRegister:formLabels.email')} <span className="req">*</span>
                                        </FormLabel>
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
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('loginRegister:formLabels.password')}{' '}
                                            <span className="req">*</span>
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
                                            {t('loginRegister:formLabels.confirmPassword')}{' '}
                                            <span className="req">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="password" autoComplete="new-password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="step-actions">
                            <span className="hint grow">{t('loginRegister:register.continueHint')}</span>
                            <Button type="button" onClick={goToStep2}>
                                {t('loginRegister:register.continue')}
                            </Button>
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className="step-pane">
                        <span className="step-pill">{t('loginRegister:register.step2Pill')}</span>
                        <div className="form-head">
                            <h1 className="h2">{t('loginRegister:register.step2Title')}</h1>
                            <p>{t('loginRegister:register.step2Subtitle')}</p>
                        </div>

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
                            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                                {t('loginRegister:register.back')}
                            </Button>
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
                )}
            </form>
        </Form>
    );
}
