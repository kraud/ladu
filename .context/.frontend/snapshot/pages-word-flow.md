Deliverable for the parent plan — persist verbatim to `local://plan-pages-word-flow.md`.

# Word domain — use-case inventory (frontend)

> Written read-only from repo code at repo root /Users/kraud/Documents/Repositories/Ladu/keelapp. Routes confirmed in `frontend/src/pages/management/RoutesWithAnimation.tsx`. State-shape notes cite the words slice, since WordForm's whole orchestration is keyed to its `word`/`isLoading`/`isSuccess`/`isError`/`message`.

## Routing map (RoutesWithAnimation.tsx)
- `/` → Dashboard (RoutesWithAnimation.tsx:55-59)
- `/addWord/:partOfSpeech?` → AddWord (RoutesWithAnimation.tsx:61-66)
- `/word/:wordId` → DisplayWord (navigated to from Review.tsx:234, WordForm.tsx:382, Header.tsx:221)

---

### Dashboard (route: `/`)
Purpose: Post-login landing showing a welcome banner, rotating language greeting, and the user's metrics panels.
Use cases:
1. Authenticated user opens `/` → system reads `state.auth.user` for the name (Dashboard.tsx:30) and dispatches `getUserMetrics()` on mount (Dashboard.tsx:40-42).
2. Unauthenticated (or after logout) user lands here → effect on `[user,navigate]` redirects to `/login` (Dashboard.tsx:33-37).
3. User reads greeting → welcome.title uses `currentUserName` (Dashboard.tsx:77-79); below it `SpinningText` cycles EN/ES/DE/EE localized strings (Dashboard.tsx:95-111), one i18n instance per language (Dashboard.tsx:19-25).
4. User views metrics → `UserInfoPanel` + `UserMetrics` render side by side, responsive grid (Dashboard.tsx:127-146); metrics are stored in Redux by getUserMetrics fulfilled.
Endpoints: `GET /api/metrics/...` transitively via `getUserMetrics` (metricSlice) — Dashboard itself only dispatches (Dashboard.tsx:15,41).
Guards/auth: client-side guard only — redirect to /login when `!user` (Dashboard.tsx:33-37). No server check here; real enforcement is the global `AuthVerify`.
Sequencing/effects: one mount effect → getUserMetrics (Dashboard.tsx:40-42); nav guard effect (Dashboard.tsx:33-37). No toasts/localStorage.
Reuse notes: dashboard is a container; `UserMetrics`/`UserInfoPanel` are chart components ported separately. `SpinningText` is generic (takes translations: {language,label}[]). No word-domain logic.

---

### AddWord (route: `/addWord/:partOfSpeech?`)
Purpose: New-word entry. Thin wrapper that renders WordForm in create mode (no initialState).
Use cases:
1. User clicks "add word" with ≥2 languages in Header (Header.tsx:119-124) → routed to `/addWord` (Header.tsx:120).
2. Route includes optional `:partOfSpeech` param (e.g. linking from a PoS-scoped place) → effect maps the label to a PoS key and stores in `paramPoS` (AddWord.tsx:37-42), then feeds `defaultSettings={{partOfSpeech:paramPoS}}` (AddWord.tsx:63-65).
3. WordForm submits → `onSave` calls `dispatch(createWord(wordData))` (AddWord.tsx:72-74). The rest of the create lifecycle (toasts, form reset) is owned by WordForm/words slice.
4. Unauthenticated → nav guard to /login (AddWord.tsx:31-35).
Endpoints: `POST /api/words` transitively via createWord thunk (wordSlice) called at AddWord.tsx:73.
Guards/auth: `!user` → navigate('/login') (AddWord.tsx:31-35).
Sequencing/effects: title derivation from `currentlySelectedPoS` (redux words) — getPoSKeyByLabel + t() (AddWord.tsx:25-29); render WordForm with defaultSettings + onSave only (AddWord.tsx:52-75). No toast/localStorage here.
Reuse notes: AddWord is a pure mount point for WordForm; all reusable orchestration lives in WordForm. `defaultSettings.partOfSpeech` is the only in-route input; the TODO at AddWord.tsx:63 hints future params.

---

