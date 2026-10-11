/* Landing page behaviour: language, theme, and the links into the app.
   Plain script, no build step. Mirrors the app (frontend/src/lib/theme.ts,
   lib/handoff.ts, i18n.ts) — keep the rules in sync:
     - theme: saved choice first, OS preference second; the switch offers only
       light and dark (Phase 3.9, D1).
     - language: saved choice, then the browser language, then English.
     - links into the app carry ?lng=<code>, and &theme=<choice> ONLY when the
       visitor pressed the switch here. Sending the OS default as a "choice"
       would let a returning user on a new device overwrite the theme saved on
       their account (D7). The app reads both values once and cleans the URL.
     - storage notice: shown only in regions with cookie rules (region.js), until
       the visitor dismisses it. Needs region.js loaded before this file. */
(function () {
    'use strict';

    var APP_ORIGIN = 'https://app.ladu.com.ar';
    var LANG_KEY = 'i18nextLng';
    var THEME_KEY = 'ladu.theme';

    var LANGS = [
        { code: 'en', key: 'EN', native: 'English', flag: '/flags/GB.svg' },
        { code: 'es', key: 'ES', native: 'Español', flag: '/flags/ES.svg' },
        { code: 'de', key: 'DE', native: 'Deutsch', flag: '/flags/DE.svg' },
        { code: 'ee', key: 'EE', native: 'Eesti', flag: '/flags/EE.svg' },
    ];

    /* Estonian is `ee` for the app (carried over from v1) but `et` in HTML. */
    var HTML_LANG = { en: 'en', es: 'es', de: 'de', ee: 'et' };

    var STRINGS = {
        en: {
            title: 'Ladu — keep all your languages alive',
            description:
                'Ladu is a vocabulary manager for people who speak more than one language. Save each word once, with its translations in every language you know.',
            ogDescription: 'A vocabulary manager for people who speak more than one language.',
            home: 'Ladu home',
            login: 'Log in',
            heading: 'Keep all your languages alive.',
            lead:
                'Ladu is a vocabulary manager for people who speak more than one language. Save each word once, with its translations in every language you know. Then practise them together.',
            leadA: 'Ladu is a vocabulary manager for people who speak more than one language.',
            leadB: 'Save each word once, with its translations in every language you know.',
            leadC: 'Then practise them together.',
            exerciseCard: 'Example exercise',
            leadD: 'Group words into tags. Keep them private or share them.',
            tagCard: 'Example tags',
            tagPrivate: 'Private',
            tagPublic: 'Public',
            tagYours: 'Yours',
            tagFollowing: 'Following',
            tagWords: 'words',
            tagFollowers: 'followers',
            open: 'Open',
            card: 'Example word: dance, in four languages',
            privacy: 'Privacy',
            terms: 'Terms',
            credits: 'Credits',
            impressum: 'Legal notice',
            blog: 'Blog',
            blogBack: 'Back to the blog',
            footerNav: 'Links',
            languageLabel: 'Interface language',
            toDark: 'Switch to dark theme',
            toLight: 'Switch to light theme',
            noticeLabel: 'Storage notice',
            noticeText:
                'Ladu keeps only essential data on your device: your sign-in, and your theme and language choices. No tracking and no ads.',
            noticeOk: 'Got it',
        },
        es: {
            title: 'Ladu — mantén vivos todos tus idiomas',
            description:
                'Ladu es un gestor de vocabulario para personas que hablan más de un idioma. Guarda cada palabra una sola vez, con sus traducciones en todos los idiomas que conoces.',
            ogDescription: 'Un gestor de vocabulario para personas que hablan más de un idioma.',
            home: 'Inicio de Ladu',
            login: 'Iniciar sesión',
            heading: 'Mantén vivos todos tus idiomas.',
            lead:
                'Ladu es un gestor de vocabulario para personas que hablan más de un idioma. Guarda cada palabra una sola vez, con sus traducciones en todos los idiomas que conoces. Después, practícalas juntas.',
            leadA: 'Ladu es un gestor de vocabulario para personas que hablan más de un idioma.',
            leadB: 'Guarda cada palabra una sola vez, con sus traducciones en todos los idiomas que conoces.',
            leadC: 'Después, practícalas juntas.',
            exerciseCard: 'Ejercicio de ejemplo',
            leadD: 'Agrupa palabras en etiquetas. Mantenlas privadas o compártelas.',
            tagCard: 'Etiquetas de ejemplo',
            tagPrivate: 'Privada',
            tagPublic: 'Pública',
            tagYours: 'Tuya',
            tagFollowing: 'Siguiendo',
            tagWords: 'palabras',
            tagFollowers: 'seguidores',
            open: 'Abrir',
            card: 'Palabra de ejemplo: «dance», en cuatro idiomas',
            privacy: 'Privacidad',
            terms: 'Términos',
            credits: 'Créditos',
            impressum: 'Aviso legal',
            blog: 'Blog',
            blogBack: 'Volver al blog',
            footerNav: 'Enlaces',
            languageLabel: 'Idioma de la interfaz',
            toDark: 'Cambiar al tema oscuro',
            toLight: 'Cambiar al tema claro',
            noticeLabel: 'Aviso de almacenamiento',
            noticeText:
                'Ladu guarda en tu dispositivo solo lo esencial: tu inicio de sesión y tus opciones de tema e idioma. Sin rastreo y sin anuncios.',
            noticeOk: 'Entendido',
        },
        de: {
            title: 'Ladu — halte all deine Sprachen lebendig',
            description:
                'Ladu ist ein Vokabelmanager für Menschen, die mehr als eine Sprache sprechen. Speichere jedes Wort einmal, mit seinen Übersetzungen in allen Sprachen, die du kennst.',
            ogDescription: 'Ein Vokabelmanager für Menschen, die mehr als eine Sprache sprechen.',
            home: 'Ladu Startseite',
            login: 'Anmelden',
            heading: 'Halte all deine Sprachen lebendig.',
            lead:
                'Ladu ist ein Vokabelmanager für Menschen, die mehr als eine Sprache sprechen. Speichere jedes Wort einmal, mit seinen Übersetzungen in allen Sprachen, die du kennst. Übe sie dann gemeinsam.',
            leadA: 'Ladu ist ein Vokabelmanager für Menschen, die mehr als eine Sprache sprechen.',
            leadB: 'Speichere jedes Wort einmal, mit seinen Übersetzungen in allen Sprachen, die du kennst.',
            leadC: 'Übe sie dann gemeinsam.',
            exerciseCard: 'Beispielübung',
            leadD: 'Fasse Wörter in Tags zusammen. Halte sie privat oder teile sie.',
            tagCard: 'Beispiel-Tags',
            tagPrivate: 'Privat',
            tagPublic: 'Öffentlich',
            tagYours: 'Deine',
            tagFollowing: 'Folge ich',
            tagWords: 'Wörter',
            tagFollowers: 'Follower',
            open: 'Öffnen',
            card: 'Beispielwort: „dance“ in vier Sprachen',
            privacy: 'Datenschutz',
            terms: 'Nutzungsbedingungen',
            credits: 'Danksagungen',
            impressum: 'Impressum',
            blog: 'Blog',
            blogBack: 'Zurück zum Blog',
            footerNav: 'Links',
            languageLabel: 'Schnittstellensprache',
            toDark: 'Zum dunklen Design wechseln',
            toLight: 'Zum hellen Design wechseln',
            noticeLabel: 'Hinweis zur Speicherung',
            noticeText:
                'Ladu speichert auf deinem Gerät nur das Nötigste: deine Anmeldung sowie deine Design- und Sprachwahl. Kein Tracking und keine Werbung.',
            noticeOk: 'Verstanden',
        },
        ee: {
            title: 'Ladu — hoia kõik oma keeled elus',
            description:
                'Ladu on sõnavarahaldur inimestele, kes räägivad rohkem kui ühte keelt. Salvesta iga sõna ainult üks kord koos tõlgetega kõigis keeltes, mida oskad.',
            ogDescription: 'Sõnavarahaldur inimestele, kes räägivad rohkem kui ühte keelt.',
            home: 'Ladu avaleht',
            login: 'Logi sisse',
            heading: 'Hoia kõik oma keeled elus.',
            lead:
                'Ladu on sõnavarahaldur inimestele, kes räägivad rohkem kui ühte keelt. Salvesta iga sõna ainult üks kord koos tõlgetega kõigis keeltes, mida oskad. Seejärel harjuta neid koos.',
            leadA: 'Ladu on sõnavarahaldur inimestele, kes räägivad rohkem kui ühte keelt.',
            leadB: 'Salvesta iga sõna ainult üks kord koos tõlgetega kõigis keeltes, mida oskad.',
            leadC: 'Seejärel harjuta neid koos.',
            exerciseCard: 'Näidisharjutus',
            leadD: 'Koonda sõnad tagidesse. Hoia need privaatsena või jaga neid.',
            tagCard: 'Näidistagid',
            tagPrivate: 'Privaatne',
            tagPublic: 'Avalik',
            tagYours: 'Sinu',
            tagFollowing: 'Jälgin',
            tagWords: 'sõna',
            tagFollowers: 'jälgijat',
            open: 'Ava',
            card: 'Näitesõna: „dance“ neljas keeles',
            privacy: 'Privaatsus',
            terms: 'Kasutustingimused',
            credits: 'Autorid ja litsentsid',
            impressum: 'Impressum',
            blog: 'Blogi',
            blogBack: 'Tagasi blogisse',
            footerNav: 'Lingid',
            languageLabel: 'Liidese keel',
            toDark: 'Lülita tumedale teemale',
            toLight: 'Lülita heledale teemale',
            noticeLabel: 'Teade salvestamise kohta',
            noticeText:
                'Ladu salvestab sinu seadmesse ainult hädavajaliku: sinu sisselogimise ning teema- ja keelevaliku. Jälgimist ega reklaami ei ole.',
            noticeOk: 'Selge',
        },
    };

    /* ---------- storage (guarded: private windows and blocked storage throw) ---------- */

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            /* the choice still applies for this page view */
        }
    }

    function langByCode(code) {
        return LANGS.filter(function (l) {
            return l.code === code;
        })[0];
    }

    /* The table's own code for `code`, or null. Returning the table's constant
       (never the stored / browser string) keeps unchecked text out of anything
       built from it, such as the links into the app. */
    function knownLang(code) {
        var entry = langByCode(code);
        return entry ? entry.code : null;
    }

    /* ---------- theme ---------- */

    function storedTheme() {
        var value = read(THEME_KEY);
        /* literals, not `value`: only 'light' or 'dark' can ever come out */
        if (value === 'light') return 'light';
        if (value === 'dark') return 'dark';
        return null;
    }

    function systemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function currentTheme() {
        return storedTheme() || systemTheme();
    }

    /* ---------- language ---------- */

    function detectLanguage() {
        var saved = knownLang(read(LANG_KEY));
        if (saved) return saved;
        var preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        for (var i = 0; i < preferred.length; i += 1) {
            var base = String(preferred[i] || '').slice(0, 2).toLowerCase();
            if (base === 'et') base = 'ee'; /* ISO Estonian -> the app's code */
            if (knownLang(base)) return knownLang(base);
        }
        return 'en';
    }

    var language = detectLanguage();

    /* ---------- rendering ---------- */

    function applyText() {
        var strings = STRINGS[language];
        document.documentElement.setAttribute('lang', HTML_LANG[language]);

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var text = strings[el.getAttribute('data-i18n')];
            if (text !== undefined) el.textContent = text;
        });

        /* data-i18n-attr="aria-label:home;content:description" */
        document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
            el.getAttribute('data-i18n-attr')
                .split(';')
                .forEach(function (pair) {
                    var parts = pair.split(':');
                    var text = strings[parts[1]];
                    if (text !== undefined) el.setAttribute(parts[0], text);
                });
        });
    }

    /* The address of `path` in the app, with the visitor's choices: ?lng always,
       &theme only for a choice made here. Built with URL and refused unless it
       stays on the app's own origin, so a `data-app` value such as
       "//other.example" or "javascript:..." can never become a link. Returns
       null for a refused path. */
    function appHref(path) {
        var url;
        try {
            url = new URL(path, APP_ORIGIN);
        } catch (e) {
            return null;
        }
        if (url.origin !== APP_ORIGIN) return null;
        url.searchParams.set('lng', knownLang(language) || 'en');
        var chosen = storedTheme();
        if (chosen) url.searchParams.set('theme', chosen);
        return url.toString();
    }

    function applyLinks() {
        document.querySelectorAll('[data-app]').forEach(function (a) {
            var href = appHref(a.getAttribute('data-app') || '');
            /* refused: leave the static href from the HTML as it is */
            if (href) a.setAttribute('href', href);
        });
    }

    function applyThemeButtons() {
        var strings = STRINGS[language];
        var label = currentTheme() === 'dark' ? strings.toLight : strings.toDark;
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            btn.setAttribute('aria-label', label);
        });
    }

    function setTheme(theme) {
        write(THEME_KEY, theme);
        document.documentElement.setAttribute('data-theme', theme);
        applyThemeButtons();
        applyLinks();
    }

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
        });
    });

    /* ---------- language picker (same look as the app's LanguageMenu) ---------- */

    var CHECK_SVG =
        '<svg class="check" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32z"/></svg>';

    var picker = document.querySelector('[data-picker]');
    var trigger = picker && picker.querySelector('.picker-trigger');
    var menu = picker && picker.querySelector('.picker-menu');

    function menuItems() {
        return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
    }

    function openMenu(focusIndex) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        var items = menuItems();
        if (typeof focusIndex === 'number' && items[focusIndex]) items[focusIndex].focus();
    }

    function closeMenu(returnFocus) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
    }

    function renderPicker() {
        var current = langByCode(language);
        trigger.querySelector('.flag').setAttribute('src', current.flag);
        trigger.querySelector('.picker-code').textContent = current.key;
        menuItems().forEach(function (item) {
            item.setAttribute('aria-checked', String(item.getAttribute('data-code') === language));
        });
    }

    function setLanguage(code) {
        language = code;
        write(LANG_KEY, code);
        applyText();
        applyLinks();
        applyThemeButtons();
        renderPicker();
    }

    if (picker && trigger && menu) {
        LANGS.forEach(function (lang) {
            var li = document.createElement('li');
            li.setAttribute('role', 'none');

            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'picker-item';
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('data-code', lang.code);

            var label = document.createElement('span');
            label.className = 'picker-item-label';
            var flag = document.createElement('img');
            flag.className = 'flag';
            flag.setAttribute('src', lang.flag);
            flag.setAttribute('alt', '');
            flag.setAttribute('width', '20');
            flag.setAttribute('height', '14');
            label.appendChild(flag);
            label.appendChild(document.createTextNode(lang.native));
            item.appendChild(label);
            item.insertAdjacentHTML('beforeend', CHECK_SVG);

            item.addEventListener('click', function () {
                setLanguage(lang.code);
                closeMenu(true);
            });
            li.appendChild(item);
            menu.appendChild(li);
        });

        trigger.addEventListener('click', function () {
            if (menu.hidden) openMenu();
            else closeMenu(false);
        });

        trigger.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                openMenu(0);
            }
        });

        menu.addEventListener('keydown', function (event) {
            var items = menuItems();
            var index = items.indexOf(document.activeElement);
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                items[(index + 1) % items.length].focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                items[(index - 1 + items.length) % items.length].focus();
            } else if (event.key === 'Home') {
                event.preventDefault();
                items[0].focus();
            } else if (event.key === 'End') {
                event.preventDefault();
                items[items.length - 1].focus();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu(true);
            } else if (event.key === 'Tab') {
                closeMenu(false);
            }
        });

        document.addEventListener('click', function (event) {
            if (!menu.hidden && !picker.contains(event.target)) closeMenu(false);
        });
    }

    /* ---------- storage notice ---------- */

    /* Shown only where cookie rules apply (region.js decides) and only until
       the visitor presses the button. Bump the version to show it again, for
       example when something optional, such as analytics, is added. The text
       carries data-i18n, so applyText() translates it, also after a language
       change. */
    var NOTICE_KEY = 'ladu.notice.v1';

    var NOTICE_HTML =
        '<p class="notice-text"><span data-i18n="noticeText"></span> ' +
        '<a class="link-quiet" href="/privacy.html" data-i18n="privacy"></a></p>' +
        '<button type="button" class="button notice-ok" data-i18n="noticeOk"></button>';

    function showNotice() {
        var box = document.createElement('div');
        box.className = 'notice';
        box.setAttribute('role', 'region');
        box.setAttribute('data-i18n-attr', 'aria-label:noticeLabel');
        box.innerHTML = NOTICE_HTML;
        box.querySelector('.notice-ok').addEventListener('click', function () {
            write(NOTICE_KEY, 'ok');
            box.remove();
        });
        document.body.appendChild(box);
        applyText();
    }

    function setupNotice() {
        if (!window.LaduRegion || read(NOTICE_KEY) === 'ok') return;
        window.LaduRegion.check().then(function (needed) {
            if (needed) showNotice();
        });
    }

    /* ---------- the example word rolls ---------- */

    /* The bubble shows one word in four languages. Every ROLL_MS the words change to the next one,
       each old word moving up and out and the new one coming
       in from below, like the greeting on the app's Dashboard changes language. (ROLL_ROWS_TOGETHER picks
       between all rows at once and one row after the other.) The words are fixed
       examples: they are not translated into the interface language. Visitors who asked for less
       motion get the first word and no rolling; a hidden tab skips the turn. */
    var WORDS = [
        { en: 'dance', es: 'bailar', de: 'tanzen', ee: 'tantsima' },
        { en: 'house', es: 'casa', de: 'Haus', ee: 'maja', gender: { es: 'la', de: 'das' } },
        { en: 'pretty', es: 'bonito', de: 'hübsch', ee: 'ilus' },
        { en: 'very', es: 'muy', de: 'sehr', ee: 'väga' },
    ];
    var ROLL_MS = 5000;
    /* true: all four rows change at the same moment. false: one row after the other, a short delay apart. */
    var ROLL_ROWS_TOGETHER = true;
    var ROW_DELAY_MS = ROLL_ROWS_TOGETHER ? 0 : 140;
    var OUT_MS = 230;

    /* Rolls one part of the page: it moves up and out, `change()` swaps its content, and it comes in from below
       (the classes are in style.css). */
    function roll(el, change) {
        el.classList.add('is-out');
        window.setTimeout(function () {
            change();
            /* Jump to below with no transition, then let it roll up into place. */
            el.classList.remove('is-out');
            el.classList.add('is-in');
            void el.offsetWidth;
            el.classList.remove('is-in');
        }, OUT_MS);
    }

    /* The small exercise cards (phone): one for each word of the bubble, in the same order. On the beat that
       changes the words, the card that belongs to the new word comes in, and is played as if someone were
       answering it (see index.html): half a second after it appears the answer is chosen or typed, then the
       choice or input turns green or red and the fourth dot takes the colour. All the panels are in the page;
       only the active one is visible. */
    var PLAY_DELAY_MS = 500;
    var TYPE_MS = 120;
    var RESULT_DELAY_MS = 280;
    var PICK_MS = 380;
    var playTimers = [];

    function later(fn, ms) {
        playTimers.push(window.setTimeout(fn, ms));
    }

    function stopPlay() {
        playTimers.forEach(window.clearTimeout);
        playTimers = [];
    }

    function lastDot(panel) {
        var dots = panel.querySelectorAll('.ex-dots i');
        return dots[dots.length - 1];
    }

    /* The card as a question not yet answered. */
    function resetPanel(panel) {
        panel.querySelectorAll('.ex-opt').forEach(function (opt) {
            opt.classList.remove('is-picking', 'is-right', 'is-wrong');
        });
        var input = panel.querySelector('.ex-input');
        if (input) {
            input.classList.remove('is-right', 'is-wrong', 'is-typing');
            panel.querySelector('.ex-answer').textContent = '';
        }
        lastDot(panel).classList.remove('is-good', 'is-bad');
    }

    /* Shows the result: the chosen option or the input in its colour, and the fourth dot. */
    function showResult(panel) {
        var cls = panel.getAttribute('data-result') === 'right' ? 'is-right' : 'is-wrong';
        var pick = panel.getAttribute('data-pick');
        if (pick) {
            panel.querySelectorAll('.ex-opt').forEach(function (opt) {
                opt.classList.remove('is-picking');
                if (opt.textContent === pick) opt.classList.add(cls);
            });
        }
        var input = panel.querySelector('.ex-input');
        if (input) {
            input.classList.remove('is-typing');
            input.classList.add(cls);
        }
        lastDot(panel).classList.add(cls === 'is-right' ? 'is-good' : 'is-bad');
    }

    /* The finished card at once (visitors who asked for less motion). */
    function settlePanel(panel) {
        var word = panel.getAttribute('data-type');
        if (word) panel.querySelector('.ex-answer').textContent = word;
        showResult(panel);
    }

    function playPanel(panel) {
        var word = panel.getAttribute('data-type');
        if (!word) {
            /* Multiple choice: the option is pressed, then it takes its colour and the dot follows. */
            var pick = panel.getAttribute('data-pick');
            later(function () {
                panel.querySelectorAll('.ex-opt').forEach(function (opt) {
                    if (opt.textContent === pick) opt.classList.add('is-picking');
                });
            }, PLAY_DELAY_MS);
            later(function () {
                showResult(panel);
            }, PLAY_DELAY_MS + PICK_MS);
            return;
        }
        /* Typed answer: the word appears letter by letter, then the result. */
        var input = panel.querySelector('.ex-input');
        var answer = panel.querySelector('.ex-answer');
        later(function () {
            input.classList.add('is-typing');
        }, PLAY_DELAY_MS - 100);
        for (var i = 1; i <= word.length; i++) {
            (function (n) {
                later(function () {
                    answer.textContent = word.slice(0, n);
                }, PLAY_DELAY_MS + n * TYPE_MS);
            })(i);
        }
        later(function () {
            showResult(panel);
        }, PLAY_DELAY_MS + word.length * TYPE_MS + RESULT_DELAY_MS);
    }

    function exercisePanels(stage) {
        return Array.prototype.slice.call(stage.querySelectorAll('.ex-panel'));
    }

    /* First card: unanswered, then played (or finished at once with reduced motion). */
    function startExercises(stage, reduced) {
        var panels = exercisePanels(stage);
        panels.forEach(resetPanel);
        var first = panels[0];
        if (reduced) settlePanel(first);
        else playPanel(first);
    }

    function turnExercise(stage, index) {
        var panels = exercisePanels(stage);
        roll(stage, function () {
            panels.forEach(function (panel, i) {
                resetPanel(panel);
                panel.classList.toggle('is-active', i === index % panels.length);
            });
            playPanel(panels[index % panels.length]);
        });
    }

    /* The tag card (phone): three tags that turn on the same beat. The words of the tag that comes in appear one
       after the other. While `data-anim` is on the stage, CSS hides the words until they get `.is-shown`. */
    var TAG_WORD_MS = 190;

    function tagPanels(stage) {
        return Array.prototype.slice.call(stage.querySelectorAll('.tag-panel'));
    }

    function resetTagPanel(panel) {
        panel.querySelectorAll('.tag-word').forEach(function (word) {
            word.classList.remove('is-shown');
        });
    }

    function playTagPanel(panel) {
        panel.querySelectorAll('.tag-word').forEach(function (word, i) {
            later(function () {
                word.classList.add('is-shown');
            }, PLAY_DELAY_MS + i * TAG_WORD_MS);
        });
    }

    function startTags(stage, reduced) {
        if (reduced) return;
        stage.setAttribute('data-anim', '');
        var panels = tagPanels(stage);
        panels.forEach(resetTagPanel);
        playTagPanel(panels[0]);
    }

    function turnTags(stage, index) {
        var panels = tagPanels(stage);
        var next = index % panels.length;
        roll(stage, function () {
            panels.forEach(function (panel, i) {
                resetTagPanel(panel);
                panel.classList.toggle('is-active', i === next);
            });
            playTagPanel(panels[next]);
        });
    }

    function rollWords() {
        var terms = document.querySelectorAll('[data-term]');
        if (!terms.length) return;
        var stage = document.querySelector('[data-exercise]');
        var tagStage = document.querySelector('[data-tags]');
        var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (stage) startExercises(stage, reduced);
        if (tagStage) startTags(tagStage, reduced);
        if (reduced) return;

        var index = 0;
        var tagIndex = 0;
        window.setInterval(function () {
            if (document.hidden) return;
            stopPlay();
            index = (index + 1) % WORDS.length;
            terms.forEach(function (el, row) {
                window.setTimeout(function () {
                    roll(el, function () {
                        var code = el.getAttribute('data-term');
                        el.textContent = WORDS[index][code];
                        /* A noun shows its gender (a badge, phone only); the other words show none. */
                        var badge = document.querySelector('[data-gender="' + code + '"]');
                        if (badge) {
                            var gender = WORDS[index].gender && WORDS[index].gender[code];
                            badge.textContent = gender || '';
                            badge.classList.toggle('is-on', !!gender);
                        }
                    });
                }, row * ROW_DELAY_MS);
            });
            if (stage) turnExercise(stage, index);
            if (tagStage) turnTags(tagStage, ++tagIndex);
        }, ROLL_MS);
    }

    /* ---------- first render ---------- */

    applyText();
    applyLinks();
    applyThemeButtons();
    if (picker && trigger && menu) renderPicker();
    setupNotice();
    rollWords();
})();
