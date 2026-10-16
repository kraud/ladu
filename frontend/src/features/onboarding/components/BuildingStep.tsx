import { useTranslation } from 'react-i18next';
import { StepHeading } from './StepHeading';

/** Shown while the server creates the words and tags. */
export function BuildingStep({ words, topics }: { words: number; topics: number }) {
    const { t } = useTranslation();

    return (
        <div className="ob-building" role="status">
            <div className="ob-spinner-lg" aria-hidden="true" />
            <StepHeading title={t('onboarding:building.title')} subtitle={t('onboarding:building.text', { words, topics })} />
            <div className="ob-build-meter" aria-hidden="true">
                <span />
            </div>
        </div>
    );
}
