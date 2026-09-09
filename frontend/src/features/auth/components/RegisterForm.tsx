import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useRegister } from '../hooks';
import { buildRegisterSchema, type RegisterValues } from '../schemas';

const DEFAULTS: RegisterValues = { name: '', username: '', email: '', password: '', password2: '' };

export function RegisterForm() {
    const { t } = useTranslation();
    const register = useRegister();
    const schema = useMemo(() => buildRegisterSchema(t), [t]);

    const form = useForm<RegisterValues>({
        resolver: yupResolver(schema),
        defaultValues: DEFAULTS,
    });

    const pending = register.isPending;

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit(({ name, username, email, password }) =>
                    // `password2` is enforced by the schema and never sent.
                    register.mutate({ name, username, email, password }),
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
                </div>

                <div className="mt-5 flex gap-2">
                    <Button type="submit" className="grow" disabled={pending}>
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
