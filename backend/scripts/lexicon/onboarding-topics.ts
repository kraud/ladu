/**
 * The onboarding topic map (.context/plans/onboarding.md, Slice 1; decisions D2, D3).
 * word-lists.ts applies it to every ranked English lemma and writes the `topic` column.
 *
 * Nouns and verbs: only the first WordNet sense decides (a second sense let "person" become
 * Body & Health). The hypernym anchors are checked first (topics in TOPICS order), then the
 * direct supersenses. Verbs have no direct supersenses: `verb.possession` alone would put
 * have/get/take into Work & Money. A verb without an anchor is core vocabulary. An anchor matches when the sense's synset is the anchor or is under it
 * (hypernym / instance-hypernym chain). Adjectives and adverbs: the first PAGE_TOPICS entry
 * that is among the word's Wiktionary page topics (WordNet has no topics for them).
 *
 * Anchor ids are Open English WordNet 2025 synset ids (suffix -n noun, -v verb). `label` must be a
 * lemma that has the synset as a sense: word-lists.ts checks it, so an id that changes in a new
 * edition fails loudly.
 */

export interface TopicAnchor { id: string; label: string }
export interface Topic {
    id: string;
    /** Noun lexicographer files that map to the topic as a whole. Disjoint between topics. */
    supersenses: string[];
    anchors: TopicAnchor[];
}

/** Priority order: the first topic with a matching anchor wins (doctor: Body & Health, not Work). */
export const TOPICS: Topic[] = [
    { id: 'clothing', supersenses: [], anchors: [
        { id: 'oewn-03055525-n', label: 'clothing' },
        { id: 'oewn-03385713-n', label: 'footwear' },
        { id: 'oewn-03602662-n', label: 'jewelry' },
        { id: 'oewn-00046251-v', label: 'dress' }, // put on clothes
        { id: 'oewn-00047662-v', label: 'dress' }, // provide with clothes
        { id: 'oewn-00052091-v', label: 'wear' },
        { id: 'oewn-00047462-v', label: 'wear' },
    ] },
    { id: 'food_drink', supersenses: ['noun.food'], anchors: [
        { id: 'oewn-01170802-v', label: 'eat' }, // take in solid food
        { id: 'oewn-01168667-v', label: 'eat' }, // eat a meal (lunch, dine, snack)
        { id: 'oewn-01172332-v', label: 'drink' }, // take in liquids
        { id: 'oewn-01173463-v', label: 'drink' }, // consume alcohol
        { id: 'oewn-01668067-v', label: 'cook' }, // prepare for eating by applying heat
        { id: 'oewn-00323648-v', label: 'cook' }, // fry, roast, bake, grill
    ] },
    { id: 'animals', supersenses: ['noun.animal'], anchors: [] },
    { id: 'plants_nature', supersenses: ['noun.plant'], anchors: [
        { id: 'oewn-09310874-n', label: 'geological formation' },
        { id: 'oewn-09248053-n', label: 'body of water' },
        { id: 'oewn-09262646-n', label: 'celestial body' },
    ] },
    { id: 'weather', supersenses: [], anchors: [
        { id: 'oewn-11445694-n', label: 'atmospheric phenomenon' },
        { id: 'oewn-02762779-v', label: 'precipitate' }, // fall from clouds (rain, hail…)
        { id: 'oewn-02762516-v', label: 'rain' },
        { id: 'oewn-02764935-v', label: 'snow' },
    ] },
    { id: 'body_health', supersenses: ['noun.body'], anchors: [
        { id: 'oewn-14085287-n', label: 'illness' },
        { id: 'oewn-14309164-n', label: 'injury' },
        { id: 'oewn-03745652-n', label: 'medicine' },
        { id: 'oewn-00658847-n', label: 'medical care' },
        { id: 'oewn-10184702-n', label: 'health professional' },
        { id: 'oewn-00014735-v', label: 'sleep' },
        { id: 'oewn-00098938-v', label: 'heal' },
        { id: 'oewn-00081478-v', label: 'cure' },
        { id: 'oewn-00078513-v', label: 'treat' }, // provide treatment for (doctor, nurse)
    ] },
    { id: 'technology_media', supersenses: [], anchors: [
        { id: 'oewn-03283159-n', label: 'electronic equipment' },
        { id: 'oewn-03086983-n', label: 'computer' },
        { id: 'oewn-06578068-n', label: 'software' },
        { id: 'oewn-06264799-n', label: 'medium' },
        { id: 'oewn-06601855-n', label: 'publication' },
    ] },
    { id: 'home_living', supersenses: [], anchors: [
        { id: 'oewn-03551520-n', label: 'housing' },
        { id: 'oewn-04112987-n', label: 'room' },
        { id: 'oewn-03410635-n', label: 'furniture' },
        { id: 'oewn-03533443-n', label: 'home appliance' },
        { id: 'oewn-04389081-n', label: 'tableware' },
        { id: 'oewn-03626258-n', label: 'kitchen utensil' },
        { id: 'oewn-02823345-n', label: 'bedding' },
    ] },
    { id: 'travel_transport', supersenses: [], anchors: [
        { id: 'oewn-03105141-n', label: 'conveyance' },
        { id: 'oewn-04103160-n', label: 'road' },
        { id: 'oewn-00296527-n', label: 'travel' },
        { id: 'oewn-08542298-n', label: 'city' },
        { id: 'oewn-08562388-n', label: 'country' },
        { id: 'oewn-01849662-v', label: 'travel' }, // undertake a journey
        { id: 'oewn-01846997-v', label: 'travel' }, // travel for pleasure
        { id: 'oewn-01850858-v', label: 'travel' }, // travel upon or across (sail, cruise)
        { id: 'oewn-01934845-v', label: 'drive' }, // operate a vehicle
        { id: 'oewn-01934070-v', label: 'drive' }, // travel in a vehicle
        { id: 'oewn-01944262-v', label: 'fly' },
        { id: 'oewn-01959843-v', label: 'ride' }, // be carried in a vehicle
    ] },
    { id: 'sports_hobbies', supersenses: [], anchors: [
        { id: 'oewn-00524569-n', label: 'sport' },
        { id: 'oewn-00456623-n', label: 'game' },
        { id: 'oewn-09839665-n', label: 'athlete' },
        { id: 'oewn-03806455-n', label: 'musical instrument' },
        { id: 'oewn-07034009-n', label: 'music' },
        { id: 'oewn-00544270-n', label: 'music' }, // musical activity (singing…)
        { id: 'oewn-01075360-v', label: 'play' }, // participate in games or sport
        { id: 'oewn-01074673-v', label: 'compete' },
    ] },
    { id: 'work_money', supersenses: ['noun.possession'], anchors: [
        { id: 'oewn-10499838-n', label: 'professional' },
        { id: 'oewn-00583425-n', label: 'occupation' },
        { id: 'oewn-04609402-n', label: 'workplace' },
        { id: 'oewn-13405730-n', label: 'money' },
        { id: 'oewn-02211988-v', label: 'buy' },
        { id: 'oewn-02247246-v', label: 'sell' },
        { id: 'oewn-02256551-v', label: 'pay' }, // give money (spend, afford)
        { id: 'oewn-02415985-v', label: 'work' }, // be employed
    ] },
    { id: 'numbers_measures', supersenses: [], anchors: [
        { id: 'oewn-13763162-n', label: 'digit' },
        { id: 'oewn-13604927-n', label: 'unit of measurement' },
    ] },
    { id: 'time_calendar', supersenses: ['noun.time'], anchors: [] },
    { id: 'feelings', supersenses: ['noun.feeling'], anchors: [
        { id: 'oewn-01775456-v', label: 'feel' }, // undergo an emotional sensation (love, hate, worry)
    ] },
    { id: 'people_family', supersenses: ['noun.person'], anchors: [
        { id: 'oewn-10255246-n', label: 'relative' },
        { id: 'oewn-07986853-n', label: 'family' },
        { id: 'oewn-08094856-n', label: 'family' },
    ] },
];

