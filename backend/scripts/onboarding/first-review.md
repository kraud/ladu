# First review of pool.tsv (Claude, 2026-10-16)

The first pass over all 1,110 lines. Result: 698 `keep`, 412 `drop`, 0 `check`. Lines not listed
here were already `keep` and were left as they were. Please confirm or change these decisions in
`pool.tsv`. Kept for reference; delete it before the onboarding feature is merged.

Kinds of change: wrong Wiktionary sense (tea → the leaves, orange → the tree, train → of a dress),
homographs and names (stole, tom, john, won, em), regional or slang words (buey, piola, mosco),
missing German/Spanish genders, missing Estonian words, non-lemma cells ("der but see Kuchen").

## clothing

Changed:

- `verb:wear` (beginner, keep): es: llevar (puesto) → llevar — clean Spanish word
- `verb:dress` (beginner, keep): es: vestir (de / con) → vestir — clean Spanish word
- `noun:hat` (beginner, keep): de: Kappe → Hut; de_gender: die → der — Kappe is a cap
- `adjective:tight` (beginner, keep): de: knapp → eng — better German word
- `noun:tie` (beginner, keep): es: lazo → corbata; es_gender: el → la; de: ∅ → Krawatte; de_gender: ∅ → die; et: ∅ → lips; sense: strong connection between people → necktie — sense was "connection"; now the necktie
- `noun:costume` (intermediate, keep): es: traje → disfraz — disfraz is the usual word
- `noun:sock` (intermediate, keep): es: soquete → calcetín — calcetín is the usual word
- `noun:clothing` (intermediate, keep): de: Gewand → Kleidung; de_gender: das → die — usual German word
- `noun:robe` (advanced, keep): de: Robe → Bademantel; de_gender: die → der; et: kleit → hommikumantel — kleit/Robe are wrong; bathrobe
- `noun:earring` (advanced, keep): es: arete → pendiente — pendiente is the Spain word
- `noun:veil` (advanced, keep): de: Vorhang → Schleier — Vorhang is a curtain
- `noun:slipper` (advanced, keep): de: Slipper → Hausschuh — usual German word
- `noun:jewellery` (advanced, keep): es: joyería → joya — joyería is the shop

Dropped:

