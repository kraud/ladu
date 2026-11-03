import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { useUpdateProfile } from '@/features/auth/hooks';
import { UI_LANGUAGES } from '@/lib/language';
import type { SessionUser } from '@/stores/authStore';
import { buildLanguagesSchema, NO_NATIVE_LANGUAGE, type LanguagesValues } from '../schemas';
import { keepPairsWithin } from '../masteredPairs';
import { LanguagesCardFrame } from './LanguagesCardFrame';
import { MasteredPairsField } from './MasteredPairsField';
import { NativeLanguagePicker } from './NativeLanguagePicker';

/**
 * The edit form of the languages card: the selected languages, the native language (one badge out
 * of the selected languages) and the mastered language pairs. The hint of a field sits under its
 * title; the long hint of the pairs sits at the bottom of its field. It sends only `email` (the endpoint checks it) and these three fields:
 * `updateUser` keeps every field that is absent, so name and username cannot change here.
 * `nativeLanguage` goes as `null` when it is no longer a selected language, because the backend
 * rejects any other value. A pair leaves the list when one of its languages is unselected, and the
 * form is invalid while the pairs cover every pair of the selected languages.
 *
 * It draws the whole card: Save and Cancel sit in the header, where Edit languages is in view mode,
 * so the submit button belongs to the form through the `form` attribute.
 *
 * Save stays disabled until the form is valid — in particular until >= 2
 * languages are selected (the same gate the backend enforces).
 */
export function LanguagesForm({ user, onDone }: { user: SessionUser; onDone: () => void }) {
    const { t } = useTranslation();
    const updateProfile = useUpdateProfile();
    const schema = useMemo(() => buildLanguagesSchema(t), [t]);

    const form = useForm<LanguagesValues>({
        resolver: yupResolver(schema),
        defaultValues: {
            languages: user.languages,
            nativeLanguage:
                user.nativeLanguage && user.languages.includes(user.nativeLanguage)
                    ? user.nativeLanguage
                    : NO_NATIVE_LANGUAGE,
            masteredLanguagePairs: keepPairsWithin(user.masteredLanguagePairs, user.languages),
        },
        mode: 'onChange',
    });

    const pending = updateProfile.isPending;
    const total = UI_LANGUAGES.length;

    function cancel() {
        onDone();
        toast.info(t('account:toasts.discarded'));
    }

    const formId = 'languages-form';

    return (
        <Form {...form}>
            <LanguagesCardFrame
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
                    onSubmit={form.handleSubmit(({ languages, nativeLanguage, masteredLanguagePairs }) => {
                        updateProfile.mutate(
                            {
                                email: user.email,
                                languages,
                                nativeLanguage: languages.includes(nativeLanguage) ? nativeLanguage : null,
                                masteredLanguagePairs: keepPairsWithin(masteredLanguagePairs, languages),
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
                    <div className="flex flex-col gap-4">
                        <FormField
                            control={form.control}
                            name="languages"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <FormLabel>
                                            {t('account:sections.languages')} <span className="req">*</span>
                                        </FormLabel>
                                        <span className="hint">
                                            {t('account:languages.count', { count: field.value.length, total })}
                                        </span>
                                    </div>
                                    <p className="hint">{t('account:languages.orderHint')}</p>
                                    <LanguagePicker
                                        aria-label={t('account:sections.languages')}
                                        value={field.value}
                                        onChange={(next) => {
                                            field.onChange(next);
                                            // A pair cannot outlive one of its languages.
                                            form.setValue(
                                                'masteredLanguagePairs',
                                                keepPairsWithin(form.getValues('masteredLanguagePairs'), next),
                                                { shouldValidate: true },
                                            );
                                        }}
                                        aria-invalid={!!fieldState.error}
                                    />
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
                                return (
                                    <FormItem>
                                        <FormLabel>{t('account:fields.nativeLanguage')}</FormLabel>
                                        <p className="hint">{t('account:fields.nativeLanguageHint')}</p>
                                        <NativeLanguagePicker
                                            aria-label={t('account:fields.nativeLanguage')}
                                            languages={selected}
                                            value={value}
                                            onChange={field.onChange}
                                        />
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={form.control}
                            name="masteredLanguagePairs"
                            render={({ field }) => (
                                <MasteredPairsField
                                    languages={form.watch('languages')}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                </form>
            </LanguagesCardFrame>
        </Form>
    );
}
