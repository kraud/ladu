import { ChatTeardropTextIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { STEP_META } from '../steps';
import { StepHeading } from './StepHeading';

/** The first screen: what to expect (the three questions; the word count is not listed). */
export function WelcomeStep() {
    const { t } = useTranslation();

    return (
        <div className="pt-1.5">
            <div className="ob-hero-mark" aria-hidden="true">
                <ChatTeardropTextIcon size={26} />
            </div>
            <StepHeading title={t('onboarding:welcome.title')} subtitle={t('onboarding:welcome.text')} />
            <ul className="ob-expect">
                {STEP_META.slice(0, 3).map(({ id, icon: Icon }) => (
                    <li key={id}>
                        <span className="e-ic" aria-hidden="true">
                            <Icon size={17} />
                        </span>
                        <span className="e-tx">
                            <b>{t(`onboarding:welcome.items.${id}.title`)}</b>
                            <span>{t(`onboarding:welcome.items.${id}.text`)}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
