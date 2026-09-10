import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguagePicker } from '@/components/common/LanguagePicker';
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

export function RegisterForm() {
    const { t, i18n } = useTranslation();
    const register = useRegister();
    const schema = useMemo(() => buildRegisterSchema(t), [t]);

    const form = useForm<RegisterValues>({
        resolver: yupResolver(schema),
        defaultValues: DEFAULTS,
        // The "Create account" button stays disabled until the form is valid —
        // in particular until >= 2 languages are picked.
        mode: 'onChange',
    });

    const pending = register.isPending;

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit(({ name, username, email, password, languages }) =>
                    // `password2` is enforced by the schema and never sent.
                    register.mutate({
                        name,
                        username,
                        email,
                        password,
                        languages,
                        uiLanguage: labelByI18nCode(i18n.language),
                    }),
                )}
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
                                    {t('loginRegister:formLabels.username')} <span className="req">*</span>
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
                                    {t('loginRegister:formLabels.password')} <span className="req">*</span>
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
                    <FormField
                        control={form.control}
                        name="languages"
                        render={({ field, fieldState }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel>
                                    {t('loginRegister:register.languagesLabel')}{' '}
                                    <span className="req">*</span>
                                </FormLabel>
                                <LanguagePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    aria-invalid={!!fieldState.error}
                                />
                                <p className="hint">{t('loginRegister:register.languagesHint')}</p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="mt-5 flex gap-2">
                    <Button
                        type="submit"
                        className="grow"
                        disabled={pending || !form.formState.isValid}
                    >
                        {pending ? (
                            <>
                                <span className="spinner" />
                                {t('loginRegister:register.submitting')}
                            </>
                        ) : (
                            t('loginRegister:register.submit')
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                            form.reset(DEFAULTS);
                            form.setFocus('name');
                        }}
                    >
                        {t('common:buttons.reset')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
