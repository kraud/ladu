import { useTranslation } from 'react-i18next';
import { MAX_TOPICS, MIN_TOPICS, TOPIC_IDS, type TopicId } from '../types';

/** Step 3 (D15): pick 3 to 6 topics. Once 6 are picked, the others wait until one is removed. */
export function TopicsStep({ value, onChange }: { value: TopicId[]; onChange: (next: TopicId[]) => void }) {
    const { t } = useTranslation();

    function toggle(topic: TopicId) {
        onChange(value.includes(topic) ? value.filter((id) => id !== topic) : [...value, topic]);
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('onboarding:topics.title')}>
                {TOPIC_IDS.map((topic) => {
                    const pressed = value.includes(topic);
                    return (
                        <button
                            key={topic}
                            type="button"
                            className="chip"
                            aria-pressed={pressed}
                            disabled={!pressed && value.length >= MAX_TOPICS}
                            onClick={() => toggle(topic)}
                        >
                            {t(`onboarding:topics.names.${topic}`)}
                        </button>
                    );
                })}
            </div>
            <span className="hint" aria-live="polite">
                {value.length < MIN_TOPICS
                    ? t('onboarding:topics.countLow', { min: MIN_TOPICS, max: MAX_TOPICS, count: value.length })
                    : t('onboarding:topics.countOk', { count: value.length, max: MAX_TOPICS })}
            </span>
        </div>
    );
}