### DisplayWord (route: `/word/:wordId`) — props `defaultDisabled?`
Purpose: View/edit an existing single word, or view a read-only copy (defaultDisabled) of a word that is not editable by the current user.
Use cases:
1. Mount (from Review double-click Review.tsx:234, header search Header.tsx:221, or toast link) → `dispatch(getWordById(wordId))` once (DisplayWord.tsx:41-45).
2. Word not found / load error → `isError` toast.error(displayWord.toastError) with fixed `toastId:"click-on-modal"` (DisplayWord.tsx:47-53).
3. Load success → `word` feeds WordForm `initialState` (DisplayWord.tsx:122); PoS label title from `currentlySelectedPoS` (DisplayWord.tsx:103-106).
4. Editing user: WordForm edit/save bubbles to onSave → builds updatedData {id,clue,tags,partOfSpeech,translations} then `dispatch(updateWordById)` and sets `finishedUpdating=false` (DisplayWord.tsx:109-121).
5. After update response: when `finishedUpdating==false && !isLoading` → toast.success(displayWord.toastUpdateSuccess) + reset finishedUpdating=true (DisplayWord.tsx:55-65).
6. Non-owner (word.user !== user._id) → WordForm gets `disableEditing` true (DisplayWord.tsx:124); combined with back button only (no delete/edit).
7. Back button (ArrowBack) → navigate(-1) history-back (DisplayWord.tsx:94-96).
Endpoints: `GET /api/words/:wordId` via getWordById (DisplayWord.tsx:43); `PUT /api/words/:wordId` via updateWordById (DisplayWord.tsx:119).
Guards/auth: reads state.auth.user; disableEditing when `word.user !== user._id` (DisplayWord.tsx:124). No redirect guard on this page (relies on being reached while authed).
Sequencing/effects: `finishedUpdating` is the local update-in-flight flag bridging to global words.isLoading (DisplayWord.tsx:38,55-65). Toast dedupe by fixed toastId "click-on-modal" (DisplayWord.tsx:50,60). Error/update toasts live here; the intermediate "saving…" toast comes from WordForm.notify.
Reuse notes: WordForm is the reusable engine; DisplayWord only wires data + update dispatch + success/error toasts. Note it also passes an explicit `defaultDisabled` prop when reused as read-only (e.g. word preview).

---

### WordForm (component; the orchestration hub) — 711 lines
Purpose: Single owner of the entire word compose/edit state: the `completeWordData` object (translations[] + partOfSpeech + clue + tags) and every flag machine that drives toasts, submit gating, and navigation. Shared by AddWord (create) and DisplayWord (edit/view).
Props: `onSave`, `initialState?` (edit), `title`, `subTitle`, `defaultSettings?{partOfSpeech,language}`, `defaultDisabled?`, `disableEditing?` (WordForm.tsx:22-35).
Use cases (create + edit + delete orchestration):
1. Edit mode hydration: when `initialState` arrives, set completeWordData from `filterAvailableTranslationsBySelectedLanguages(initialState.translations)` (drops languages not in user.languages, stamps completionState:true/isDirty:false), partOfSpeech, clue, tags (WordForm.tsx:78-96,157-169) and dispatch setSelectedPoS (WordForm.tsx:93).
2. defaultSettings (AddWord route PoS): set partOfSpeech + dispatch setSelectedPoS (WordForm.tsx:98-105).
3. Part-of-Speech gate: while `!partOfSpeech && !isLoading && initialState===undefined` render only the PartOfSpeechSelector; on pick set partOfSpeech + setSelectedPoS (WordForm.tsx:400-411, WordFormSelector.tsx). Otherwise render the full grid.
4. Available-languages recompute: every completeWordData.translations change recomputes which of user.languages are unselected (WordForm.tsx:108-112,263-288).
5. Submit (Save/Update): `sanitizeDataForStorage` strips per-language InternalStatus → builds clean translations as {cases,language} only, sets recentlyModified/clueRecentlyModified/tagsRecentlyModified flags, calls onSave({...completeWordData, translations:clean, partOfSpeech}) and re-disables forms on edit (WordForm.tsx:320-336). Submit button is disabled unless ≥2 translations, all complete (no incomplete completionState), has dirtiness (some isDirty OR clueRecentlyModified/tagsRecentlyModified), and forms not disabled (WordForm.tsx:509-519).
6. "Saving…" toast: the notify() effect fires toast.info(status.saving) only while isLoading AND recentlyModified/recentlyDeleted, to avoid toasting when the form was loaded from another screen (WordForm.tsx:124-133,342-353). Toast ref `toastId.current` stores the id (WordForm.tsx:68).
7. Create success: effect when isSuccess && word._id set && no initialState → `update(word._id)` morphs the saving toast into saved-success (with a "see details" link navigating to /word/:id) then `resetAll()` (WordForm.tsx:137-145,354-386, update render button at 381-382). resetAll clears PoS/word/selectedPoS/completeWordData and navigates to /addWord (WordForm.tsx:291-305).
8. Edit success toast is owned by DisplayWord (see above); WordForm update() would only be called here when wordId undefined (delete case) (WordForm.tsx:354-358).
9. Delete: ConfirmationButton confirm → `onClickDeleteWord` sets recentlyDeleted then dispatch deleteWordById(word._id) (WordForm.tsx:256-259); delete button shown only when editing and not disableEditing (WordForm.tsx:446-461).
10. Delete completion: effect when !isLoading && isSuccess && word._id===undefined && recentlyDeleted → `update()` renders deleted-success toast then navigate('/') to Dashboard (WordForm.tsx:115-121). (words slice sets word to initialState — _id undefined — on deleteWordById.fulfilled, wordSlice.ts:321-324.)
11. Per-language rows: completeWordData.translations.map → TranslationFormGeneric keyed by index; empty slots are placeholder `Object as unknown as TranslationItem` (WordForm.tsx:54-60,563-599). Keep forms visible during save (isLoading+recentlyModified) and hide only via hideView hack (WordForm.tsx:147-149).
12. Add another translation: button `addEmptyLanguageForm` pushes another placeholder Object onto translations, disabled when no availableLanguages or at 4 forms (WordForm.tsx:309-313,621-634).
13. Remove/clear language row: delegated from TranslationFormGeneric via removeLanguageFromSelected(index,willUpdate) which slices the array, optionally leaving a placeholder (WordForm.tsx:231-252).
14. Clue field: TextField (multiline) always when editing or when clue set; typing sets clueRecentlyModified (WordForm.tsx:640-671).
15. Tags field: `AutocompleteMultiple` (tag type) gated by checkEnvironmentAndIterationToDisplay(2); saveResults maps FilterItem → tag list + sets tagsRecentlyModified (WordForm.tsx:673-703). Env-gated so tags are hidden in prod until iteration 2.
16. Edit/Cancel/Reset toggle button: if disabledForms→ Edit (gated by iteration-2 check + toast if hidden) / if initialState → Cancel → reverseChangesInLocalWordState() (rehydrate from initialState + setDisabledForms true) / else create-mode → resetAll (WordForm.tsx:471-496,172-186). Button disabled when disableEditing (WordForm.tsx:492).
Endpoints: none directly — calls createWord/updateWordById/deleteWordById via props.onSave and wordSlice dispatch (WordForm.tsx:258,331; imported at top).
Guards/auth: disableEditing prop disables edit/delete (WordForm.tsx:492); delete row gated by initialState._id && !disableEditing (WordForm.tsx:443-449). No internal auth check.
Sequencing/effects (the flag machine): recentlyModified (saving toast trigger + keep-form-visible), recentlyDeleted (delete toast + navigate '/'), clueRecentlyModified/tagsRecentlyModified (submit-enablement), disabledForms (read/edit mode), hideView (render hack to force re-render of the language list after reverse). Toasts: notify() info → update() success morph, deduped through the single ref (WordForm.tsx:342-386). No localStorage. Navigation: /addWord after create-reset, '/' after delete, /word/:id from saved-success link.
Reuse notes: This is the reusable WordForm engine; its props (initialState/defaultSettings/defaultDisabled/disableEditing) are the clean public surface for the reimplementation. NB the architecture is bespoke (state machine + imperative flags + placeholder objects + toast-id juggling) and is a strong candidate for simplification (e.g. computed/derived state instead of the extra hideView/re-render effects flagged at WordForm.tsx:107,146,172-186). The data contract that matters downstream: translations are [{language, cases:[{caseName,word}]}] and word-level {partOfSpeech, clue, tags, _id}.

