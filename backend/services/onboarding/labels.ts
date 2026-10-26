/**
 * Tag names of the onboarding topics (.context/plans/onboarding.md D23): one Private tag per picked
 * topic and one for core vocabulary, named in the user's UI language when the words are created.
 * The app shows the topic grid with its own translations (Slice 4); keep both in step.
 */

export const TOPIC_LABELS: Record<string, Record<string, string>> = {
    clothing: { English: 'Clothing', Spanish: 'Ropa', German: 'Kleidung', Estonian: 'Riided', French: 'Vêtements' },
    food_drink: { English: 'Food & drink', Spanish: 'Comida y bebida', German: 'Essen und Trinken', Estonian: 'Toit ja jook', French: 'Nourriture et boissons' },
    animals: { English: 'Animals', Spanish: 'Animales', German: 'Tiere', Estonian: 'Loomad', French: 'Animaux' },
    plants_nature: { English: 'Plants & nature', Spanish: 'Plantas y naturaleza', German: 'Pflanzen und Natur', Estonian: 'Taimed ja loodus', French: 'Plantes et nature' },
    weather: { English: 'Weather', Spanish: 'Clima', German: 'Wetter', Estonian: 'Ilm', French: 'Météo' },
    body_health: { English: 'Body & health', Spanish: 'Cuerpo y salud', German: 'Körper und Gesundheit', Estonian: 'Keha ja tervis', French: 'Corps et santé' },
    technology_media: { English: 'Technology & media', Spanish: 'Tecnología y medios', German: 'Technik und Medien', Estonian: 'Tehnoloogia ja meedia', French: 'Technologie et médias' },
    home_living: { English: 'Home & living', Spanish: 'Casa y hogar', German: 'Haus und Wohnen', Estonian: 'Kodu ja elamine', French: 'Maison et logement' },
    travel_transport: { English: 'Travel & transport', Spanish: 'Viajes y transporte', German: 'Reisen und Verkehr', Estonian: 'Reisimine ja transport', French: 'Voyages et transports' },
    sports_hobbies: { English: 'Sports & hobbies', Spanish: 'Deportes y aficiones', German: 'Sport und Hobbys', Estonian: 'Sport ja hobid', French: 'Sports et loisirs' },
    work_money: { English: 'Work & money', Spanish: 'Trabajo y dinero', German: 'Arbeit und Geld', Estonian: 'Töö ja raha', French: 'Travail et argent' },
    numbers_measures: { English: 'Measures & quantities', Spanish: 'Medidas y cantidades', German: 'Maße und Mengen', Estonian: 'Mõõdud ja kogused', French: 'Mesures et quantités' },
    time_calendar: { English: 'Time & calendar', Spanish: 'Tiempo y calendario', German: 'Zeit und Kalender', Estonian: 'Aeg ja kalender', French: 'Temps et calendrier' },
    feelings: { English: 'Feelings', Spanish: 'Sentimientos', German: 'Gefühle', Estonian: 'Tunded', French: 'Sentiments' },
    people_family: { English: 'People & family', Spanish: 'Personas y familia', German: 'Menschen und Familie', Estonian: 'Inimesed ja perekond', French: 'Personnes et famille' },
    core: { English: 'Core vocabulary', Spanish: 'Vocabulario básico', German: 'Grundwortschatz', Estonian: 'Põhisõnavara', French: 'Vocabulaire de base' },
};

/** The tag name of a topic (or 'core') in a UI language; English when the language is unknown or not set. */
export const topicLabel = (topic: string, uiLanguage: string | null | undefined): string =>
    TOPIC_LABELS[topic][uiLanguage ?? 'English'] ?? TOPIC_LABELS[topic].English;
