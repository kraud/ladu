import { useTranslation } from 'react-i18next';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { FlagIcon } from '@/components/common/FlagIcon';
import { UI_LANGUAGES, languageByLabel } from '@/lib/language';
import type { SessionUser } from '@/stores/authStore';
import { InfoRow } from './InfoRow';
import { LanguagesCardFrame } from './LanguagesCardFrame';
import { LanguagesForm } from './LanguagesForm';

const nativeName = (label: string) => languageByLabel(label)?.native ?? label;

/**
 * The languages card (right on desktop): the selected languages, the native language and the
 * mastered language pairs. Its header has the title and its own edit button, shown only while no
 * card is being edited. While the card is edited, `LanguagesForm` draws the whole card: Save and
 * Cancel replace the edit button in the header.
 */
export function LanguagesCard({
    user,
    editing,
    canEdit,
    onEdit,
    onDone,
}: {
    user: SessionUser;
    editing: boolean;
    /** true while neither card is in edit mode */
    canEdit: boolean;
    onEdit: () => void;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const total = UI_LANGUAGES.length;
    const hasLanguages = user.languages.length > 0;

    if (editing) return <LanguagesForm user={user} onDone={onDone} />;

    return (
        <LanguagesCardFrame actions={canEdit && <Button onClick={onEdit}>{t('common:buttons.editLanguages')}</Button>}>
            <div className="flex flex-col gap-5">
                <div>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                        <p className="eyebrow">{t('account:sections.languages')}</p>
                        <span className="hint">
                            {hasLanguages
                                ? t('account:languages.count', { count: user.languages.length, total })
                                : t('account:languages.none')}
                        </span>
                    </div>

                    {hasLanguages ? (
                        <ul className="flex flex-wrap gap-1.5">
                            {user.languages.map((label) => {
                                const entry = languageByLabel(label);
                                return (
                                    <li key={label} className="chip">
                                        {entry && <FlagIcon lang={entry.key} />}
                                        {entry?.native ?? label}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="banner warning items-start">
                            <WarningCircleIcon className="mt-0.5 shrink-0" size={16} weight="bold" />
                            <span>
                                <b>{t('account:languages.emptyTitle')}</b>
                                <br />
                                {t('account:languages.emptyBody')}{' '}
                                <button
                                    type="button"
                                    className="font-semibold underline underline-offset-2"
                                    onClick={onEdit}
                                >
                                    {t('account:languages.emptyCta')} →
                                </button>
                            </span>
                        </div>
                    )}
                </div>

                <dl className="flex flex-col gap-1">
                    <InfoRow label={t('account:fields.nativeLanguage')} stacked>
                        {user.nativeLanguage ? (
                            // A badge, like the ones of the language list.
                            <span className="chip">
                                <FlagIcon lang={user.nativeLanguage} />
                                {nativeName(user.nativeLanguage)}
                            </span>
                        ) : (
                            t('account:fields.nativeLanguageNone')
                        )}
                    </InfoRow>
                    <InfoRow label={t('account:masteredPairs.title')} stacked>
                        {user.masteredLanguagePairs.length > 0 ? (
                            <ul className="flex flex-wrap gap-1.5">
                                {user.masteredLanguagePairs.map(([a, b]) => (
                                    <li key={`${a}|${b}`} className="chip whitespace-nowrap">
                                        <FlagIcon lang={a} />
                                        {nativeName(a)}
                                        {' & '}
                                        <FlagIcon lang={b} />
                                        {nativeName(b)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            t('account:masteredPairs.none')
                        )}
                    </InfoRow>
                </dl>
            </div>
        </LanguagesCardFrame>
    );
}
