/** The pickable topics, in display order (onboarding.md D2). Same ids as `backend/scripts/lexicon/onboarding-topics.ts`. */
export const TOPIC_IDS = [
    'clothing',
    'food_drink',
    'animals',
    'plants_nature',
    'weather',
    'body_health',
    'technology_media',
    'home_living',
    'travel_transport',
    'sports_hobbies',
    'work_money',
    'numbers_measures',
    'time_calendar',
    'feelings',
    'people_family',
] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

/** Self-assessed level per language (D4). */
export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

/** D15 (changed in the 2026-10 pool refresh: at least 4 topics, no maximum) and D14. */
export const MIN_TOPICS = 4;
export const MIN_WORDS = 50;
export const MAX_WORDS = 150;
export const WORDS_STEP = 10;

/** The body of `POST /api/onboarding/capacity`; `levels` is keyed by language label. */
export interface OnboardingChoice {
    levels: Record<string, Level>;
    topics: TopicId[];
}

export interface CreateOnboardingRequest extends OnboardingChoice {
    count: number;
}

/** `POST /api/onboarding` → 201. */
export interface CreateOnboardingResponse {
    words: number;
    tags: { id: string; label: string; topic: string; words: number }[];
}