- homograph, participle or not a clothing word: `verb:shoe`, `noun:stole`, `adjective:dressed`, `adjective:spare`, `adjective:decent`, `adjective:uniform`, `noun:wrap`, `verb:costume`, `adjective:fitting`, `noun:gown`, `noun:overall`, `adjective:overall`, `adverb:overall`, `adverb:tight`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:uniform`

## food_drink

Changed:

- `noun:drink` (beginner, keep): es: ∅ → bebida; es_gender: ∅ → la — bebida
- `noun:lunch` (beginner, keep): es: lunch → almuerzo — almuerzo is the usual word
- `noun:tea` (beginner, keep): es: hoja de té → té; es_gender: la → el; de: Teeblatt → Tee; de_gender: das → der; et: ∅ → tee; sense: dried leaves of tea plant → beverage — sense was the leaves; now the drink
- `adjective:delicious` (intermediate, keep): de: deliziös → lecker — deliziös is rare
- `noun:pie` (intermediate, keep): de: but see Kuchen → Kuchen — German cell was broken ("der but see Kuchen")
- `noun:sandwich` (intermediate, keep): de: belegtes Brot → Sandwich — German cell was not a lemma
- `noun:orange` (intermediate, keep): es: naranjo → naranja; es_gender: el → la; de: Apfelsinenbaum → Orange; de_gender: der → die; et: apelsinipuu → apelsin; sense: tree → fruit — sense was the tree; now the fruit
- `noun:pudding` (advanced, keep): es: morcilla → pudin; es_gender: la → el; de: Blutwurst → Pudding; de_gender: die → der; et: ∅ → puding; sense: sausage made primarily from blood → dessert — sense was blood sausage; now the dessert
- `noun:pancake` (advanced, keep): es: hojuela → tortita — hojuela is rare
- `adjective:alcoholic` (advanced, keep): de: ∅ → alkoholisch; et: alkoholi- → ∅ — et cell was a prefix
- `noun:pasta` (advanced, keep): de: Nudeln → Pasta — singular German word
- `noun:tomato` (advanced, keep): et: ∅ → tomat — add Estonian
- `noun:chili` (advanced, keep): es: pimiento → chile — pimiento is a pepper
- `noun:egg` (beginner, keep): topic: animals → food_drink — food, not an animal

Dropped:

- wrong meaning for the topic, homograph or duplicate: `verb:can`, `verb:wine`, `noun:treat`, `verb:suck`, `noun:chuck`, `adjective:rolling`, `noun:charlotte`, `noun:mix`, `noun:sour`, `noun:rack`, `adjective:drunken`, `noun:hay`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `verb:lunch`, `verb:breakfast`, `verb:barbecue`

## animals

Changed:

- `noun:turtle` (intermediate, keep): topic: clothing → animals — an animal, not clothing
- `noun:horse` (beginner, keep): de_gender: ∅ → das — German gender missing
- `noun:fly` (beginner, keep): es: mosco → mosca; es_gender: ∅ → la — mosco is regional
- `noun:cat` (beginner, keep): de_gender: ∅ → die — German gender missing
- `noun:rat` (intermediate, keep): de_gender: ∅ → die — German gender missing
- `noun:wing` (intermediate, keep): es: [el] ala → ala; es_gender: la → el — ala takes el
- `noun:fox` (intermediate, keep): de_gender: ∅ → der — German gender missing
- `noun:sheep` (intermediate, keep): es: carnero → oveja; es_gender: el → la — carnero is a ram
- `noun:ape` (advanced, keep): es: ∅ → simio; es_gender: ∅ → el — add Spanish

Dropped:

- homograph, name or not an animal word: `noun:down`, `noun:tom`, `noun:martin`, `noun:female`, `noun:male`, `noun:giant`, `noun:molly`, `noun:swine`, `noun:stray`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:doe`, `noun:duck`

## plants_nature

Changed:

- `noun:flower` (beginner, keep): de: Blüte → Blume — Blüte is the blossom
- `noun:rose` (beginner, keep): es: rosal → rosa; es_gender: el → la; et: roosipõõsas → roos; sense: shrub → flower — sense was the shrub; now the flower
- `noun:hill` (beginner, keep): et: mägi → küngas — mägi is a mountain
- `noun:ocean` (beginner, keep): de: Weltmeer → Ozean; de_gender: das → der — usual German word
- `noun:valley` (intermediate, keep): de: Senke → Tal; de_gender: die → das — Senke is a hollow
- `noun:peach` (advanced, keep): es: duraznero → melocotón; de: Pfirsichbaum → Pfirsich; et: ∅ → virsik; sense: tree → fruit — sense was the tree; now the fruit
- `noun:land` (beginner, keep): topic: work_money → plants_nature — nature, not money

Dropped:

- wrong meaning, offensive or not a starter word: `noun:main`, `noun:falls`, `noun:rape`, `noun:cheat`, `noun:pit`, `noun:cole`, `noun:blade`, `noun:corn`, `noun:bark`, `noun:delta`, `noun:ling`, `noun:popcorn`, `noun:marijuana`, `noun:pod`, `noun:shallow`, `noun:rapid`

## weather

Changed:

- `adjective:cool` (beginner, keep): et: ∅ → jahe — add Estonian
- `noun:weather` (beginner, keep): es: tiempo atmosférico → tiempo — tiempo is the usual word
- `noun:gale` (advanced, keep): es: ventolera → vendaval; es_gender: la → el — vendaval is the usual word

Dropped:

- not a weather word or homograph: `noun:quiet`, `adjective:dirty`, `adjective:burning`, `adjective:chill`, `noun:bolt`, `adjective:boiling`, `noun:puff`, `adjective:crisp`, `noun:thermal`, `adjective:thermal`, `adjective:chilling`, `verb:spat`, `noun:whiff`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `verb:rain`, `verb:snow`

