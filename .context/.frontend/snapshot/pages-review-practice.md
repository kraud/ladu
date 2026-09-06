INFRA NOTE: no `write` tool is exposed to this subagent (only read/grep/glob/web_search/yield/hub). Parent (Main) must persist this report body verbatim to `local://plan-pages-review-practice.md`. Repo prefix frontend/src/. All evidence file:line.

### Review (route /review) — pages/Review.tsx
Purpose: browse/edit/delete the user's vocabulary as a multilingual table with server-side filters (PoS/gender/tags), per-column DnD language ordering, global search, row bulk actions, and hand-off of selected rows to /practice.
Use cases:
1. Mount w/ no URL params -> unfiltered load `dispatch(getWordsSimplified())` when size===0 (Review.tsx:78-102).
2. Mount w/ `?tags=<id>` -> only tags[0] fetched `dispatch(getTagById(searchParams.getAll("tags")[0]))`; placeholder currentTagFilters restrictiveArray=[{_id:param}] per tag (78-102). Multiple tags NOT all hydrated (TODO:86).
3. fullTagData arrives && _id matches URL tags[0] -> currentTagFilters restrictiveArray replaced with full tag data (112-119). Extra URL tags never hydrate.
4. Toggle filters (green chevron) -> displayFilers flip; hiding filters triggers unfiltered reload (353; 104-110).
5. DnD language order in sidebar -> allSelectedLanguages (DnDLanguageOrderSelector 431-467).
6. Column drag in table -> setOrderColumns -> changeLanguageOrderFromTable recomputes languages from visible column ids (123-127; prop 527).
7. Gender chips -> setCurrentGenderFilters (472-479; defs 130-156).
8. PoS chips -> setCurrentPoSFilters (481-488; defs 158-194).
9. Tag autocomplete (matchAll=true) -> setCurrentTagFilters (489-495).
10. Any filter change -> 10ms-debounced `getWordsSimplified([...PoS,...gender,...reduceFullTagData(tags)])` (216-223); reduceFullTagData strips TagData to {_id} (204-213).
11. Table body = language-match subset `filterWordsWithNoMatchesWithLanguageList(wordsSimple.words)` (304-319, 513) -> THE INDEX-MISMATCH SOURCE.
12. Selection-count-gated action buttons: create-exercises(>2,528-547), detailed-view(==1,549-555), assign-tag(>0,557-569), delete-selected(>0,confirmation,571-596).
13. Create exercises -> `dispatch(setWordsSelectedForExercises(getWordsDataFromRowSelection(rowSelection)))` + navigate('/practice') (535-539).
14. Detailed view -> navigate(`/word/<id>`) (228-236, 550).
15. Assign tag -> modal stores ids in selectedRowsForBulkTagAssign (560-564).
16. Tag modal Apply (>=1 tag) -> `applyNewTagToSelectedWordsById({selectedWords,newTagsToApply})` + setIsAddingTags (263-268; Apply ~660-680). Cancel/close -> handleOnModalClose resets (294-299).
17. Tags loading -> LinearIndeterminate in modal (~644-648).
18. Delete: ConfirmationButton -> deleteSelectedRows `deleteManyWordsById(ids)` + setFinishedDeleting(false); !finishedDeleting && !isLoading -> success toast + getWordsSimplified refresh (256-259; 270-283).
19. Apply-tags: isAddingTags && !isLoadingTags && isSuccessTags -> toast + close modal + getWordsSimplified refresh (285-293).
20. isError -> error toast; !user -> navigate('/login') (69-76).
Endpoints: GET /api/words/getSimplified (getWordsSimplified: 100,108,218,281,291); deleteManyWordsById (257); getTagById (85); applyNewTagToSelectedWordsById (267).
Guards/auth: no in-page guard beyond redirect-if-!user (74-75). Nav to /practice unguarded.
Sequencing/effects: filter debounce (216-223); filters-hidden reload (104-110); URL-tag hydration (78-102,112-119). KNOwN BUG (task-note region ~220): rowSelection keys are TanStack row indices mapped to `wordsSimple.words[parseInt(key)]` (234,242,251) BUT displayed rows are subset-filtered (513) and TranslationsTable re-indexes via globalFilter/sorting -> wrong-word targets under search/filter. Author TODOs: 231,237,246,580. otherLanguages never populated (55). Both bulk flows reload words (281,291). Modal styling duplicated with TableDataCell.
Reuse: TableFilters, AutocompleteMultiple, DnDLanguageOrderSelector, TableDataCell edit modal reusable; server filter contract (PoS/gender FilterItem[] + tag {_id}) port verbatim; extract generic modal.

