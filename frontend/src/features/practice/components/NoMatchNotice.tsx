import { WarningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * "No exercises found": the likely reasons and a way to adjust. Shared by the set-up
 * screen and the results screen ("Practice again" can also find nothing).
 */
export function NoMatchNotice({ onAdjust }: { onAdjust: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="banner warning items-start" role="status">
            <WarningIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
            <div className="flex flex-col items-start gap-2">
                <b>{t('practice:setup.noMatch.title')}</b>
                <div>
                    {t('practice:setup.noMatch.body')}
                    <ul className="ml-5 list-disc">
                        <li>{t('practice:setup.noMatch.reasonFewWords')}</li>
                        <li>{t('practice:setup.noMatch.reasonMissingForms')}</li>
                        <li>{t('practice:setup.noMatch.reasonMode')}</li>
                    </ul>
                    {t('practice:setup.noMatch.hint')}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAdjust}>
                    {t('practice:setup.noMatch.adjust')}
                </Button>
            </div>
        </div>
    );
}
