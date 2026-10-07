// Reserved names, slice 7 — the normalizer and the check, with no database.
// See .context/plans/verified-badges.md.
const { normalizeName, isReservedName } = require('../lib/reservedNames');

describe('normalizeName', () => {
    it('removes case, spaces, punctuation and zero-width characters', () => {
        expect(normalizeName('K E-v.i_n')).toBe(normalizeName('kevin'));
        expect(normalizeName('Ke​vin')).toBe(normalizeName('kevin'));
        expect(normalizeName('  Kevin  ')).toBe(normalizeName('kevin'));
    });

    it('removes accents, so "Ladú" and "Lädu" read as "ladu"', () => {
        expect(normalizeName('Ladú')).toBe(normalizeName('ladu'));
        expect(normalizeName('Lädu')).toBe(normalizeName('ladu'));
        expect(normalizeName('Õu')).toBe(normalizeName('ou'));
    });

    it('turns full-width and styled letters into plain ones', () => {
        expect(normalizeName('ＬＡＤＵ')).toBe(normalizeName('ladu'));
        expect(normalizeName('𝓛𝓪𝓭𝓾')).toBe(normalizeName('ladu'));
    });

    it('maps look-alike letters from Cyrillic and Greek', () => {
        expect(normalizeName('Lаdu')).toBe(normalizeName('ladu')); // Cyrillic а
        expect(normalizeName('Lαdu')).toBe(normalizeName('ladu')); // Greek α
        expect(normalizeName('оfficial')).toBe(normalizeName('official')); // Cyrillic о
    });

    it('returns an empty string when nothing is left', () => {
        expect(normalizeName('🙂 ‍')).toBe('');
        expect(normalizeName('')).toBe('');
    });
});

describe('isReservedName — refused', () => {
    it.each([
        // the brand word, however it is written
        'Ladu',
        'ladu',
        'LADU',
        'L a d u',
        'L.a.d.u',
        'L_a_d_u',
        'LADÚ',
        'Lädu',
        'Lаdu', // Cyrillic а
        'Lαdu', // Greek α
        'ＬＡＤＵ', // full-width
        'Ladu​', // zero-width space
        '1adu', // 1 for l
        '|adu', // | for l
        'Iadu', // capital i for l
        'Ładu', // Polish ł
        // contains the word
        'Ladu_0fficial',
        'The Ladu Team',
        'ladu-support',
        'MyLadu',
        'Lady Ladu Fan',
        // the other brand word
        'Official',
        '0fficial', // 0 for o
        'Off1cial', // 1 for i
        'Offıcial', // dotless i
        'Оfficial', // Cyrillic О
        'Official Account',
        'unofficial',
        // reserved words, when the name IS the word
        'Admin',
        'ADMIN',
        'a d m i n',
        'Adm1n',
        'Admin 2',
        'Admín',
        'Staff',
        'Support',
        'Moderator',
        'Mod3rator',
        'Team',
        'TEAM',
        'team 2',
        '_team_',
    ])('refuses %j', (value) => {
        expect(isReservedName(value)).toBe(true);
    });
});

describe('isReservedName — allowed', () => {
    it.each([
        'Kevin',
        'kaja_tamm',
        'Mari Maasikas',
        'Ladislav', // "ladi", not "ladu"
        'Ladislas',
        'badminton', // contains "admin", but only the exact word is refused
        'administrator',
        'teammate',
        'teamwork',
        'supporter',
        'support_ninja',
        'staffer',
        'moderators',
        'offside',
        'officer',
        'Maria',
        'Nikola',
        'Ana',
    ])('allows %j', (value) => {
        expect(isReservedName(value)).toBe(false);
    });

    it('allows an empty or symbol-only value (other rules decide about those)', () => {
        expect(isReservedName('')).toBe(false);
        expect(isReservedName('   ')).toBe(false);
        expect(isReservedName('🙂')).toBe(false);
    });

    it.each([undefined, null, 5, {}, ['ladu']])('returns false for a value that is not a string: %j', (value) => {
        expect(isReservedName(value)).toBe(false);
    });
});