---

### TranslationFormGeneric (component)
Purpose: One bordered, per-language card: shows country-flag buttons for unselected languages, then (once a language is chosen/loaded) renders the appropriate PoS form and per-language remove/clear/add-language controls. Mirrors one index of WordForm.completeWordData.translations.
Use cases:
1. Hydration: effect syncs local `currentLang` from `currentTranslationData.language` on prop change (TranslationFormGeneric.tsx:73-77).
2. Language unselected (empty placeholder slot): render the "select language" label + flag button list (TranslationFormGeneric.tsx:150-183); picking a flag sets currentLang (no parent change yet) (TranslationFormGeneric.tsx:121-131).
3. Language selected: header shows country-flag-gradient border + title (componentStyles.translationForm:37-71, getCurrentLangTranslated) and body becomes WordFormSelector; a "switch language" hint appears when other languages remain (TranslationFormGeneric.tsx:84-95).
4. Language row data changes: WordFormSelector's form calls back; here we forward it but filter out empty cases (`cases.filter(nounCase => nounCase.word !== '')`) before calling props.updateFormData(index) (TranslationFormGeneric.tsx:195-202) — this prevents saving blank case rows.
5. Remove button (only when !defaultDisabled): disabled when <3 forms on screen (needs ≥2 translations), calls removeLanguageFromSelected(index,false) + setCurrentLang(null) (TranslationFormGeneric.tsx:228-245).
6. Clear button (only when language currently bound): calls removeLanguageFromSelected(index,true) (keeps placeholder slot) + setCurrentLang(null) (TranslationFormGeneric.tsx:253-260).
7. Switch-to-another-language: flag button when a language is already bound calls removeLanguageFromSelected(index,true) then setCurrentLang(new) (TranslationFormGeneric.tsx:121-131).
Endpoints: none — pure data-up plumbing to WordForm.
Guards/auth: none; `defaultDisabled` only switches to display-only mode (no bottom buttons, TranslationFormGeneric.tsx:204).
Sequencing/effects: currentLang local state synced from currentTranslationData (TranslationFormGeneric.tsx:36,73-77). Calls parent remove/update callbacks (props at TranslationFormGeneric.tsx:19-29). No toasts.
Reuse notes: generic shell — the only per-language visual is the gradient border map (EE/ES/DE/EN) (TranslationFormGeneric.tsx:38-66). Verbatim-portable as a generic "language slot" container.

