# Onboarding word selection — current available options (temporary)

> Temporary working document for discussion. Not a spec. Generated 2026-10-19.

## How the feature works

Evidence: `backend/scripts/onboarding/pool.tsv`, `backend/services/onboarding/select.ts`,
`backend/scripts/lexicon/onboarding-topics.ts`, `frontend/src/features/onboarding/types.ts`.

- **15 pickable topics**, minimum 3 / maximum 6 (`MIN_TOPICS`, `MAX_TOPICS`).
- **Core vocabulary is not pickable**: it is always eligible and targeted at **20%** of each
  language's picks (`CORE_SHARE`, `select.ts:11`).
- The runtime pool is **`backend/scripts/onboarding/pool.tsv`**, not the generated candidate file.
  Only lines with status `keep` are used (`select.ts:143`).
- Pool size: **1,110 lines → 698 `keep`**, and every `keep` line has precomputed forms.
  260 beginner, 236 intermediate, 202 advanced.
- Bands come from the **English** frequency rank: beginner ≤ 2000, intermediate ≤ 6000,
  advanced ≤ 15000.
- Per learning language, the picker takes the chosen band first, then the next band up, then the
  band below (`select.ts:85-90`); topics are interleaved round-robin, then concepts are
  rank-ordered. A concept needs **at least 2 of the account's languages** with forms
  (`select.ts:147`).
- Consequence: the number of real options depends on the language pair. Among `keep` concepts:
  EN+ES 692, EN+DE 682, EN+ET 552, ES+DE 676, ES+ET 551, DE+ET 542.
- A repeated lemma in a list below is a **separate concept by part of speech** (e.g. `rain` noun
  and `rain` verb), not a duplicate row.

## Available concepts per topic and band

| Topic | Beginner | Intermediate | Advanced | Total |
|---|---:|---:|---:|---:|
| Clothing | 9 | 16 | 13 | 38 |
| Food & drink | 18 | 15 | 16 | 49 |
| Animals | 10 | 19 | 18 | 47 |
| Plants & nature | 14 | 13 | 12 | 39 |
| Weather | 10 | 4 | 8 | 22 |
| Body & health | 18 | 20 | 14 | 52 |
| Technology & media | 5 | 8 | 8 | 21 |
| Home & living | 12 | 14 | 9 | 35 |
| Travel & transport | 18 | 12 | 8 | 38 |
| Sports & hobbies | 6 | 12 | 10 | 28 |
| Work & money | 14 | 7 | 7 | 28 |
| Numbers & measures | 12 | 5 | 8 | 25 |
| Time & calendar | 16 | 13 | 13 | 42 |
| Feelings | 15 | 14 | 10 | 39 |
| People & family | 19 | 6 | 7 | 32 |
| **Core (always added)** | **64** | **58** | **41** | **163** |

## English word lists

### Clothing
- Beginner: coat, dress, hat, shirt, shoe, suit, tie, tight, wear
- Intermediate: boot, cap, clothing, costume, diamond, jacket, jersey, laundry, mask, necklace, pearl, pin, ruby, sock, underwear, uniform
- Advanced: apron, bikini, blouse, diaper, earring, jewellery, robe, scarf, slipper, stocking, veil, vest, wig

### Food & drink
- Beginner: beer, breakfast (n), breakfast (v), chicken, coffee, dinner, drink (n), drink (v), drunk, eat, egg, honey, lunch (n), lunch (v), milk, sweet, tea, wine
- Intermediate: alcohol, apple, candy, champagne, chocolate, delicious, juice, meal, orange, pie, pizza, rice, sandwich, soup, toast
- Advanced: alcoholic, bake, barbecue (n), barbecue (v), chili, curry, jelly, lobster, noodle, pancake, pasta, pudding, rum, sour, spaghetti, tomato

### Animals
- Beginner: bee, bird, cat, doe, dog, fish, fly, horse, mare, pig
- Intermediate: bat, bull, chick, cow, duck, fox, jay, lion, monkey, rabbit, rat, robin, sheep, snake, tail, turkey, turtle, wing, wolf
- Advanced: ant, ape, camel, crab, cricket, crow, dinosaur, feather, finch, hawk, insect, mule, owl, pigeon, raven, salmon, squirrel, swan

### Plants & nature
- Beginner: beach, flower, hill, lake, land, leaf, mountain, ocean, planet, river, rose, sea, star, tree
- Intermediate: bay, bud, bush, cave, cliff, coast, fruit, grass, holly, lily, shore, trunk, valley
- Advanced: canal, canyon, garlic, iris, oak, olive, peach, pine, pumpkin, ridge, tuna, wheat

### Weather
- Beginner: cold, cool, hot, rain (n), rain (v), snow, storm, warm, weather, wind
- Intermediate: breeze, freezing, frozen, lightning
- Advanced: chilly, dew, gale, hurricane, icy, snow (v), tornado, tropical

