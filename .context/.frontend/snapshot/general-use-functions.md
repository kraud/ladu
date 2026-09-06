# `generalUseFunctions.ts` — full export inventory

*2026-09-05. Verbatim behavioral transcription of `frontend/src/components/generalUseFunctions.ts` (748 lines) — the 26 KB pure-logic grab-bag. Almost all of it is UI-agnostic and **ports verbatim** to the rewrite; the migration plan Phase 2 already flags these as the first pure-util test targets. Every function below is listed with signature + behavior + quirks. Source lines refer to the current file.*

---

## 1. Language / PoS helpers

### `getCurrentLangTranslated(currentLang?: Lang)` — `:29-44`
`Lang → native name`: DE→"Deutsch", EE→"Eesti", EN→"English", ES→"Español", else "Not Found".

### `getLangKeyByLabel(languageLabel: Lang)` — `:558-561`
Inverse enum lookup: `Object.keys(Lang)[Object.values(Lang).indexOf(label)]` → the key (`"EN"` etc.), or `""` if not found. **Quirk**: takes the *value* ("English"), returns the *key* ("EN") — despite the name "ByLabel".

### `getPoSKeyByLabel(partOfSpeechLabel: PartOfSpeech)` — `:563-566`
Same inverse lookup for `PartOfSpeech` (value "Noun" → key `"noun"`).

### `partOfSpeechTranslator(t: TFunction)` — `:726-734`
Returns a closure `(partOfSpeech: string) => t(\`partOfSpeech.${getPoSKeyByLabel(...)}\`, {ns:'common'})`.

### `languageTranslator(t: TFunction)` — `:736-743`
Returns `(language: string) => t(\`languages.${language.toLowerCase()}\`, {ns:'common'})`.

## 2. Avatar / color

### `stringToColor(string)` — private — `:130-153`
Deterministic hash → hex color (djb2-style `hash = char + ((hash<<5)-hash)`, 3 bytes → `#rrggbb`). Returns `'black'` for empty.

### `stringAvatar(name, onlyOne?: "color"|"children")` — `:155-185`
Returns `{sx:{bgcolor: stringToColor(name)}, children: initials}`. Initials = first letter of each word, uppercased, **max 3** (`maxAmountInitials = 3`); `'-'` if empty. `onlyOne` returns just `{sx:{...}}` (color) or `{children:...}`.

## 3. Friendship helpers

### `checkIfAlreadyFriend(allFriendships, potentialFriendId)` — `:187-195`
`friendships.find(f => f.userIds.includes(potentialFriendId))` → `FriendshipData | undefined`. Relies on the legacy `userIds` array shape.

### `getFriendRequestButtonLabel(allFriendships, potentialFriendId)` — `:197-218` → `0|1|2|3`
- no friendship → `0` ("Add")
- `status === 'accepted'` → `3` ("Remove friend")
- else if `userIds[0] === potentialFriendId` → `1` ("Accept") — **requester position inferred from array order** (the exact fragility §8.2 redesigns away)
- else → `2` ("Cancel").

### `acceptFriendRequest(notification, friendships, triggerDeleteNotification, triggerUpdateNotification, triggerToasts?)` — `:220-240`
Finds the friendship where `userIds[0] == notification.content.requesterId`; if found: optional toasts, `triggerDeleteNotification(notification._id)`, then `triggerUpdateNotification({_id: friendship._id, status:'accepted'})`. **Quirk**: despite the name `triggerUpdateNotification`, the `_id` passed is a *friendship* id and the update targets the friendship status (confirmed `pages-social-account.md`). Else `toast.info('There was an error processing this request (no matching friendship request.')`.

### `getOtherUserDataFromFriendship(friendship, currentUserId)` — `:78-115`
Returns the participant that isn't `currentUserId`. If `friendship.usersData` present → find by `_id`; fallback sentinel `{_id:'no-matching-id', ...}`. Else derives from `friendship.userIds` → `{_id: otherId, name:'no-name-available', ...}`.

### `getListOfAvailableUsers(inputData)` — `:491-527`
Discriminated on `listType`:
- `'Friendships'`: maps each friendship → other-user, excludes those in `selectedUsersList` ids or `userIdsToIgnore`; returns `FriendshipData[]`.
- `'SearchResults'`: same exclusion over `SearchResult[]`.

## 4. Filter / search extraction

### `extractTagsArrayFromUnknownFormat(originalArray: FilterItem[])` — `:46-73`
If `originalArray[0]` is a tag with `restrictiveArray` → return that array (stackable filtering). Else if every item is a tag with `additiveItem` → return `map(additiveItem)`. Else `[]`.

### `getAllIndividualTagDataFromFilterItem(originalArray: FilterItem[])` — `:242-261`
Flattens filter items to a `TagData[]`: additive items pushed individually; a restrictive array **replaces** the whole list.

### `getAllIndividualWordDataFromSearchResult(originalArray: SearchResult[])` — `:263-275`
`SearchResult[]` → `WordDataBE[]` (only `type === 'word'` with `completeWordInfo`). Comment: should become required field.