---

### WordFormSelector (component)
Purpose: Pure dispatcher — given partOfSpeech + currentLang, returns the concrete language/PoS form. The heart of the duplication problem.
Use cases:
1. partOfSpeech=noun → getNounForm() (WordFormSelector.tsx:34-36); adjective→getAdjectiveForm (38-39); adverb→getAdverbForm; verb→getVerbForm (WordFormSelector.tsx:34-52); default → "PoS not available" text (WordFormSelector.tsx:51).
2. noun form switch on Lang → NounFormEN/ES/DE/EE each with {currentTranslationData, updateFormData→props.updateFormData, displayOnly=displayFieldsAsText} (WordFormSelector.tsx:206-247). Same pattern repeated for verb (55-104), adverb (106-146), adjective (148-201).
Endpoints: none.
Guards/auth: none. Unsupported PoS/Lang combos render i18n "not available" messages (WordFormSelector.tsx:51, 104, 146, 201, 247).
Reuse notes: THE evidence for the config-driven form engine: 4 PoS × up to 4 languages all dispatch through identical prop signatures. In the reimplementation replace this nested switch with a table [PoS][Lang]→form component or declarative field schema + per-lang case lists. Full file is just branching — no logic.

---

### forms/commonFunctions.ts (pure helpers)
Purpose: Shared pure utilities consumed by all PoS/Lang forms.
- getWordByCase(searchCase, currentTranslationData) — finds the case WordItem with matching caseName, returns its word or '' (commonFunctions.ts:11-20).
- getDisabledInputFieldDisplayLogic(disabled, fieldValue) — whether to render a field: always when editable, else only if it has content (hides empty disabled fields in read-only view) (commonFunctions.ts:23-29).
- getPartOfSpeechAbbreviated — PoS → 'n.'/'v.'/... (commonFunctions.ts:33-49).
- checkEnvironmentAndIterationToDisplay(n) — show feature only if env==='dev' or iteration>=n (commonFunctions.ts:61-68; drives the tags field at WordForm.tsx:673).
- German aux verbs JSON tables sein/haben/werden present+past (commonFunctions.ts:72-127).
- getAcronymFromVerbCaseTypes / getVerbCaseTypesFromAcronym — encode a DE verb-case selection as an acronym 'A-D-G' string for storage (commonFunctions.ts:129-182).
- checkForPatternPrefixDE + PrefixesVerbDE — detect separable-verb prefixes from infinitive (commonFunctions.ts:185-201).
Reuse notes: pure, stateless, verbatim-portable. Watch the environment-gating util — it reads process.env.REACT_APP_ENVIRONMENT_NAME/ITERATION (commonFunctions.ts:62-63), so the reimplementation must keep an equivalent feature-flag mechanism or drop the gates.

---

### forms/autocompleteFormFunctions.ts (sanitize transforms)
Purpose: Convert verbose external dictionary/API autocomplete payloads into the app's sparse TranslationItem {language, cases:[{caseName, word}]} form. Estonian logic is the requested focus.
Interfaces describe the external EE shape: SearchResultStructureEE with requestedWord/estonianWord/searchResult[].wordForms/translations (autocompleteFormFunctions.ts:46-65); wordForms carry {code,morphValue,value} (autocompleteFormFunctions.ts:25-30).
- getWordFromWordFormsList(list, APIcode) → finds the value for a given EE grammar code (e.g. 'SgN') (autocompleteFormFunctions.ts:68-73).
- getShortFormEENounIfExist(list) → returns first comma-part of 'SgAdt' value, else '-short form does not exist-' sentinel (autocompleteFormFunctions.ts:76-81).
- sanitizeDataStructureEENoun(request): foundNoun response. Only proceeds when searchResult present && wordClasses[0]==='noomen'. Builds EE noun cases from grammar codes: SgN→singularNimetavEE, PlN→pluralNimetavEE, SgG→singularOmastavEE, PlG→pluralOmastavEE, SgP→singularOsastavEE, PlP→pluralOsastavEE, plus shortFormEE only when short form exists (SgAdt parse != '-') (autocompleteFormFunctions.ts:85-131).
- sanitizeDataStructureEEAdjective(request): foundAdjective, requires partOfSpeech[0].code==='adj'; maps SgN/PlN/SgG/PlG/SgP/PlP → algvorreEE/pluralNimetavEE/singularOmastavEE/pluralOmastavEE/singularOsastavEE/pluralOsastavEE (autocompleteFormFunctions.ts:134-175).
- sanitizeDataStructureEEVerb(request): foundVerb, requires wordClasses[0]==='verb'; maps Sup→infinitiveMaEE, Inf→infinitiveDaEE, IndPrSg1..IndPrPl3→kindelPresent*, IndIpfSg1..Pl3→kindelSimplePast*, and (notably) PtsPtPs repeated 6× → kindelPastPerfect* all persons since the EE past-perfect is per-pronoun aux only (autocompleteFormFunctions.ts:177-252).
- sanitizeDataStructureESVerb(request): Spanish verb from a VerbESResponse conjugation object (indicative.present.singular/plural.first..third) → indicativePresent1s..3plES (autocompleteFormFunctions.ts:351-392).
Discriminated-union return types: foundNoun/foundAdjective/foundVerb plus payload, or not-found variant (autocompleteFormFunctions.ts:31-66,254-266).
Reuse notes: These transforms are the EE contract with the external dictionary API. The reimplementation must decide to (a) keep the EE grammar-code→case mapping and (b) keep the external-API call server-side or move it. The case→code maps (SgN/PlN/SgG/PlG/SgP/PlP, SgAdt short form) are the ground truth for Estonian noun declension autocomplete and should be ported verbatim. German/English autocomplete paths skip sanitize (response authored by own BE), Spanish noun gender returns {foundNoun/possibleMatch} handled in the slice (autocompletedTranslationSlice.ts:207-225).

