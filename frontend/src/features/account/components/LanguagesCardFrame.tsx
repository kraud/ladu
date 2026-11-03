import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TranslateIcon } from '@phosphor-icons/react';
import { CardFrame } from './CardFrame';

/**
 * The frame of the languages card: a translation icon (accent colour, the size of the avatar of the
 * account card) and the title on the left of the header, the header buttons (`actions`) on the
 * right, and the body below a divider. The read-only view puts Edit languages in the header; the
 * edit form puts Save and Cancel there, in the same place as the account card.
 */
export function LanguagesCardFrame({ actions, children }: { actions: ReactNode; children: ReactNode }) {
    const { t } = useTranslation();
    const titleId = useId();

    return (
        <CardFrame
            labelledBy={titleId}
            lead={<TranslateIcon size={56} weight="bold" className="shrink-0 text-(--accent)" aria-hidden />}
            title={
                <h2 id={titleId} className="h2 text-lg">
                    {t('account:sections.languages')}
                </h2>
            }
            actions={actions}
        >
            {children}
        </CardFrame>
    );
}