## body_health

Changed:

- `noun:virus` (intermediate, keep): topic: animals → body_health; de_gender: ∅ → das — health, not an animal; German gender missing
- `noun:doctor` (beginner, keep): es: doctor → médico; de: Doktor → Arzt; et: ∅ → arst; sense: person who has attained a doctorate → medical doctor — sense was "doctorate holder"; now the medical doctor
- `noun:hair` (beginner, keep): et: karv → juuksed — karv is body hair
- `verb:cure` (intermediate, keep): de: kurieren → heilen — usual German word
- `noun:shoulder` (intermediate, keep): es: paleta → hombro; es_gender: la → el; de: ∅ → Schulter; de_gender: ∅ → die; et: ∅ → õlg — paleta is the shoulder blade/cut of meat
- `noun:joint` (intermediate, keep): es: coyuntura → articulación; et: šarniir → liiges; sense: joint with freedom to rotate → joint of the body — sense was a hinge; now the body joint
- `noun:corpse` (intermediate, keep): es: cuerpo → cadáver — cuerpo is the body
- `noun:haircut` (advanced, keep): es: corte (piloso / capilar) → corte de pelo — Spanish cell was not a lemma
- `noun:elbow` (advanced, keep): et: küünarliiges → küünarnukk — küünarliiges is the anatomical term

Dropped:

