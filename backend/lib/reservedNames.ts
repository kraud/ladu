/**
 * Reserved names (verified-badges.md, slice 7). A badge only helps if nobody can
 * pretend to be "official", so a username or display name that looks like a
 * reserved word is refused.
 *
 * A name is first normalized, so look-alike tricks give the same text: width and
 * style variants (NFKC), case, accents, look-alike letters from other alphabets,
 * look-alike digits and symbols, and anything that is not a-z (spaces, dots,
 * dashes, zero-width characters).
 *
 *   contains  `ladu`, `official`                              -> refused
 *   equals    `admin`, `staff`, `support`, `moderator`, `team` -> refused
 *
 * "badminton" and "teammate" stay allowed: only the exact words are compared.
 *
 * Only a value that CHANGES is checked, so an existing account keeps its name. An
 * account with an active `official` badge is exempt (it may be called "Ladu").
 * The word list is never sent to the client.
 */
const { activeBadgesByUserIds }: typeof import('./badges') = require('./badges');
const { HttpError }: typeof import('./httpError') = require('./httpError');

const RESERVED_CONTAINS = ['ladu', 'official'];
const RESERVED_EXACT = ['admin', 'staff', 'support', 'moderator', 'team'];

/**
 * One character that looks like another. Applied after lowercasing and after the
 * accents are removed. Kept small on purpose: the common tricks, not every Unicode
 * confusable.
 */
const LOOKALIKES: Record<string, string> = {
  // Cyrillic
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ӏ: 'l', к: 'k', м: 'm', т: 't', н: 'h', в: 'b',
  // Greek
  α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  // Latin letters with a stroke or no dot, which do not split into base + accent
  ł: 'l', đ: 'd', ø: 'o', ı: 'i', ŧ: 't',
  // Digits and symbols
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'l',
};

/**
 * `i`, `l`, `1`, `!` and `|` look alike, and `1` can stand for either `i` or `l`
 * ("Off1cial", "1adu"). Both the name and the reserved words are folded to one letter,
 * so the comparison does not depend on which one the writer meant.
 */
const foldIl = (text: string): string => text.replace(/[il]/g, 'l');

/** The plain a-z form of a name. Exported for the tests. */
export const normalizeName = (value: string): string => {
  const plain = value
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    // Combining marks: "ú" -> "u", "õ" -> "o".
    .replace(/\p{M}/gu, '');
  const mapped = Array.from(plain, (char) => LOOKALIKES[char] ?? char).join('');
  return foldIl(mapped.replace(/[^a-z]/g, ''));
};

const FOLDED_CONTAINS = RESERVED_CONTAINS.map((word) => foldIl(word));
const FOLDED_EXACT = new Set(RESERVED_EXACT.map((word) => foldIl(word)));

/** True if `value` is, or contains, a reserved word after normalization. Not a string -> false. */
export const isReservedName = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = normalizeName(value);
  if (normalized === '') return false;
  return FOLDED_EXACT.has(normalized) || FOLDED_CONTAINS.some((word) => normalized.includes(word));
};

/** The two refusals. 400, with a code the learner app maps to a translated message. */
export const RESERVED_CODE = {
  username: 'username_reserved',
  name: 'name_reserved',
  // The display name comes from the Google profile: the person cannot change it in our
  // form, so the message must say where to change it.
  googleName: 'google_name_reserved',
} as const;

const RESERVED_MESSAGE = {
  username: 'This username is not available',
  name: 'This name is not available',
  googleName: 'The name of this Google account is not available',
} as const;

/** A refusal for a reserved name: 400 with an `apiCode` that the error middleware sends as `code`. */
export class ReservedNameError extends HttpError {
  constructor(
    readonly apiCode: string,
    message: string,
  ) {
    super(400, message);
  }
}

/**
 * Throws `ReservedNameError` if the username or the name (give only the ones that
 * are new or changed) is reserved. Pass `userId` for an existing account: an active
 * `official` badge exempts it. Pass `nameFrom: 'google'` when the name is the Google
 * profile name, for a message that says so. The username is checked first.
 */
export const assertNamesAllowed = async (
  fields: { username?: string; name?: string },
  options: { userId?: string; nameFrom?: 'google' } = {},
): Promise<void> => {
  const usernameBad = isReservedName(fields.username);
  const nameBad = isReservedName(fields.name);
  if (!usernameBad && !nameBad) return;

  if (options.userId) {
    const badges = (await activeBadgesByUserIds([options.userId])).get(options.userId) ?? [];
    if (badges.includes('official')) return;
  }

  if (usernameBad) throw new ReservedNameError(RESERVED_CODE.username, RESERVED_MESSAGE.username);
  if (options.nameFrom === 'google') throw new ReservedNameError(RESERVED_CODE.googleName, RESERVED_MESSAGE.googleName);
  throw new ReservedNameError(RESERVED_CODE.name, RESERVED_MESSAGE.name);
};
