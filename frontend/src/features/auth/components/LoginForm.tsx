import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLogin } from '../hooks';
import { buildLoginSchema, type LoginValues } from '../schemas';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
    const { t } = useTranslation();
    const login = useLogin(redirectTo);
    const schema = useMemo(() => buildLoginSchema(t), [t]);

    const form = useForm<LoginValues>({
        resolver: yupResolver(schema),
        defaultValues: { email: '', password: '' },
    });

    return (
        <Form {...form}>
            <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) => login.mutate(values))}
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
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('loginRegister:formLabels.password')}</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="mt-1 w-full" disabled={login.isPending}>
                    {login.isPending ? (
                        <>
                            <span className="spinner" />
                            {t('loginRegister:login.submitting')}
                        </>
                    ) : (
                        t('loginRegister:login.submit')
                    )}
                </Button>
            </form>
        </Form>
    );
}