---

### forms/AutocompleteButtonWithStatus.tsx (presentational)
Purpose: Single reusable autocomplete trigger+status used by noun forms (EE/DE/ES) and verb forms. Shows a state icon (empty query '?' / no-match '✗' / found '✓' / partial-match warning wand / loading disabled) plus an "Autocomplete" action button with tooltip.
Use cases:
1. User hasn't typed → icon '?', tooltip emptyQuery; action disabled (AutocompleteButtonWithStatus.tsx:44-52,73-75).
2. User typed but no stored autocompleteResponse yet → icon '✗' (noMatch), action disabled (AutocompleteButtonWithStatus.tsx:73-79,83-96).
3. User typed & response present → icon '✓' (foundMatch); action enabled (AutocompleteButtonWithStatus.tsx:97-109).
4. partialMatch label provided (e.g. ES gender "might not be a word" warning) → warning icon + partialMatch tooltip (AutocompleteButtonWithStatus.tsx:42,57-65,118-137).
5. loadingState → button + icon disabled (AutocompleteButtonWithStatus.tsx:78-80); forceDisabled can hard-disable (AutocompleteButtonWithStatus.tsx:80).
6. Click action → props.onAutocompleteClick() (AutocompleteButtonWithStatus.tsx:72).
Endpoints: none.
Guards/auth: none.
Sequencing/effects: none — pure presentational wrapper (icon state machine via getIconButton, AutocompleteButtonWithStatus.tsx:116-167).
Reuse notes: fully generic given tooltipLabels + queryValue + autocompleteResponse + loadingState; port as-is. The response is passed as `any`.

---

### NounFormEE (component — Estonian noun form)
Purpose: Editable Estonian noun declension sub-form (singular nominative + plural + genitive + partitive, short illative form, regularity radio). Autocomplete from the Estonian dictionary API.
Yup schema fields: regularity (no-numbers, regular|irregular), singularNimetav (required, no numbers), pluralNimetav, singularOmastav, pluralOmastav, singularOsastav, pluralOsastav, shortForm (all nullable, no-numbers-if-present) (NounFormEE.tsx:39-75).
Case push-up: effect on [regularity, all 6 case words, shortForm, isValid] rebuilds `currentCases` array mapping each local state → NounCases.regularityEE / singularNimetavEE / pluralNimetavEE / singularOmastavEE / pluralOmastavEE / singularOsastavEE / pluralOsastavEE / shortFormEE and calls updateFormData({language:EE, cases, completionState:isValid, isDirty}) (NounFormEE.tsx:78-117). All case words lowercased on push (NounFormEE.tsx:85,88,91,...).
Hydration: setValuesInForm reads each case back via getWordByCase then setValue(...shouldValidate,shouldTouch) + set local state; runs once on mount (NounFormEE.tsx:124-213).
Autocomplete:
- input effect: when singularNimetav non-empty, `setTimerTriggerFunction(()=>dispatch(getAutocompletedEstonianNounData({query:singularNimetav.toLowerCase(), searchInEnglish})), 600)` (NounFormEE.tsx:234-242).
- hideAutocompleteLoadingState when the stored response's singularNimetav case equals current query (NounFormEE.tsx:244-251) → stops the spinner when the debounced dispatch simply returned the same word.
- onAutocompleteClick: merges stored autocompletedTranslationNounEE.cases + a manually-added regularityEE case (not in BE response) then setValuesInForm + clears searchInEnglish (NounFormEE.tsx:218-232).
- UI row: AutocompleteButtonWithStatus + "search in English" checkbox (Tooltip about EE dictionary language) (NounFormEE.tsx:279-298).
Field rendering uses getDisabledInputFieldDisplayLogic to drop empty fields in read-only mode; each TextInputFormWithHook lowercases on change (NounFormEE.tsx:300-495).
Endpoints: `GET /api/autocompleteTranslations/estonian/noun/:query?searchInEnglish=` via getAutocompletedEstonianNounData (service:16; slice:48).
Guards/auth: token from auth.user.token read in the thunk (slice:51).
Reuse notes: one of the duplicated forms — 8 EE noun cells; yup (per-language required/no-number rules) + regularity radio + dictionary autocomplete. Strong candidate for declarative schema: the WordCasesData registry (see below) + per-lang field descriptors would replace this hand-written cell list.

