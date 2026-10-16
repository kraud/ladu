/**
 * Tag names of the onboarding topics (.context/plans/onboarding.md D23): one Private tag per picked
 * topic and one for core vocabulary, named in the user's UI language when the words are created.
 * The app shows the topic grid with its own translations (Slice 4); keep both in step.
 */

export const TOPIC_LABELS: Record<string, Record<string, string>> = {
    clothing: { English: 'Clothing', Spanish: 'Ropa', German: 'Kleidung', Estonian: 'Riided' },
    food_drink: { English: 'Food & drink', Spanish: 'Comida y bebida', German: 'Essen und Trinken', Estonian: 'Toit ja jook' },
    animals: { English: 'Animals', Spanish: 'Animales', German: 'Tiere', Estonian: 'Loomad' },
    plants_nature: { English: 'Plants & nature', Spanish: 'Plantas y naturaleza', German: 'Pflanzen und Natur', Estonian: 'Taimed ja loodus' },
    weather: { English: 'Weather', Spanish: 'Clima', German: 'Wetter', Estonian: 'Ilm' },
    body_health: { English: 'Body & health', Spanish: 'Cuerpo y salud', German: 'Körper und Gesundheit', Estonian: 'Keha ja tervis' },
    technology_media: { English: 'Technology & media', Spanish: 'Tecnología y medios', German: 'Technik und Medien', Estonian: 'Tehnoloogia ja meedia' },
    home_living: { English: 'Home & living', Spanish: 'Casa y hogar', German: 'Haus und Wohnen', Estonian: 'Kodu ja elamine' },
    travel_transport: { English: 'Travel & transport', Spanish: 'Viajes y transporte', German: 'Reisen und Verkehr', Estonian: 'Reisimine ja transport' },
    sports_hobbies: { English: 'Sports & hobbies', Spanish: 'Deportes y aficiones', German: 'Sport und Hobbys', Estonian: 'Sport ja hobid' },
    work_money: { English: 'Work & money', Spanish: 'Trabajo y dinero', German: 'Arbeit und Geld', Estonian: 'Töö ja raha' },
    numbers_measures: { English: 'Numbers & measures', Spanish: 'Números y medidas', German: 'Zahlen und Maße', Estonian: 'Arvud ja mõõdud' },
    time_calendar: { English: 'Time & calendar', Spanish: 'Tiempo y calendario', German: 'Zeit und Kalender', Estonian: 'Aeg ja kalender' },
    feelings: { English: 'Feelings', Spanish: 'Sentimientos', German: 'Gefühle', Estonian: 'Tunded' },
    people_family: { English: 'People & family', Spanish: 'Personas y familia', German: 'Menschen und Familie', Estonian: 'Inimesed ja perekond' },
    core: { English: 'Core vocabulary', Spanish: 'Vocabulario básico', German: 'Grundwortschatz', Estonian: 'Põhisõnavara' },
};

/** The tag name of a topic (or 'core') in a UI language; English when the language is unknown or not set. */
export const topicLabel = (topic: string, uiLanguage: string | null | undefined): string =>
    TOPIC_LABELS[topic][uiLanguage ?? 'English'] ?? TOPIC_LABELS[topic].English;
