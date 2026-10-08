/**
 * The key `lexemes.search_key` is stored and looked up by. The load script and the lookup
 * MUST use this same function, or a stored word is never found.
 *
 * Lowercase, Unicode NFC, trimmed. Accents are kept on purpose: removing them would merge
 * different words (Spanish "año" / "ano", German "schön" / "schon"). Accent-insensitive
 * matching belongs to the type-ahead (Slice E) and can get its own column there.
 */
export function searchKey(word: string): string {
    return word.normalize('NFC').trim().toLowerCase();
}