### Practice (route /practice) — pages/Practice.tsx
Purpose: choose exercise parameters (optionally over preselected word set), generate exercises, answer cards, view results.
Use cases:
1. Mount unaccepted -> dispatch(resetExerciseList()) (124-128).
2. wordsSelectedForExercises>0 -> partsOfSpeech/preSelectedWords constrained to those words; relevantPoSForPreSelectedWords derived; WordSimpleList + word-selection title + blue border (130-141,101-107,239-277,182-190).
3. Edit parameter fields -> onParametersChange merge partial into parameters (292-306).
4. Accept (valid & !loading) -> onAcceptParameters maps preSelectedWords->ids + `dispatch(getExercisesForUser(dispatchParameters))` + setAcceptedParameters (109-121, wired 300).
5. Success -> spinner cleared; ExerciseCard for exercises[currentCardIndex] (310-352); loading via isError/isSuccess/isLoadingExercises (59).
6. Answer a card -> setExercisesResults appends ExerciseResult to cardAnswers (347-353).
7. Nav prev/next -> setCurrentCardIndex (forward resets performance slice, ExerciseCard.tsx:1047-1057).
8. All answered && currentCardIndex===exercises.length -> EndScreen (displayEndScreen 91-99; branch 322-333).
9. Score header: live "X/N" uses amountCorrectExercises/interpolateColor; end => final score green (91-100,219-235; text 225-228).
10. Reset -> parameters to initialParameters (re-derive PoS if preselected), acceptedParameters false, idx 0, cardAnswers [], resetExercisesPerformanceSliceState + resetExerciseList (143-159).
11. exercises[] empty after accept -> ExerciseCard no-match empty state (ExerciseCard.tsx:760-878).
Endpoints: GET /api/exercises/getUserExercises — getExercisesForUser (119; service).
Guards: none; needs auth for initialParameters (languages,nativeLanguage) & token (60-76). Defaults: type Text-Input, multiLang Random, wordSelection Exercise-Performance.
Sequencing: wordsSelectedForExercises effect only when length>0 (130-141). displayEndScreen pure; back-nav from EndScreen returns to card because setCurrentCardIndex passed down (328-330; EndScreen 421-423).
Reuse: ExerciseParameters type here (34-51) imported by selector/card/endscreen — move to shared types. PoS hardcoded noun+verb (62, TODO). State machine clean & portable.

### TranslationsTable — components/table/TranslationsTable.tsx
Purpose: generic table over rowData: global search, sort, optional per-column filter, multi-select, column drag-reorder, Display-gender toggle, dynamic action-button row.
Use cases:
1. rowData/isLoading change -> setRowData(props.rowData) (114-116).
2. sortedAndSelectedLanguages/displayGender change -> resetColumnOrder + setColumns(calculateColumns(displayGender)) (146-152).
3. Global search DebouncedTextField (750ms) -> setGlobalFilter -> getFilteredRowModel (327-335; 128,134).
4. Per-column header search (397-401, 500ms) — inert because Review columns all enableColumnFilter:false.
5. Header click -> getToggleSortingHandler (355).
6. Display-gender Switch (only when partsOfSpeech includes Noun) -> setDisplayGender (314-324).
7. Drag column header -> onDragStart (158-179); onDrop validates not select/type/tags(0,1,last) then setOrderColumns (182-211); toast errors.
8. Checkbox select -> onRowSelectionChange -> rowSelection (139-140).
9. customButtonList gated by isVisible & displayBySelectionAmount(count) (254-303); setSelectionOnClick -> onClick return replaces rowSelection (278-282) else onClick(rowSelection).
10. Delete returns {} to clear (Review.tsx:580).
11. Loading -> LinearProgress; 0 rows -> Loading/No-data (441-471).
Guards: none. Selection local-only (Review sees count/keys).
Sequencing: effects 114-116, 146-152. No localStorage.
Reuse: right seam to store row ids/data instead of indices (fix bug). Generic except Review-specific language-ordered columns; consider parent-provided columns.