- wrong meaning, homograph or not a starter word: `noun:behind`, `verb:drug`, `noun:crown`, `noun:vagina`, `noun:pinky`, `noun:transplant`, `noun:lid`, `noun:morphine`, `noun:intern`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:back`, `noun:bleeding`, `noun:scratch`, `noun:bruise`

## technology_media

Changed:

- `noun:call` (beginner, keep): es: grito → llamada; es_gender: ∅ → la; de: Ruf → Anruf; et: ∅ → kõne; sense: cry or shout → telephone call — sense was a shout; now the phone call
- `noun:computer` (beginner, keep): es: computador → ordenador — ordenador is the Spain word
- `noun:vocabulary` (advanced, keep): de: Wortliste → Wortschatz; de_gender: die → der — Wortliste is a word list

Dropped:

- wrong sense (speech sound); telephone is in the pool: `noun:phone`
- wrong meaning, duplicate or not a starter word: `noun:daily`, `noun:bible`, `noun:read`, `noun:medium`, `noun:weekly`, `noun:stereo`, `noun:monthly`, `noun:telly`, `noun:receiver`, `noun:garland`, `noun:yearbook`

## home_living

Changed:

- `noun:room` (beginner, keep): es: espacio → habitación; es_gender: el → la; de: Raum → Zimmer; de_gender: der → das; et: ∅ → tuba; sense: space → room in a building — sense was "space"; now the room of a house
- `noun:apartment` (beginner, keep): es: vivienda → apartamento; es_gender: la → el — vivienda is a dwelling
- `noun:chair` (beginner, keep): de: Sessel → Stuhl — Sessel is an armchair
- `noun:bedroom` (beginner, keep): es: alcoba → dormitorio — alcoba had the wrong gender; dormitorio is usual
- `noun:cabin` (intermediate, keep): es: barraca → cabaña — barraca is a shack
- `noun:furniture` (intermediate, keep): es: muebles → mueble — Spanish article and number did not match
- `noun:lobby` (intermediate, keep): de_gender: das → die — German gender
- `noun:fork` (advanced, keep): es: horca → tenedor; es_gender: la → el; et: hang → kahvel — horca is a pitchfork; hang is a hayfork
- `noun:stove` (advanced, keep): de: Ofen → Herd; et: ahi → pliit — Ofen is an oven/heater; the cooker
- `noun:wardrobe` (advanced, keep): de: Garderobe → Kleiderschrank; de_gender: ∅ → der — German gender missing; Kleiderschrank is usual
- `noun:classroom` (advanced, keep): es_gender: la → el — aula takes el
- `noun:refrigerator` (advanced, keep): es: frigider → frigorífico — frigider is not standard Spanish
- `noun:kettle` (advanced, keep): es: caldera → hervidor; es_gender: la → el; de: Kessel → Wasserkocher; et: katel → veekeetja — caldera/Kessel/katel are a boiler
- `noun:yard` (intermediate, keep): topic: numbers_measures → home_living — sense is the land around a house

Dropped:

- offensive, wrong meaning or not a starter word: `noun:john`, `noun:bar`, `noun:cab`, `noun:booth`, `noun:locker`, `noun:upper`, `noun:throne`, `noun:counter`, `noun:cooler`, `noun:housing`, `noun:altar`, `noun:lounge`, `noun:hogan`, `noun:courtroom`, `noun:salon`, `noun:nursery`, `noun:dorm`, `noun:convent`
- homograph, duplicate, wrong meaning or not a starter word: `noun:dish`

## travel_transport

Changed:

- `noun:camp` (beginner, keep): topic: home_living → travel_transport — travel, not home
- `noun:car` (beginner, keep): es: automóvil → coche — coche is the usual word
- `noun:train` (beginner, keep): es: cola → tren; es_gender: la → el; de: Schleppe → Zug; de_gender: die → der; et: ∅ → rong; sense: the elongated back portion of a dress or skirt which drags along the ground → railway train — sense was the train of a dress; now the railway train
- `noun:ambulance` (intermediate, keep): de: Ambulanz → Krankenwagen; de_gender: die → der — Krankenwagen is the usual word
- `noun:rocket` (intermediate, keep): es: motor de cohete → cohete — Spanish cell was the engine
- `noun:highway` (intermediate, keep): de: Hauptstraße → Autobahn — Hauptstraße is a main street

Dropped:

- homograph, wrong meaning or not a starter word: `adjective:up`, `noun:ride`, `adjective:forward`, `noun:tank`, `noun:launch`, `noun:electric`, `noun:traveling`, `noun:jet`, `verb:tool`, `verb:boat`, `noun:jeep`, `noun:dolly`, `verb:yacht`, `noun:bomber`, `noun:ark`, `noun:driveway`, `noun:barge`, `noun:errand`, `noun:pike`, `noun:drifting`, `adjective:sinister`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `adverb:right`, `adjective:left`, `adverb:left`, `adverb:forward`, `verb:fly`, `verb:row`, `noun:transport`, `verb:sail`, `noun:submarine`, `noun:ferry`

## sports_hobbies

Changed:

- `noun:music` (beginner, keep): de_gender: ∅ → die — German gender missing

Dropped:

- homograph, duplicate or not a starter word: `noun:forward`, `verb:game`, `noun:swim`, `noun:section`, `noun:carol`, `verb:golf`, `noun:pro`, `noun:chapter`, `noun:chanting`, `noun:suite`, `verb:rival`, `verb:confront`, `noun:gong`, `noun:tackle`, `noun:finale`, `noun:polo`, `noun:pitcher`, `noun:quarterback`, `verb:wager`, `noun:batter`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:singing`, `noun:fishing`, `noun:swimming`, `noun:surfing`, `noun:skating`

## work_money

Changed:

- `noun:bank` (beginner, keep): topic: plants_nature → work_money; es: banca → banco; es_gender: la → el — sense is the institution
- `noun:job` (beginner, keep): es: tarea → trabajo; es_gender: la → el; de: Aufgabe → Arbeit; et: ∅ → töö; sense: task → employment — sense was "task"; now the job
- `noun:teacher` (beginner, keep): es: enseñador → maestro — enseñador is rare
- `noun:prize` (intermediate, keep): es: botín → premio; de: ∅ → Preis; de_gender: ∅ → der; et: ∅ → auhind; sense: something captured → award — sense was "something captured"; now the award

Dropped:

