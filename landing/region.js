/* Where is the visitor? Decides if the storage notice is shown.
   Plain script, no build step. Sets one global: window.LaduRegion.
   Unit tests: scripts/region.test.mjs (loads this file with node:vm).

   How it works:
     - Cloudflare adds the visitor's country (CF-IPCountry) to each request.
     - The landing server returns that code at /region (see Caddyfile).
     - needsNotice(code) says if the code is in a region with cookie rules:
       the EU, the other EEA states and the UK.
   The rule fails safe: an unknown, empty or invalid code means "show the
   notice". A notice shown by mistake is harmless. A missing one is not.
   Switzerland is not in the list on purpose: its cookie rules are weaker. */
(function (root) {
    'use strict';

    var NOTICE_COUNTRIES = [
        /* EU */
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
        'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
        /* EEA, not EU */
        'IS', 'LI', 'NO',
        /* UK (UK GDPR and PECR) */
        'GB',
    ];

    /* Cloudflare sends "XX" when it does not know the country (T1 is Tor). */
    var UNKNOWN = 'XX';

    function needsNotice(code) {
        if (typeof code !== 'string') return true;
        var upper = code.trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(upper) || upper === UNKNOWN) return true;
        return NOTICE_COUNTRIES.indexOf(upper) !== -1;
    }

    /* Test and preview only: "?region=DE" on a local address. The real site
       never reads it, so a visitor cannot switch the notice off with a link. */
    function previewCode(location) {
        var host = location.hostname;
        var local = host === 'localhost' || host === '127.0.0.1' || /\.localhost$/.test(host);
        if (!local) return null;
        var match = /[?&]region=([^&]*)/.exec(location.search || '');
        return match ? decodeURIComponent(match[1]) : null;
    }

    /* Promise<boolean>. Never rejects: any failure means "show the notice". */
    function check() {
        var preview = previewCode(root.location);
        if (preview !== null) return Promise.resolve(needsNotice(preview));
        if (typeof root.fetch !== 'function') return Promise.resolve(true);
        return root
            .fetch('/region', { cache: 'no-store' })
            .then(function (response) {
                return response.ok ? response.text() : '';
            })
            .then(needsNotice)
            .catch(function () {
                return true;
            });
    }

    root.LaduRegion = { needsNotice: needsNotice, check: check };
})(window);