### ReviewTableColumns — components/table/columns/ReviewTableColumns.tsx
Purpose: column factory createColumnsReviewTable.
Use cases (pure fn via calculateColumns, Review.tsx:514-525): per-language data columns DE/EE/EN/ES (gender, dataX, registeredCasesX; TableDataCell cell => inline edit) (52-221); leading user/select col (select-all + per-row checkbox + author Avatar/GroupIcon) (175-263); partOfSpeech Type col translated (263-296); trailing tags array col (297-323).
Type TableWordData (13-49) reused by TranslationsTable rowData — keep in rewrite. Guards/effects: none.

### ExtraTableComponents — components/table/ExtraTableComponents.tsx
Exports TableHeaderCell, TableDataCell, IndeterminateCheckbox (+ private EllipsisText). TableDataCell use cases:
1. Hover (isHovering) reveals per-case counts/rings (129-139; 707-714).
2. Click text cell (not onlyForDisplay) -> openModal: getWordById + setSelectedPoS(PoS|'Tags') + open (142-155; 467-469).
3. Click tags / "+N" chip -> openModal array (391-394,454-455).
4. Tag chip click directly -> setSearchParams({"tags":id}) + clearWordsSimple (navigate/reload filtered) (417-420).
5. Text modal seeds selectedTranslationData from word.translations match language (170-206); author check (157-160).
6. Edit toggles labels/form; Save (dirty) -> updateWordById + setFinishedUpdating (617-681); done -> toast + getWordsSimplified (175-182).
7. Delete translation (text only, >=3 translations incl this & author) -> updateWordById without language (683-701; guarded button 886-905; post effect 184-199).
8. Empty text cell -> Add/Block(foreign) icon opens NEW translation form (740-767).
9. Tags modal -> AutocompleteMultiple allowNewOptions editing tags w/ dirty detection; Save dispatch updateWordById({id,tags}) (579-591,617-640).
10. Completion getPercentage(amount) max cases/PoS/lang (noun EN2/ES3/DE9/EE7; adverb EN3/ES3; adj EN3/ES3(2|4 by vowel-end)/DE3/EE8; else 99) (276-354) rendered as dual CircularProgress + DoneIcon 100% (507-560).
Endpoints: GET /api/words/:id (146); PUT /api/words/:id updateWordById (630,669,698); GET words refresh (198).
Guards: foreign words BlockIcon; Delete/Edit disabled !userIsWordAuthor (765,901-911); delete blocked if translations.length<=2.
Sequencing: openWordModal effects; dirty tracking; toasts; handleOnClose reset (232-241). Reuse: port bespoke cell modal faithfully; extract Modal shell; WordFormSelector reused (600).

### DebouncedTextField — components/table/DebouncedTextField.tsx
Generic controlled field deferring onChange by debounce ms (default 500). Local value mirrors initialValue; onChange after last keystroke (19-47). Pure generic; reuse verbatim (global search 750, column filter 500).

### TableFilters — components/TableFilters.tsx
Chip group. Click toggles chip (selected success/filled, unselected error/outlined+Add icon); singleSelection forces at-most-one; change -> applyFilters(sanitizeFilters()) (33-69, effect 67-69). No endpoints. Keep singleSelection semantics.