---

### NounFormEN (component — English noun form)
Purpose: English noun sub-form: regularity radio + singular + plural. No autocomplete (EN autocomplete is a TODO).
Yup schema: regularity (no-numbers, regular|irregular), singular (required, no numbers), plural (nullable, no-numbers) (NounFormEN.tsx:23-44).
Case push-up: currentCases = regularityEN, singularEN, pluralEN (lowercased), updateFormData({language:EN, cases, completionState:isValid, isDirty:isDirty}) (NounFormEN.tsx:46-68).
Hydration: getWordByCase reads back and setValue+setState; runs once on mount (NounFormEN.tsx:71-95).
No AutocompleteButtonWithStatus (English endpoint marked not-implemented, autocompletedTranslationService.ts:84-91; slice TODO at :155).
Endpoints: none.
Guards/auth: none.
Reuse notes: simplest form — confirms the "reduced per-language surface" pattern: EN nouns need only regularity/singular/plural (3 cells) while EE needs 8 and DE 10.

---

### Noun form field inventory across EN/ES/DE/EE (for the first vertical slice)
Gathered from each form's `currentCases`/yup block; the WordCasesData registry (wordCasesDataByPoS.ts:78-224) mirrors these and is the declarative source to build the slice from.
- EN noun: regularity (radio) | singular | plural — NounFormEN.tsx:46-60; registry singularEN/pluralEN at wordCasesDataByPoS.ts:80-86 (nominative S/P).
- ES noun: gender (radio el/la/el-la, required) | regularity (radio) | singular | plural — NounFormES.tsx:60-78 (currentCases order regularityES, singularES, pluralES, genderES); yup schema NounFormES.tsx:33-58; registry genderES (property category Gender) + singularES/pluralES at wordCasesDataByPoS.ts:87-97.
- DE noun: regularity (radio) | gender (radio der/die/das, required) | 4 cases × singular+plural: Nominativ, Akkusativ, Genitiv, Dativ — NounFormDE.tsx:93-135; yup NounFormDE.tsx:34-91; registry singularNominativDE/pluralNominativDE (+Akku/Gen/Dat) + genderDE at wordCasesDataByPoS.ts:100-153. DE shows all 4 declension cells per number (declension noun types: nominative/accusative/genitive/dative).
- EE noun: regularity (radio) | singularNimetav(required) | pluralNimetav | singularOmastav | pluralOmastav | singularOsastav | pluralOsastav | shortForm — NounFormEE.tsx:78-117; yup NounFormEE.tsx:39-75; registry at wordCasesDataByPoS.ts:160-223 (nominative/genitive/partitive per S/P + shortForm property).
Cross-language pattern (evidence for the engine): each form is identical boilerplate — yup object, ~N `useState('')`, a `currentCases` array mapping local state→caseName, updateFormData push-up, setValuesInForm hydration, optional autocomplete. Only (a) the yup required/no-numbers rules and (b) the case-name set differ per language. A declarative engine can derive the whole form from per-lang case lists (the WordCasesData registry) + per-lang yup modifiers + a "required" marker (only singularEN/singularES/singularNominativDE/singularNimetavEE and genders are required; all others optional-no-numbers).

---

### WordSimpleList (component)
Purpose: Practice screen side-panel — renders the exercise-selected words as small chips grouped by part of speech, filtered by the exercise's chosen languages and PoS set. Read-only.
Use cases:
1. Receives `wordsSelectedForExercises` (wordSimple rows) + `parameters` (ExerciseParameters with .languages/.partsOfSpeech) (WordSimpleList.tsx:12-16).
2. Groups rows by partOfSpeech, keeps only groups in parameters.partsOfSpeech, sorts by descending count (getWordsSeparatedByPoS, WordSimpleList.tsx:36-61).
3. For each group, counts words that have ≥1 translation in an active language (getAmountOfActiveWords, WordSimpleList.tsx:69-77).
4. Renders a chip per word showing each active-language translation as flag+text; tooltip reports the count of registered cases for that language (`registeredCases{lang}` field) (WordSimpleList.tsx:98-148).
Key model difference: works on flat denormalized wordSimple rows whose per-language translations live as `dataEN`/`dataES`/`dataDE`/`dataEE` keys (getFormattedKeyString builds `data`+Lang, WordSimpleList.tsx:63-68) and `registeredCasesEN`-style counts — NOT the nested TranslationItem model used by the word CRUD forms. Field lookups are dynamic string keys (WordSimpleList.tsx:20-26).
Endpoints: none.
Guards/auth: none (already-filtered data provided by parent Practice page).
Reuse notes: bespoke to the practice exercise panel and coupled to the denormalized wordSimple shape + ExerciseParameters; note this for the reimplementation because the word list/table surface (Review) and the CRUD surface (forms) model words differently — decide on a single canonical shape for the vertical slice.

