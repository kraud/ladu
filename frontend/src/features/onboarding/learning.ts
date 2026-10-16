/** The languages a user learns: the account's languages minus the native one (all, when none is set). Same rule as the server. */
export function learningLanguages(languages: string[], nativeLanguage: string | null): string[] {
    return languages.filter((language) => language !== nativeLanguage);
}

/**
 * The slider's range for a capacity (D14, D18, D25): 50 to the capacity, in steps of 10. Under 50 the
 * minimum becomes the capacity itself. A capacity of 0 gives `null`: nothing can be created.
 */
export function sliderRange(capacity: number): { min: number; max: number } | null {
    if (capacity < 10) return null;
    return { min: Math.min(50, capacity), max: capacity };
}