### ExerciseCard — components/ExerciseCard.tsx
Purpose: render one exercise (itemA question -> itemB answer) and evaluate/record the answer; master/forget actions.
Use cases:
1. checkIfCorrectAnswer (132-236): TI via checkTextInputAnswerByDifficulty (99-130: L1 strip accents+case => partial; L2 ignore case => partial; L3 exact); MC case-insensitive (143-145). Correct/partial/wrong toasts (180-225). Builds ExerciseResult {answer, correct:(!=='wrong'), indexInList, time} (226-233); `dispatch(saveTranslationPerformance(...))` (235) with record true/false.
2. TI TextField; Enter submits when enabled (324-334); readOnly after answered (337); Check button (1000-1010).
3. MC options getOptionsToDisplay (238-276): [correct + otherValues - dup], deterministicSort; buttons disabled after; selection colors success/error (266-286); click only if unanswered (273).
4. Post save effect merges exercisePerformance into exercises[idx].performance -> setExercises + resetExercisePerformance (378-394,386-392).
5. Prev ChevronLeft (703-721); Next ChevronRight (1040-1059, resetExercisesPerformanceSliceState on forward nav).
6. performanceShortcutButtons: % (record true/4) + 4 thumb icons from relevantCasePerformance.record (516-560); Master/Forget tooltip buttons (561-640; disabled until answered+performance).
7. Master -> ConfirmationModal -> handleMasterClick savePerformanceAction({action: mastered?undefined:'master', performanceId}) (948-963;404-410).
8. Forget -> ConfirmationModal -> handleForgetClick savePerformanceAction({action: revise?undefined:'forget', performanceId}) (965-979;412-418).
9. savePerformanceAction result -> toast (420-425).
10. Reset/back-to-params -> onClickReset (1092-1096). When all answered && length==length "Go to results" -> setCurrentCardIndex(exercises.length) (1104-1122).
11. No exercises -> empty state w/ LaduLogo + try-different-settings (760-878).
Endpoints: POST /api/exercises/saveTranslationPerformance (235); POST /api/exercises/savePerformanceAction (409,417).
Guards: back/forward disabled during isLoadingSendingPerformance & un-answered; MC double-submit guard currentCardAnswer===undefined; TI readOnly/disableCheckButton. textInputAnswer restored per index (368-372); resetCardState clears on nav (364-366,715).
Sequencing: performance merge effect only for fresh save (avoids clobbering master/forget); master/forget toggling by isPerformanceMastered/isPerformanceRevise+reviseCounter (69-73).
Reuse: normalization + performanceParameters build (translationLanguage, caseName, + user/translationId/word OR performanceId) is verbatim backend contract.

### ExerciseParameterSelector — components/ExerciseParameterSelector.tsx
Purpose: form collecting ExerciseParameters with validation.
Use cases:
1. Every edit -> runOnParametersChange() composing {languages, partsOfSpeech, amountOfExercises(parseInt), type, multiLang, mode:'Single-Try', difficultyMC, difficultyTI, nativeLanguage:user.nativeLanguage, ...override} -> props.onParametersChange (130-145).
2. Language DnD -> setAllSelectedLanguages + {languages} (254-255).
3. PoS checkbox -> runOnParametersChange() reading form (281-286).
4. Amount number field -> {amountOfExercises} (302-304).
5. type radio -> {type} (326-327); sliders cross-disabled by type.
6. multiLang radio -> {multiLang} (351).
7. Advanced collapse toggle (displayAdvancedOptions divider button ~399-415).
8. difficultyMC Slider 0..3 (enabled unless type Text-Input) -> setDifficultyMC + {difficultyMC} (~455-480).
9. difficultyTI Slider 1..3 (enabled unless type Multiple-Choice) -> {difficultyTI} (~505-530).
10. wordSelection radio -> {wordSelection} (~570-590).
11. If nativeLanguage && multiLang!=='Multi-Language': native-lang radio — Ignore sends nativeLanguage=user.nativeLanguage else undefined (~595-640); disabled when Multi-Language.
12. Create/accept disabled unless Yup-valid (PoS>=1; amount required/positive integer number-only) && !disabled -> props.onAccept() (640-652); loading bar when isLoading.
13. availablePoS seeded by preselected words; re-seeded on defaultParameters.partsOfSpeech change (181-184;247-288).
Guards: mode forced 'Single-Try' (138) though union permits Multiple-Tries (dead). r-h-f + yupResolver mode 'all'. Endpoints: none.