---

### ts/wordCasesDataByPoS.ts (structure only)
Purpose/encoded data: a static, declarative registry mapping every supported Noun/Verb case identifier to (a) its language, (b) whether it is a lexical declension cell or a non-lexical property (regularity/gender/shortForm etc.), and (c) for declension cells: plurality (S/P), person (1|2|3), tense, mood; for property cells: a category (Gender / Short-Form / Regularity / Infinitive / Gerund / Participle / verbCaseType / auxiliaryVerb / prefix / etc.).
- Types: NounCasesData / VerbCasesData discriminated unions (wordCasesDataByPoS.ts:15-24, 37-47); NounPropertyCategories enum {gender, shortForm} (:26-29); VerbPropertyCategories enum (:51-61).
- Shape: WordCasesDataByPoS { Noun: NounCasesData[], Verb: VerbCasesData[] } (:73-76); constant WordCasesData (:78).
- Noun entries: EN singular/plural; ES gender/singular/plural; DE gender + 4 cases ×2; EE 6 cases + shortForm (noun entries wordCasesDataByPoS.ts:80-223). Verb entries: EN present/past/etc; ES; EE; DE (Verb: array from :225 to ~:1193) with person/plurality/tense/mood for each conjugated cell.
Why portable verbatim: this file is pure data — no imports beyond enums, no runtime logic, no external deps. It is the canonical description of every declension cell the product can store for Noun and Verb and can drive (a) the config-driven form engine (derive yup fields, labels, ordering), (b) the backend word schema validation, and (c) exercise/review generation. Port it verbatim in the clean repo. Caveat: it currently covers only Noun and Verb (interface :73-76) — adjectives/adverbs have case enums (enums.ts:44-95) but are NOT yet in the registry; keep the reimplementation's registry extensible to those PoS.

---

### ts/enums.ts (structure only)
Purpose: The single source of string-valued case & grammar identifiers used across forms, registry, autocomplete transforms and backend contracts.
- NounCases: per-language constants — EN regularity/singular/plural; ES regularity/gender/singular/plural; DE regularity/gender + singularNominativ/pluralNominativ/Akkusativ/Genitiv/Dativ; EE regularity + singular/plural Nimetav/Omastav/Osastav + shortForm (enums.ts:2-42).
- AdverbCases: EN adverb/comparative/superlative; ES same; DE gradable/adverb/comparative/superlative (enums.ts:44-59).
- AdjectiveCases: EN positive/comparative/superlative; ES male/female/neutral × S/P; DE positive/komparativ/superlativ; EE alg/kesk/ulivorre + plural Nimetav/Omastav/Osastav + singular declension (enums.ts:62-95).
- VerbCases: huge per-language set — EN regularity + simple present/past/future/conditional per-person + progressive/perfect/perfect-progressive PPFC-all; ES regularity + non-finite (infinitive/gerund/participle) + indicative present/imperfect/preterite/future/conditional per person + imperative; EE regularity + infinitiveMa/Da + kindel present/simplePast/pastPerfect per person; DE infinitive/auxVerb/caseType/prefix/regularity + indicative present/perfect/simpleFuture/simplePast per person (+ more later in file) (enums.ts:97-300+).
- Plus other enums (Lang, PartOfSpeech, VerbRegularity, GenderES, GenderDE, Plurality, DeclensionNoun, TenseVerb*, VerbMood*, VerbCaseTypeDE, PrefixesVerbDE) referenced by the registry and forms.
Why portable verbatim: enums are pure compile-time constants with stable string values equal to their keys; case identifiers are shared verbatim between frontend forms, wordCasesDataByPoS, backend serialization (caseName strings stored in DB, e.g. autocompletedTranslationSlice sanitize output uses the very same NounCases values) and autocomplete transforms. Copy this file unchanged into the clean repo to preserve DB-compatible case naming.

---