### Body & health
- Beginner: arm, back, blood, body, brain, doctor, eye, face, foot, hair, hand, head, leg, mouth, neck, nose, sleep, throat
- Intermediate: belly, bleeding, bone, corpse, cure (n), cure (v), disease, flesh, gene, joint, knee, lip, nail, nerve, scratch, shoulder, skull, therapy, virus, wound
- Advanced: bruise, dose, elbow, fracture, haircut, jaw, moustache, physician, shin, spine, tumor, vein, waist, womb

### Technology & media
- Beginner: book, call, computer, radio, telephone
- Intermediate: album, cinema, laptop, magazine, manual, newspaper, television, website
- Advanced: dictionary, edition, folder, journalism, publication, software, vocabulary, voicemail

### Home & living
- Beginner: apartment, bathroom, bed, bedroom, castle, chair, cup, desk, house, kitchen, room, toilet
- Intermediate: bench, blanket, cabin, cabinet, couch, furniture, library, lobby, oven, palace, pan, pot, villa, yard
- Advanced: classroom, cottage, fork, freezer, kettle, refrigerator, sofa, wardrobe, wheelchair

### Travel & transport
- Beginner: boat, camp, car, city, drive, fly, forward, left (adj), left (adv), right (adj), right (adv), road, ship, street, train, trip, up, visit
- Intermediate: alley, ambulance, crossing, helicopter, highway, rocket, row, sail, taxi, transport, vehicle, wagon
- Advanced: ferry, hike, spaceship, stroll, submarine, tractor, voyage, yacht

### Sports & hobbies
- Beginner: football, game, music, play, singing, song
- Intermediate: baseball, basketball, bingo, fishing, guitar, hunting, opera, racing, sport, swimming, tennis, tune
- Advanced: athlete, disco, flute, karaoke, melody, skating, surfing, symphony, trumpet, violin

### Work & money
- Beginner: bank, bet, buy, fine, job, money, pay, professor, rich, sell, share, spend, teacher, trust
- Intermediate: attorney, capital, loan, prize, tax, teaching, treasure
- Advanced: bribe, cheque, invest, laboratory, mortgage, pension, scholarship

### Numbers & measures
- Beginner: dollar, eight, five, four, mile, nine, one, seven, six, three, two, unit
- Intermediate: cent, euro, inch, pound, ton
- Advanced: calorie, gallon, gram, kilo, kilometre, metre, ounce, pint

### Time & calendar
- Beginner: always, day, later, morning, never, next, night, now, once, soon, then, today, tomorrow, tonight, when, year
- Intermediate: Monday, Thursday, Tuesday, childhood, dawn, eve, holiday, late, midnight, modern, period, previously, vacation
- Advanced: bedtime, calendar, deadline, frequency, historical, instantly, occasionally, pause, permanently, semester, sunrise, twilight, weekly

### Feelings
- Beginner: afraid, calm, crazy, dear, feel, hate, hope, like, love (n), love (v), scared, want, wish (n), wish (v), worry
- Intermediate: anger, ashamed, bored, desire (n), desire (v), disappointed, emotional, loving, panic, passion, pity, pleased, pride, scary
- Advanced: adore, compassion, delight, despair, disappointment, fury, jealousy, modest, sadness, satisfaction

### People & family
- Beginner: baby, boy, dad, family, father, friend, girl, guy, happy, human, kind, man, mother, mum, nice, queen, sir, son, woman
- Intermediate: bride, clever, curious, grandmother, player, winner
- Advanced: bartender, musician, salesman, sincere, slim, son-in-law, tourist

### Core (always added, targeted at 20%)
- Beginner: again, away, be, call, come, do, even, find, first, get, give, go, good, have, help (n), help (v), here, home, how, just, know, let, life, little, look, make, maybe, more, much, need (n), need (v), not, only (adj), only (adv), other, out, people, really, right, say, see, still (adj), still (adv), stop (n), stop (v), sure, take, talk (n), talk (v), tell, thank, there, thing, think, thought, time, too, very, wait, way, where, win, work (n), work (v)
- Intermediate: answer, appear, appointment, assume, badly, bath, below, carefully, celebrate, chase (n), chase (v), confused, courage, crack, depend, direction, disgusting, eventually, healthy, hire, horn, hunt, image, knowledge, location, map, mystery, nation, neighborhood, official, particular, physical, plate, poison (n), poison (v), political, positive, proper, regular, repeat, request, rise, role, scare, shopping, source, statement, suffer, switch, tall, temple, threat, traffic, trap, useless, victory, wound, yellow
- Advanced: agenda, backyard, balcony, biological, bizarre, blond, cease, confidential, conquer, conscious, cultural, dam, deliberately, despair, evolution, fold, glue, graduation, herd, industrial, initial, invention, landscape, mainly, measure, parliament, prescription, psychological, sadly, shiny, sketch, straw, strongly, suitable, topic, translation, trophy, unpleasant, update (n), update (v), weigh

## Quality flags visible in the data

- The pool treats noun/verb pairs as separate concepts (e.g. `breakfast`, `barbecue`, `stop`).
- `travel_transport` beginner band classifies spatial adverbs/adjectives (`up`, `forward`,
  `left`, `right`) as travel words.
- These are pool-review decisions, not runtime bugs.
