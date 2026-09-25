/* Landing page behaviour: language, theme, and the links into the app.
   Plain script, no build step. Mirrors the app (frontend/src/lib/theme.ts,
   lib/handoff.ts, i18n.ts) — keep the rules in sync:
     - theme: saved choice first, OS preference second; the switch offers only
       light and dark (Phase 3.9, D1).
     - language: saved choice, then the browser language, then English.
     - links into the app carry ?lng=<code>, and &theme=<choice> ONLY when the
       visitor pressed the switch here. Sending the OS default as a "choice"
       would let a returning user on a new device overwrite the theme saved on
       their account (D7). The app reads both values once and cleans the URL. */
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
            open: 'Open Ladu',
            card: 'Example word: to dance, in four languages',
            privacy: 'Privacy',
            languageLabel: 'Interface language',
            toDark: 'Switch to dark theme',
            toLight: 'Switch to light theme',
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
            open: 'Abrir Ladu',
            card: 'Palabra de ejemplo: «to dance», en cuatro idiomas',
            privacy: 'Privacidad',
            languageLabel: 'Idioma de la interfaz',
            toDark: 'Cambiar al tema oscuro',
            toLight: 'Cambiar al tema claro',
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
            open: 'Ladu öffnen',
            card: 'Beispielwort: „to dance“ in vier Sprachen',
            privacy: 'Datenschutz',
            languageLabel: 'Schnittstellensprache',
            toDark: 'Zum dunklen Design wechseln',
            toLight: 'Zum hellen Design wechseln',
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
            open: 'Ava Ladu',
            card: 'Näitesõna: „to dance“ neljas keeles',
            privacy: 'Privaatsus',
            languageLabel: 'Liidese keel',
            toDark: 'Lülita tumedale teemale',
            toLight: 'Lülita heledale teemale',
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

    function isLang(code) {
        return LANGS.some(function (l) {
            return l.code === code;
        });
    }

    function langByCode(code) {
        return LANGS.filter(function (l) {
            return l.code === code;
        })[0];
    }

    /* ---------- theme ---------- */

    function storedTheme() {
        var value = read(THEME_KEY);
        return value === 'light' || value === 'dark' ? value : null;
    }

    function systemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function currentTheme() {
        return storedTheme() || systemTheme();
    }

    /* ---------- language ---------- */

    function detectLanguage() {
        var saved = read(LANG_KEY);
        if (isLang(saved)) return saved;
        var preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        for (var i = 0; i < preferred.length; i += 1) {
            var base = String(preferred[i] || '').slice(0, 2).toLowerCase();
            if (base === 'et') base = 'ee'; /* ISO Estonian -> the app's code */
            if (isLang(base)) return base;
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

    /* The links into the app: ?lng always, &theme only for a choice made here. */
    function applyLinks() {
        var chosen = storedTheme();
        var query = '?lng=' + language + (chosen ? '&theme=' + chosen : '');
        document.querySelectorAll('[data-app]').forEach(function (a) {
            a.setAttribute('href', APP_ORIGIN + a.getAttribute('data-app') + query);
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

    /* ---------- first render ---------- */

    applyText();
    applyLinks();
    applyThemeButtons();
    if (picker && trigger && menu) renderPicker();
})();