- homograph, duplicate or not a starter word: `noun:check`, `noun:cut`, `noun:calling`, `noun:take`, `adjective:general`, `adjective:gold`, `noun:grant`, `noun:studio`, `adjective:expert`, `noun:expenditure`, `noun:estate`, `noun:stock`, `adjective:salt`, `verb:waste`, `noun:option`, `noun:kitty`, `noun:valuable`, `noun:principal`, `noun:stake`, `verb:labour`, `noun:tanner`, `verb:bribe`, `noun:pledge`, `verb:vet`, `verb:purchase`, `adjective:elite`, `noun:craft`, `verb:finance`, `adjective:mechanical`, `verb:moonlight`, `noun:bounty`, `noun:lease`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:fine`, `noun:trust`

## numbers_measures

Changed:

- `noun:one` (beginner, keep): et: ∅ → üks — digit; add Estonian
- `noun:three` (beginner, keep): et: ∅ → kolm — digit; add Estonian
- `noun:five` (beginner, keep): es: ∅ → cinco; es_gender: ∅ → el; de: fünf → Fünf; et: ∅ → viis — digit; add Spanish and Estonian
- `noun:four` (beginner, keep): es_gender: ∅ → el; et: ∅ → neli — digit; gender and Estonian
- `noun:six` (beginner, keep): es_gender: ∅ → el; et: ∅ → kuus — digit; gender and Estonian
- `noun:seven` (beginner, keep): es_gender: ∅ → el; et: ∅ → seitse — digit; gender and Estonian
- `noun:eight` (beginner, keep): es: ∅ → ocho; es_gender: ∅ → el; et: ∅ → kaheksa — digit; add Spanish and Estonian
- `noun:nine` (beginner, keep): es_gender: el/la → el; et: ∅ → üheksa — digit; gender and Estonian
- `noun:inch` (intermediate, keep): de_gender: das → der — German gender
- `noun:kilo` (advanced, keep): es_gender: ∅ → el — Spanish gender missing

Dropped:

- letter name, homograph, rare unit or currency, not a starter word: `noun:won`, `noun:em`, `noun:henry`, `noun:penny`, `noun:gee`, `noun:fifth`, `noun:meter`, `noun:en`, `noun:ace`, `noun:franc`, `noun:dong`, `noun:mole`, `noun:rupee`, `noun:newton`, `noun:acre`, `noun:yuan`, `noun:fin`, `noun:ar`, `noun:peso`, `noun:lea`, `noun:rand`, `noun:trinity`, `noun:shilling`, `noun:threesome`, `noun:tesla`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:two`

## time_calendar

Changed:

- `noun:today` (beginner, keep): es_gender: el → ∅; de_gender: ∅ → das — Spanish/German cells were not lemmas
- `adjective:next` (beginner, keep): de: nächster → nächst — German lemma
- `noun:tomorrow` (beginner, keep): es_gender: la → ∅ — "la mañana" is the morning
- `noun:tonight` (beginner, keep): de_gender: der → ∅; et: tänane õhtu → täna õhtul — German/Estonian cells were not lemmas
- `noun:dawn` (intermediate, keep): es_gender: la → el — alba takes el
- `noun:vacation` (intermediate, keep): es: ∅ → vacaciones; et: ∅ → puhkus — add Spanish and Estonian
- `noun:childhood` (intermediate, keep): es: ∅ → infancia; es_gender: ∅ → la; et: ∅ → lapsepõlv — add Spanish and Estonian
- `adverb:instantly` (advanced, keep): de: unmittelbar → sofort — usual German word

Dropped:

- homograph, duplicate or not a starter word: `noun:wait`, `noun:last`, `adverb:next`, `adjective:later`, `noun:grave`, `noun:close`, `adverb:Monday`, `noun:rate`, `adjective:latest`, `adverb:Thursday`, `adverb:Tuesday`, `noun:flush`, `adverb:awhile`, `noun:probation`, `noun:reign`, `noun:overtime`, `noun:extension`, `adjective:weekly`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `adverb:now`, `adverb:soon`, `adverb:late`, `noun:sunrise`, `noun:pause`, `noun:bedtime`, `adverb:weekly`