### features/autocompletedTranslation (slice + service; EE focus)
Purpose: Redux state + HTTP for autocomplete lookup of translations from external/own dictionary endpoints, storing the last successful (or failed) lookup per PoS+language so forms can arm the apply-button.
Slice state: per-result slots autocompletedTranslationNounEE/DE/ES, AdjectiveEE, VerbEN/ES/EE/DE + shared isErrorAT/isSuccessAT/isLoadingAT/messageAT (autocompletedTranslationSlice.ts:20-44).
Thunks (all read token from auth.user.token then call service): getAutocompletedEstonianNounData (:48), getAutocompletedEstonianAdjectiveData (:66), getAutocompletedSpanishVerbData (:84), getAutocompletedSpanishNounGender (:102), getAutocompletedGermanVerbData (:120), getAutocompletedGermanNounData (:138), getAutocompletedEnglishVerbData (not-implemented TODO, :156), getAutocompletedEstonianVerbData (:174).
ExtraReducers pattern (uniform for each thunk): pending → isLoadingAT=true; fulfilled → run sanitize (for EE noun/verb/adjective) then if found set isLoading=false/isSuccess=true/clear messageAT/store sanitized TranslationItem else set error + "There is not information in our system for that word." + clear slot; rejected → isLoading=false/isError=true/messageAT=payload + clear slot. EE noun: autocompletedTranslationSlice.ts:203-217; ES verb: :218-...; ES noun gender also sets a partial-match message when possibleMatch (autocompletedTranslationSlice.ts:207-225); EE verb sanitize :271-285; EE adjective sanitize :364-... .
Service (axios): base API_URL = REACT_APP_VERCEL_BE_URL + '/api/autocompleteTranslations' or same-relative (autocompletedTranslationService.ts:4-5); Bearer header config; EE endpoints append `params:{searchInEnglish}` (service:7-17 Estonian noun; verb :33-41) while ES/DE/EN pass no params; paths: /estonian/noun/:q, /estonian/adjective/:q, /estonian/verb/:q, /spanish/verb/:q, /spanish/noun/:q, /german/verb/:q, /german/noun/:q, /english/verb/:q (service:7-91).
Estonian sanitization focus (summary of transforms, detailed in autocompleteFormFunctions section): slice applies sanitizeDataStructureEENoun/EEVerb/EEAdjective on fulfilled (slice:204,272,365) — the reduce of grammar-code-bearing dictionary payloads into {language,cases[]}. EE noun short form is optional and gated by SgAdt existence; EE verb past-perfect duplicates PtsPtPs across persons.
Guards/auth: token fetched in each thunk from redux auth (slice:51,69,...); no local component auth.
Reuse notes: state shape is one slot per (PoS×Lang) result + 4 shared flags — results are `any` in the state. Autocomplete arming/debounce is the forms' job (module-level timer, see below); slice is purely request/status/sanitize storage. For the reimplementation: model as a per-target cache keyed by query or normalized, decide whether external dictionary calls stay front-end-proxied through BE (current: axios to same BE /api/autocompleteTranslations) or move server-side.

---

### Cross-cutting: autocomplete debounce/arming via module-level timers (generalUseFunctions.ts)
All noun/verb autocomplete effects arm a shared module-level debounce timer rather than a per-component one: `let timerID` at module scope + `setTimerTriggerFunction(fn, timer=450)` does `clearTimeout(timerID); timerID = setTimeout(fn, timer||450)` (generalUseFunctions.ts:544-551). Callers pass 600ms (NounFormEE.tsx:236, NounFormDE.tsx:277, NounFormES.tsx:168). Consequence: only the last-armed component's callback survives across the whole app — a hidden coupling; multiple simultaneous debounced forms would cancel each other. Port this as per-field timers in the reimplementation.

---

## Reimplementation guidance summary
1. Forms are the clearest config-driven-engine win: 4 PoS × ~4 langs all share an identical prop contract and differ only by yup rules + case list + optional autocomplete. Seed the engine's per-lang noun field lists from the acceptance inventory above (EN 3 cells, ES 4 incl. gender, DE 10 incl. gender, EE 8 incl. short-form), with required-cell flags (singular forms + genders) — enough to spec the vertical slice (noun create/view, ≥3 languages).
2. WordForm's imperative flag machine (recentlyModified/recentlyDeleted/clue/tags + hideView re-render hack + toast-id juggling) is the most bespoke surface; simplify with derived state, but preserve its observable contract: create→reset+navigate /addWord, update→success toast owned by DisplayWord, delete→toast+navigate '/', submit gating (≥2 translations, all complete, some dirty), empty-case filtering at TranslationFormGeneric, per-user-language filtering on hydration.
3. Keep `ts/enums.ts` + `ts/wordCasesDataByPoS.ts` and the EE grammar-code→case maps verbatim to stay DB/completion-compatible.
4. Replace module-level debounce timer with per-field timers.
5. Reconcile the two word shapes (nested TranslationItem used by forms vs flat wordSimple/registeredCases used by Review/WordSimpleList) before building the slice.

[You have received this identical output 3 times. Re-reading 'agent://PagesWordFlow?q=.report' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]