import {AdjectiveCases, AdverbCases, Lang, NounCases, PartOfSpeech, VerbCases} from "./enums";

export interface WordData {
    translations: TranslationItem[],
    partOfSpeech?: string,
    clue?: string,
    tags?: TagData[],
}
export interface WordDataBE {
    id: string, // TODO: should it be _id?
    translations: TranslationItem[],
    partOfSpeech: PartOfSpeech,
    clue?: string,
    tags?: TagData[],
}
export type TranslationItem = {
    language: Lang,
    cases: WordItem[]
} & (InternalStatus)

// part of form validation
export type InternalStatus = {
    completionState?: boolean // used while completing forms, not saved on BE
    isDirty?: boolean // used while completing forms, not saved on BE
}

export interface WordItem {
    word: string,
    caseName: NounCases | AdjectiveCases | AdverbCases | VerbCases, // the type on noun stored in "word" property
}

export type SearchResult = {
    id: string,
    label: string,
} & (WordSearch | TagSearch | UserSearch)

type WordSearch = {
    // NB! for type 'word', 'id' in SearchResult refers to the wordId (NOT the translation)
    type: "word",
    language: Lang,
    completeWordInfo: WordDataBE,
}

type TagSearch = {
    type: "tag"
    completeTagInfo?: TagData,
}

type UserSearch = {
    type: "user",
    email: string,
    username: string,
    languages: Lang[]
    // eventually, add profile picture info
}

export type UserData = {
    _id: string,
    name: string,
    username: string,
    email: string,
    languages: Lang[]
}

export type NotificationData = {
    _id: string,
    // user to be notified
    user: string | string[], // when retrieving notification data it will always be 1 user id

    // Notification's state:
    // DISMISSED: false => not read => badge on avatar (initial state)
    // DISMISSED: true => read => NO badge on avatar (ignored, but NOT deleted)
    // if accepted => we delete notification
    dismissed: boolean,
    notificationSender?: UserData // only present in BE response, not when creating the Notification
} & (FriendRequestData | ShareTagRequestData)

type FriendRequestData = {
    variant: "friendRequest"
    content: {
        requesterId: string,
        requesterUsername: string,
    }
}

type ShareTagRequestData = {
    variant: "shareTagRequest"
    content: {
        requesterId: string,
        tagId: string,
    },
    notificationTag?: TagData
}

export type FriendshipData = {
    _id?: string,
    userIds: string[],
    usernames?: string[], // not used anymore?
    status: 'pending' | 'accepted' | 'blocked',
    partnerships?: PartnershipsData[],
    usersData?: UserData[] // NB! Not stored on BE, only calculated when retrieving data.
}

type PartnershipsData = {
    mentor: string,
    language: Lang
}

// Matches tagModel in BE
export type TagData = {
    _id?: string, // can be undefined when creating a new tag
    author: string,
    label: string,
    description: string,
    public: 'Public' | 'Private' | 'Friends-Only',
    words: WordDataBE[]
} & (InternalStatus)

export interface PropsButtonData {
    id: string
    variant?: "contained" | "outlined" | "text"
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
    disabled?: boolean
    // TODO: add a calculateVisible, in case data needed to calculate if it should be displayed comes from where the button is being used
    // for situations where the data needed to calculate if it should be disabled comes from where the button is being used
    calculateDisabled?: (values: any) => boolean
    label?: string
    icon?: any
    onClick: (values: any) => unknown // returns unknown instead of void, in case setSelectionOnClick is true => return value is what to set
    setSelectionOnClick?: boolean
    isVisible?: boolean
    displayBySelectionAmount?: (amountSelected: number) => boolean, // greater than number => display
    requiresConfirmation?: boolean
    confirmationButtonLabel?: string
    cancellationButtonLabel?: string
}

export type FilterItem = {
    _id: string,
    filterValue: string, // also the label that will be displayed
} & (CaseFilter | TagFilter | PartOfSpeechFilter)

type CaseFilter = {
    type: 'gender'
    caseName: NounCases | string,
    language: Lang,
}

type TagFilter = {
    type: 'tag'
    // both properties will never be !== undefined at the same time (I think?)
    // TODO: we're not using restrictive this way anymore. We send all tags in an array like this,
    //  but BE implementation follows additiveItem description.
    //  RestrictiveArray description is currently too hard to implement
    restrictiveArray?: TagData[], // info of each Tag that needs to be present at the same time, single FilterItem can be very restrictive
    // NB! this property is not being used anymore. Its purpose was implemented using the restrictiveArray property.
    // TODO: should replace 'restrictiveArray' & 'additiveItem' with new property with a better name? Refactor AutocompleteMultiple accordingly.
    additiveItem?: TagData, // single tag info - this way we can filter by many FilterItems in parallel and each one adds more results
}

type PartOfSpeechFilter = {
    type: 'PoS'
    partOfSpeech: PartOfSpeech,
}

export type TagLabelAvailabilityStatus = {
} & (TagLabelNotAvailable | TagLabelAvailable)

type TagLabelNotAvailable = {
    isAvailable: false,
    tagId: string,
}
type TagLabelAvailable = {
    isAvailable: true,
}

export interface LanguageAndLabel {
    language: Lang,
    label: string
}

export interface EstonianAPIRequest {
    query: string,
    searchInEnglish?: boolean
}

export type EquivalentTranslationValues = {
    partOfSpeech: PartOfSpeech, // should match the one on WordData
    multiLang?: boolean,
    type?: 'Multiple-Choice' | 'Text-Input',
} & (TextInput | MultipleChoice)

export type PerformanceStats = {
    knowledge: Number,
    performance: any,
    wordId: string
}

export type TextInput = {
    type: 'Text-Input',
    matchingTranslations : {
        itemA: {
            language: Lang,
            case: NounCases | VerbCases | AdverbCases| AdjectiveCases,
            value: string,
        },
        itemB: {
            language: Lang,
            case: NounCases | VerbCases | AdverbCases | AdjectiveCases,
            value: string,
            translationId: any
        }
    }
} & (PerformanceStats)

export type MultipleChoice = {
    type: 'Multiple-Choice',
    matchingTranslations : {
        itemA: {
            language: Lang,
            case: NounCases | VerbCases | AdverbCases| AdjectiveCases,
            value: string,
        },
        itemB: {
            language: Lang,
            case: NounCases | VerbCases | AdverbCases | AdjectiveCases,
            value: string,
            otherValues: string[],
            translationId: any
        }
    }
} & (PerformanceStats)

export interface ExerciseResult {
    answer: string,
    correct: boolean,
    indexInList: number,
    time: number, // Date => will be used for statistics about this translation
}

export interface PerformanceParameters {
    caseName: string,
    translationLanguage: Lang
    record?: boolean,

    translationId?: string,

    performanceId?: string,
    word?: string,
    user?: any,
}

// Parameters for saving "actions" in a exercise card
export interface PerformanceActionParameters {
    performanceId: string,
    action?: "master" | "forget" ,
}

export interface InfoChipData {
    label: string,
    value: string
}