/**
 * Adjectives and adverbs: Wiktionary page topic → onboarding topic, in priority order
 * ("cold" has Personality and Temperature: Temperature comes first). Colors and sizes have no
 * topic on purpose: they are core vocabulary.
 */
export const PAGE_TOPICS: [string, string][] = [
    ['Taste', 'food_drink'],
    ['Drinking', 'food_drink'],
    ['Temperature', 'weather'],
    ['Weather', 'weather'],
    ['Clothing', 'clothing'],
    ['Emotions', 'feelings'],
    ['Fear', 'feelings'],
    ['Love', 'feelings'],
    ['Sadness', 'feelings'],
    ['Time', 'time_calendar'],
    ['Days of the week', 'time_calendar'],
    ['Directions', 'travel_transport'],
    ['Wealth', 'work_money'],
    ['Occupations', 'work_money'],
    ['Personality', 'people_family'],
    ['Appearance', 'people_family'],
];

/**
 * Wiktionary sense tags that keep a word out of onboarding (D10) when one of the first
 * RESTRICTED_SENSES normal senses of the word's first entry has them. Autocomplete keeps the word.
 * A tag on any sense would be too broad: mother, dog, milk and apple all have one vulgar sense;
 * even the second sense catches girl and funny.
 */
export const RESTRICTED_SENSE_TAGS = ['vulgar', 'offensive', 'derogatory', 'slur'];
export const RESTRICTED_SENSES = 1;
/** Words whose first sense is harmless but which are risky in a starter set. */
export const RESTRICTED_LEMMAS = ['ass', 'balls', 'bang', 'bitch', 'cock', 'dick', 'hump', 'prick', 'pussy', 'screw', 'shag', 'tit'];

/** Self-assessed level → frequency-rank band (D4; draft, tuned in Slice 2). */
export const LEVEL_BANDS = [
    { level: 'beginner', maxRank: 2000 },
    { level: 'intermediate', maxRank: 6000 },
    { level: 'advanced', maxRank: 15000 },
] as const;


export interface TopicInput {
    partOfSpeech: string;
    /** WordNet senses in order: the synset id, its lexfile, and every synset above it. */
    senses: { synset: string; lexfile: string; ancestors: ReadonlySet<string> }[];
    pageTopics: ReadonlySet<string>;
}

export function topicFor({ partOfSpeech, senses, pageTopics }: TopicInput): string | null {
    if (partOfSpeech === 'Adjective' || partOfSpeech === 'Adverb') {
        return PAGE_TOPICS.find(([pageTopic]) => pageTopics.has(pageTopic))?.[1] ?? null;
    }
    const [sense] = senses;
    if (!sense) return null;
    const byAnchor = TOPICS.find((topic) =>
        topic.anchors.some((anchor) => anchor.id === sense.synset || sense.ancestors.has(anchor.id)));
    return (byAnchor ?? TOPICS.find((topic) => topic.supersenses.includes(sense.lexfile)))?.id ?? null;
}
