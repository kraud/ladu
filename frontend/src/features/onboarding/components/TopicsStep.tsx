import {
    AirplaneTiltIcon,
    BriefcaseIcon,
    CalendarBlankIcon,
    CheckIcon,
    CloudSunIcon,
    DeviceMobileIcon,
    ForkKnifeIcon,
    HeartbeatIcon,
    HouseLineIcon,
    PawPrintIcon,
    PlantIcon,
    RulerIcon,
    SmileyIcon,
    SoccerBallIcon,
    TShirtIcon,
    UsersThreeIcon,
    type Icon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MAX_TOPICS, MIN_TOPICS, TOPIC_IDS, type TopicId } from '../types';
import { StepHeading } from './StepHeading';

const TOPIC_ICONS: Record<TopicId, Icon> = {
    clothing: TShirtIcon,
    food_drink: ForkKnifeIcon,
    animals: PawPrintIcon,
    plants_nature: PlantIcon,
    weather: CloudSunIcon,
    body_health: HeartbeatIcon,
    technology_media: DeviceMobileIcon,
    home_living: HouseLineIcon,
    travel_transport: AirplaneTiltIcon,
    sports_hobbies: SoccerBallIcon,
    work_money: BriefcaseIcon,
    numbers_measures: RulerIcon,
    time_calendar: CalendarBlankIcon,
    feelings: SmileyIcon,
    people_family: UsersThreeIcon,
};

/** Step 3 (D15): pick 3 to 6 topics. Each chip has a topic icon that the check replaces in the same place, so the chips do not change size. Once 6 are picked, the others wait until one is removed. */
export function TopicsStep({ value, onChange }: { value: TopicId[]; onChange: (next: TopicId[]) => void }) {
    const { t } = useTranslation();
    const enough = value.length >= MIN_TOPICS;

    function toggle(topic: TopicId) {
        onChange(value.includes(topic) ? value.filter((id) => id !== topic) : [...value, topic]);
    }

    return (
        <>
            <StepHeading title={t('onboarding:topics.title')} subtitle={t('onboarding:topics.hint')} />
            <div className="ob-topics" role="group" aria-label={t('onboarding:topics.title')}>
                {TOPIC_IDS.map((topic) => {
                    const pressed = value.includes(topic);
                    const TopicIcon = TOPIC_ICONS[topic];
                    return (
                        <button
                            key={topic}
                            type="button"
                            className="chip chip-lg"
                            aria-pressed={pressed}
                            disabled={!pressed && value.length >= MAX_TOPICS}
                            onClick={() => toggle(topic)}
                        >
                            <span className="chip-lead" aria-hidden="true">
                                <TopicIcon size={17} className="chip-icon" />
                                <CheckIcon size={17} weight="bold" className="chip-check" />
                            </span>
                            {t(`onboarding:topics.names.${topic}`)}
                        </button>
                    );
                })}
            </div>
            <p className={enough ? 'ob-count ok' : 'ob-count'} aria-live="polite">
                {enough
                    ? t('onboarding:topics.countOk', { count: value.length, max: MAX_TOPICS })
                    : t('onboarding:topics.countLow', { min: MIN_TOPICS, max: MAX_TOPICS, count: value.length })}
            </p>
        </>
    );
}