## feelings

Changed:

- `verb:like` (beginner, keep): es: gustarle → gustar — Spanish lemma
- `verb:worry` (beginner, keep): de: besorgt sein → sich sorgen — reflexive German verb
- `adjective:afraid` (beginner, keep): es: con miedo → temeroso — Spanish cell was not a lemma
- `adjective:pleased` (intermediate, keep): es: ∅ → contento — add Spanish
- `noun:pity` (intermediate, keep): es: piedad → lástima; es_gender: ∅ → la — Spanish gender
- `noun:pride` (intermediate, keep): de: Hochmut → Stolz; et: ülbus → uhkus — Hochmut/ülbus are arrogance
- `verb:despair` (advanced, keep): es: ∅ → desesperar — add Spanish
- `noun:jealousy` (advanced, keep): es: celo → celos; es_gender: el → ∅ — celo is zeal/heat
- `noun:satisfaction` (advanced, keep): es_gender: ∅ → la — Spanish gender missing

Dropped:

- no clean translation, duplicate, homograph or not a feeling: `adjective:down`, `adverb:down`, `adjective:sorry`, `verb:care`, `adjective:loved`, `verb:pity`, `noun:shock`, `adjective:suffering`, `verb:seek`, `adjective:beloved`, `verb:panic`, `adjective:horny`, `noun:distress`, `noun:liking`, `adjective:feared`, `adjective:frightening`, `verb:pine`, `noun:thrill`, `adjective:hairy`, `adjective:wretched`, `verb:grudge`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `noun:hope`, `verb:wish`, `verb:hate`, `verb:love`, `noun:desire`, `adjective:loving`, `adjective:bored`, `noun:panic`

## people_family

Changed:

- `noun:human` (beginner, keep): topic: animals → people_family — a person word
- `noun:queen` (beginner, keep): topic: animals → people_family — sense is the monarch
- `noun:mum` (beginner, keep): topic: plants_nature → people_family — mother, not nature
- `noun:guy` (beginner, keep): es: buey → tipo; es_gender: ∅ → el — buey is Mexican slang
- `adjective:nice` (beginner, keep): es: piola → agradable; de: freundlich → nett — piola is Argentine slang
- `noun:boy` (beginner, keep): de: Bub → Junge — Bub is Austrian/South German
- `adjective:happy` (beginner, keep): de: zufrieden → glücklich — zufrieden is content
- `adjective:clever` (intermediate, keep): es: hábil → listo; de: geschickt → klug; et: ∅ → tark — hábil/geschickt are skilful
- `noun:bartender` (advanced, keep): es: bartender → camarero; es_gender: el/la → el — usual Spanish word

Dropped:

- homograph, wrong meaning or not a starter word: `adjective:mean`, `noun:god`, `adjective:real`, `noun:miss`, `noun:regular`, `adjective:sexy`, `noun:Italian`, `adjective:pure`, `noun:jerk`, `noun:freak`, `noun:carter`, `noun:governor`, `noun:dean`, `adjective:dramatic`, `noun:dragon`, `noun:junior`, `noun:witch`, `noun:announcer`, `adjective:hostile`, `noun:amateur`, `adjective:honorable`, `noun:representative`, `noun:magician`, `adjective:toxic`, `noun:scoundrel`, `adjective:sensible`, `noun:specialist`, `noun:maniac`, `noun:belle`, `noun:diner`, `noun:gangster`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `adjective:kind`, `noun:player`, `noun:winner`

## core

Changed:

- `verb:be` (beginner, keep): de: werden → sein; et: ∅ → olema — werden is the passive auxiliary
- `verb:have` (beginner, keep): et: ∅ → omama — add Estonian
- `verb:do` (beginner, keep): es: ∅ → hacer; et: ∅ → tegema — add Spanish and Estonian
- `verb:get` (beginner, keep): de: besorgen → bekommen; et: ∅ → saama — besorgen is "procure"
- `adverb:out` (beginner, keep): et: ∅ → välja — add Estonian
- `adverb:how` (beginner, keep): es: “cómo de”/“qué tan”/cuán → cómo — Spanish cell was not a lemma
- `verb:think` (beginner, keep): de: nachdenken → denken; et: ∅ → mõtlema — nachdenken is "ponder"
- `verb:say` (beginner, keep): et: ∅ → ütlema — add Estonian
- `verb:need` (beginner, keep): es: necesitar/precisar (de) → necesitar — Spanish cell was not a lemma
- `adjective:sure` (beginner, keep): et: ∅ → kindel — add Estonian
- `adjective:first` (beginner, keep): de: erster → erst — German lemma
- `adjective:other` (beginner, keep): de: andere → ander — German lemma
- `noun:talk` (beginner, keep): es: ∅ → conversación; es_gender: ∅ → la; et: ∅ → vestlus — add Spanish and Estonian
- `adjective:proper` (intermediate, keep): es: proprio → adecuado — proprio is Italian
- `verb:hire` (intermediate, keep): es: ∅ → contratar; de: mieten → einstellen; et: ∅ → palkama — add Spanish, usual German word, Estonian
- `verb:celebrate` (intermediate, keep): es: honrar → celebrar — honrar is "honour"
- `verb:rise` (intermediate, keep): es: levantarse → subir — Spanish cell was not a lemma
- `verb:depend` (intermediate, keep): es: depender/pender (de) → depender — Spanish cell was not a lemma
- `adjective:positive` (intermediate, keep): es: ∅ → positivo — add Spanish
- `noun:direction` (intermediate, keep): de: Kurs → Richtung; de_gender: der → die — Kurs is a course
- `noun:courage` (intermediate, keep): de: Courage → Mut; de_gender: die → der — Mut is the usual word
- `noun:appointment` (intermediate, keep): es: nombramiento → cita; es_gender: el → la; de: Ernennung → Termin; de_gender: die → der; et: ∅ → kohtumine; sense: act of appointing; designation of a person to hold an office → arranged meeting — sense was a designation; now a meeting
- `noun:threat` (intermediate, keep): es: ∅ → amenaza; es_gender: ∅ → la — add Spanish
- `noun:nation` (intermediate, keep): de: Volk → Nation; de_gender: das → die — Volk is "people"
- `adjective:healthy` (intermediate, keep): et: ∅ → terve — add Estonian
- `noun:shopping` (intermediate, keep): es: shopping → compra; es_gender: el → la — Spanish anglicism
- `noun:neighborhood` (intermediate, keep): es: vecindad → barrio; es_gender: la → el — barrio is the usual word
- `noun:straw` (advanced, keep): de: Halm → Stroh; de_gender: der → das — Halm is a stalk
- `noun:dam` (advanced, keep): de_gender: der → die — German gender
- `adverb:mainly` (advanced, keep): es: máxime → principalmente — máxime is "especially"

Dropped:

- function word, homograph, broken translation or modal: `adverb:the`, `adjective:in`, `adverb:this`, `noun:no`, `adverb:no`, `noun:can`, `adverb:all`, `adverb:so`, `adverb:about`, `noun:well`, `noun:will`, `verb:will`, `noun:want`, `noun:why`, `adverb:why`, `noun:yes`, `noun:going`, `noun:okay`, `verb:back`, `adverb:some`, `noun:say`, `adjective:very`, `verb:people`, `verb:please`, `noun:mean`, `verb:mean`, `adjective:said`, `adjective:off`, `adverb:any`, `verb:even`, `adjective:even`, `noun:first`, `noun:still`, `verb:still`, `noun:must`, `adjective:away`
- homograph, duplicate, wrong meaning or not a starter word: `noun:repeat`, `noun:find`, `noun:suck`, `adjective:younger`, `noun:china`, `noun:site`, `verb:map`, `verb:power`, `adjective:fixed`, `verb:pound`, `noun:jury`, `verb:wall`, `verb:grant`, `noun:saving`, `adjective:saving`, `verb:deliver`, `verb:switch`, `verb:grave`, `adjective:grave`, `adjective:odd`, `adjective:badly`, `noun:affair`, `verb:shock`, `adjective:raised`, `verb:pant`, `noun:panting`, `adjective:golden`, `adjective:committed`, `adjective:sexual`, `adverb:wherever`, `noun:mercy`, `noun:butt`, `noun:drove`, `noun:yellow`, `noun:hunt`, `verb:rat`, `noun:term`, `adjective:Italian`, `noun:council`, `verb:crack`, `verb:disgust`, `noun:march`, `adjective:owed`, `adverb:importantly`, `noun:labour`, `verb:salute`, `noun:fold`, `adjective:inaudible`, `noun:fluid`, `adjective:fluid`, `noun:shuttle`, `noun:moan`, `noun:initial`, `noun:perimeter`, `adjective:divided`, `adjective:classified`, `adjective:amateur`, `noun:chopper`, `noun:rash`, `verb:hawk`, `verb:distress`, `verb:pimp`, `noun:dip`, `verb:dip`, `noun:hallelujah`, `verb:flush`, `noun:dynamite`, `verb:dynamite`, `noun:rally`, `verb:rally`, `noun:bloom`, `noun:corporation`, `noun:disorder`, `verb:disorder`, `noun:bother`, `noun:interrogation`, `verb:refer`, `noun:grid`, `adjective:regardless`, `adverb:regardless`, `noun:lodge`, `verb:lodge`, `noun:poisoning`, `verb:feather`, `noun:marina`, `verb:queen`, `adjective:straw`, `verb:glue`, `verb:floor`, `noun:pad`, `noun:cue`, `adjective:opposed`, `verb:behold`, `adjective:blamed`, `noun:loop`, `noun:blond`, `verb:plead`, `noun:wax`, `verb:wax`, `noun:pursuit`, `verb:herd`

`check` → `keep` with no change (the flag was a false alarm, mostly `pos_order`): `adverb:just`, `noun:right`, `adverb:more`, `adverb:only`, `verb:thank`, `adverb:even`, `adverb:much`, `verb:help`, `adverb:still`, `verb:work`, `noun:stop`, `noun:request`, `verb:chase`, `adverb:badly`, `adjective:confused`, `verb:poison`, `adjective:yellow`, `verb:wound`, `noun:crack`, `adverb:below`, `adverb:strongly`, `verb:measure`, `verb:update`, `noun:despair`, `adjective:conscious`, `adverb:deliberately`, `noun:sketch`, `noun:topic`

## Spanish: neutral where possible (user decision, 2026-10-16)

Rule: a word used in Spain and Latin America when one exists; otherwise the Spain word
(kept as Spain: ordenador, pendiente, zumo, tortita, melocotón, chaqueta, manta).

- `noun:laundry`: es: colada → ropa sucia — neutral (colada = Spain)
- `noun:jersey`: es: jersey → suéter — neutral word (jersey = Spain)
- `noun:cottage`: es: chalet → casa de campo; es_gender: el → la — neutral (chalet = Spain)
- `noun:stove`: status: keep → drop — no neutral Spanish word (estufa = heater in Spain, cooker in Mexico)
- `noun:refrigerator`: es: frigorífico → refrigerador — neutral word (frigorífico = Spain, heladera/nevera = regional)
- `noun:car`: es: coche → automóvil — neutral word (coche = Spain, carro/auto = Latin America)
- `noun:wagon`: es: carro → carreta; es_gender: el → la — carro is "car" in Latin America
- `noun:cart`: status: keep → drop — duplicate of wagon; carro is "car" in Latin America
- `noun:ferry`: es: ferri → ferry — usual spelling everywhere
- `noun:scooter`: status: keep → drop — patineta is a skateboard; no neutral Spanish word