### EndScreen — components/exercises/EndScreen.tsx
Props 17-23. UCs: collapsible params (61-67 toggle; type badges MC/TI incl Random both; multiLang/single; language flags; PoS chips ~360-410); ResultRow list paired exercises[i]/exercisesResults[i] w/ index & setCurrentCardIndex jump-back (416-425); collapsible show-words WordSimpleList if wordsSelectedForExercises>0 (452-472); go-back-to-params -> onClickReset (498-505). No endpoints; local toggles displayParameters/displayWords.

### ResultRow — components/exercises/ResultRow.tsx
Border green/red by correct (40); check/cancel icon (62-74); type MC/TI icon tooltip (80-110); flags itemA (+itemB if multiLang) (118-146); itemA.value prompt + user answer (154-181); PoS/case chips md+ (188-217); review button -> setCurrentCardIndex(props.index) (260-270). No endpoints/effects.

### features/exercises — exerciseSlice.ts + exerciseService.ts
State {exercises, wordsSelectedForExercises, isError/isSuccess/isLoadingExercises, message} (slice:10-28). Reducers: resetExercisesSliceState, setWordsSelectedForExercises, setExercises, resetWordsSelectedForExercises, resetExerciseList (56-92). Thunk getExercisesForUser -> GET /api/exercises/getUserExercises Bearer + params {parameters} (service 9-17; slice 38-51). extraReducers loading/success/error (93-111). Consumers: Practice(119,126,158), Review(537), ExerciseCard(391). Token from auth.user.token.

### features/exercisePerformance — slice + service
State {isError/isSuccess/isLoadingSendingPerformance, message, exercisePerformance, isError/isLoading/isSuccessSavingAction} (slice:11-33). saveTranslationPerformance -> POST /api/exercises/saveTranslationPerformance (slice 35-48; svc 10-17; sets exercisePerformance fulfilled 110-122). savePerformanceAction -> POST /api/exercises/savePerformanceAction (slice 50-63; svc 20-26). Reducers resetExercisesPerformanceSliceState, resetExercisePerformance (91-101). Consumers: ExerciseCard, Practice reset(157)/ExerciseCard forward nav(1049,1052). NOTE isErrorSendingPerformance unhandled (ExerciseCard TODO:396) -> answer/fetched-exercises desync on nav.

### theme/chartsColors.ts + components/charts/* — STRUCTURE ONLY (dashboard)
chartsColors.ts: single {PoS->hex, Language->hex} palette (1-16) shared by Bar/Pie via c3. BarChart props {data,xType,title,currentType,onTypeChange}: regroup rows->c3 json by translated label+PoS buckets; groupBy/separate toggle; byMonth/byLanguage buttons (BarChart.tsx:32-44,~200-230). PieChart props {data,unit,title,options,currentType,onTypeChange}: c3 pie; worstCategory + redirect addWord/<category> (PieChart.tsx:36-58,66-72,~200-240). C3Chart thin wrapper generate/destroy c3 on props (11-27). UserMetrics reads state.metrics (wordsPerPOS/translationsPerLanguage/wordsPerMonth/translationsPerLanguageAndPOS) -> Pie+Bar w/ independent MetricsType toggles (UserMetrics.tsx:20-56). UserInfoPanel/UserInfoCard stat cards (totalWords/incompleteWordsCount/translationsPerLanguage.length); incompleteWords links to 'review' (UserInfoPanel.tsx:13-28). Input contract: state.metrics shape {totalWords,incompleteWordsCount,translationsPerLanguage[],wordsPerPOS[],wordsPerMonth[],translationsPerLanguageAndPOS[]}; out of review/practice scope. Keep chartColors + translators if charts re-implemented.

Cross-cutting reimplementation notes:
- Move selection off row indices (bug Review.tsx:228-254 + TranslationsTable 109-152) onto stable word ids/objects.
- Stable backend seams: GET /api/exercises/getUserExercises?parameters=..., POST /api/exercises/saveTranslationPerformance, POST /api/exercises/savePerformanceAction.
- Text-input difficulty normalization and PerformanceParameters/ActionParameters payloads are verbatim-portable (ExerciseCard.tsx:99-145,147-183).
- mode 'Multiple-Tries' and Random variants exist in types but only Single-Try exercised; native-lang exclusion rides on parameters.nativeLanguage undefined-vs-set.