### `checkEqualArrayContent(original, copy)` — `:75-86`
`length` equal AND every original item `includes`-present in copy. **Quirk**: `copy.includes` is reference/identity for objects — unreliable for `TagData[]` (own TODO).

### `getIntersectionBetweenLists(a, b)` — `:529-531`
`new Set(a)` filter over `b`.

## 5. Word-chip / display-label logic (the review-table cell labels)

### `getRequiredFieldsData(translation, partOfSpeech)` — **private** — `:335-470`
Returns the word for the *required* case of a translation, by PoS + language. **This is the same primary-case mapping the backend `getWordsSimplified` computes** (`wordController.ts:155-232`); keep them in sync. Mapping:
- Noun: EE `singularNimetavEE`, EN `singularEN`, ES `singularES`, DE `singularNominativDE`
- Adverb: EN `adverbEN`, ES `adverbES`, DE `adverbDE` (no EE)
- Adjective: EN `positiveEN`, ES `maleSingularES`, DE `positiveDE`, EE `algvorreEE`
- Verb: EN `simplePresent1sEN`, ES `infinitiveNonFiniteSimpleES`, DE `infinitiveDE`, EE `infinitiveMaEE`
- fallbacks: `"- missing <pos> label -"` / `"Part of speech not found"`.

### `getWordChipDataByLangInOrder(word, langPriorityList)` — `:277-313`
Finds the first translation whose language matches the user's language-priority order; returns `{...translation, displayLabel: getRequiredFieldsData(...), wordId: word._id}`. If no language matches, falls back to `word.translations[0]`. Uses `word._id` (legacy — TODO to rename).

### `getListOfBasicCaseFromExistingTranslations(word, langPriorityList)` — `:315-333`
For the review-table modal "reference" display: for each language in priority order, reads `word[\`data${key}\`]` (the simplified-row `dataXX` field) and joins the non-empty values with `/`. **This is what populates `existingTranslationsLabels` in the table cells.**

## 6. Timer / sorting / misc utilities

### `setTimerTriggerFunction(functionToRunAfterTimer, timer?)` — `:544-550`
**Module-level shared debounce**: `clearTimeout(timerID); timerID = setTimeout(fn, timer ?? 450)`. This is the single global timer shared by all 15 word forms' autocomplete arming (study §8.4 #4: cross-form interference + no unmount cleanup). **Rewrite to a per-instance `useDebouncedCallback`.**

### `waitDelay(ms)` — `:533`
`new Promise(res => setTimeout(res, ms))`.

### `shuffleArray(array)` — `:569-574`
Fisher–Yates in place, `Math.random`.

### `deterministicSort(array: string[])` — `:576-583`
**Not lexicographic**: sorts by the sum of `charCodeAt` over each string (`hashA - hashB`). Deterministic (no `Math.random`), used by MC option ordering. Port as-is if ordering must match; note it's unusual.

### `getVerbPronoun(personNumber, plurality, language)` — `:585-597`
Key `${person}${S|P}` into `SpanishPronouns`/`EnglishPronouns`/`GermanPronouns`/`EstonianPronouns`. Used to label verb-card prompts.

### `getChipFieldsByPoS(relevantWordDetails, currentPartOfSpeech, translateFunction)` — `:599-658`
Builds `InfoChipData[]` describing a case's linguistic metadata:
- verb property → `[{label:'-', value: verbPropertyCategory}]`; conjugated verb → `Type/verb, person, plurality, tense, [mood?]`.
- noun property → `[{label:'-', value: nounPropertyCategory}]`; noun → `Type/noun, declination, plurality`.

### `isVerbCasesData(data)` / `isNounCasesData(data)` — `:661-670`
Type guards on `isVerbProperty !== undefined` / `isNounProperty !== undefined`.

### `getWordDescriptionElements(relevantPoS, relevantCaseName)` — `:672-680`
Looks up `WordCasesData[relevantPoS]` (the 132-entry registry) and returns the entry whose `caseName` matches — the source of linguistic metadata for a given case.

### `interpolateColor(value)` — `:682-712`
3-point color ramp over `0..1`: `#d41243` → `#f47835` → `#8ec127`, returning hex. Used by the practice score header / progress.

## 7. Rebuild notes

- **Port verbatim**: everything in §1–§5 except `acceptFriendRequest`/`getFriendRequestButtonLabel` (replaced by §8.2 friendships redesign — requester position inference dies) and `setTimerTriggerFunction` (replaced by per-instance debounce).
- **Sync invariant**: `getRequiredFieldsData` must stay identical to `wordController.ts`'s `dataXX` extraction (§2.1 of `review-table.md`); consider generating both from `WordCasesData` in the rewrite.
- **Test targets** (migration plan Phase 2): `stringAvatar`, `getChipFieldsByPoS`, `deterministicSort`, `getOtherUserDataFromFriendship`, `getLangKeyByLabel`, `getCountryFlagURL`, `interpolateColor`, the filter-extraction trio.
