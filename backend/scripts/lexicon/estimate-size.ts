/**
 * Slice 0 step 0e: size of the full lexicon (strategy doc §12, decision D5: every noun and
 * verb lemma with forms, only the forms that fill our case fields).
 *
 * Applies the selector tables to EVERY noun/verb lemma entry of EN, ES and DE, adds the
 * Eesthetic Estonian paradigms (our cells only) and counts the English translation rows.
 * The Postgres size is an ESTIMATE from per-row costs (no database is touched):
 *   lexeme row ≈ 28 B tuple/item overhead + its text columns + ~16 B fixed columns,
 *   lexeme_form row ≈ 28 B overhead + 8 B lexeme_id + case_name + form,
 *   each B-tree index entry ≈ 16 B + its key bytes.
 *
 * Writes .data/estimate-size.md.
 *
 *   cd backend && npx tsx scripts/lexicon/estimate-size.ts
 */

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { DATA_DIR, EESTHETIC_DIR, kaikkiFile, readLines }: typeof import('./common') = require('./common');
const { selectCases }: typeof import('../../lib/lexicon/select') = require('../../lib/lexicon/select');
const de: typeof import('../../lib/lexicon/selectors/de') = require('../../lib/lexicon/selectors/de');
const es: typeof import('../../lib/lexicon/selectors/es') = require('../../lib/lexicon/selectors/es');
const en: typeof import('../../lib/lexicon/selectors/en') = require('../../lib/lexicon/selectors/en');
type CaseSelector = import('../../lib/lexicon/select').CaseSelector;

const SELECTORS: Record<string, Record<string, CaseSelector[]>> = {
    de: { noun: de.NOUN_SELECTORS_DE, verb: de.VERB_SELECTORS_DE },
    es: { noun: es.NOUN_SELECTORS_ES, verb: es.VERB_SELECTORS_ES },
    en: { noun: en.NOUN_SELECTORS_EN, verb: en.VERB_SELECTORS_EN },
};
const EE_CELLS = new Set(['nom.sg', 'nom.pl', 'gen.sg', 'gen.pl', 'part.sg', 'part.pl', 'ill.sg', 'sup', 'inf', 'ptcp.pst.pers',
    ...['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'].flatMap((p) => [`ind.prs.${p}`, `ind.pst.ipfv.${p}`])]);

const OVERHEAD = 28;
const INDEX_ENTRY = 16;
const bytes = (s: string) => Buffer.byteLength(s, 'utf8') + 1;

interface Totals {
    lexemes: number; forms: number; lexemeBytes: number; formBytes: number; lexemeIndexBytes: number; formIndexBytes: number;
    /** Layout B: one jsonb column of forms per lexeme, and cells equal to the lemma not stored. */
    compactForms: number; compactBytes: number;
}
const empty = (): Totals => ({
    lexemes: 0, forms: 0, lexemeBytes: 0, formBytes: 0, lexemeIndexBytes: 0, formIndexBytes: 0, compactForms: 0, compactBytes: 0,
});

/** jsonb: ~4 B per key/value entry header + the key and value text, + ~8 B per object. */
function addCompact(t: Totals, lemma: string, cases: Iterable<[string, string]>): void {
    t.compactBytes += 8;
    for (const [caseName, form] of cases) {
        if (form === lemma) continue;
        t.compactForms++;
        t.compactBytes += 8 + bytes(caseName) + bytes(form);
    }
}

function addLexeme(t: Totals, lemma: string): void {
    t.lexemes++;
    // lang, pos, lemma, search_key, gender, source, licence, source_version (short texts) + id, freq_rank
    t.lexemeBytes += OVERHEAD + 2 * bytes(lemma) + 40 + 16;
    t.lexemeIndexBytes += INDEX_ENTRY + bytes(lemma) + 4 + INDEX_ENTRY + 8; // (lang, pos, search_key) + primary key
}

function addForm(t: Totals, caseName: string, form: string): void {
    t.forms++;
    t.formBytes += OVERHEAD + 8 + bytes(caseName) + bytes(form);
    t.formIndexBytes += INDEX_ENTRY + 8 + bytes(caseName); // primary key (lexeme_id, case_name)
}

async function main(): Promise<void> {
    const totals: Record<string, Totals> = {};
    let translations = 0, translationBytes = 0;

    for (const lang of ['de', 'es', 'en'] as const) {
        const t = (totals[lang] = empty());
        const seen = new Set<string>();
        for await (const line of readLines(fs.createReadStream(kaikkiFile(lang)))) {
            const entry = JSON.parse(line);
            const selectors = SELECTORS[lang][entry.pos];
            if (lang === 'en') {
                for (const tr of entry.translations ?? []) {
                    if (!tr.word) continue; // note-only rows
                    translations++;
                    translationBytes += OVERHEAD + 8 + 3 + bytes(tr.word) + bytes(tr.sense ?? '') + 8 + INDEX_ENTRY + bytes(tr.word) + 8;
                }
            }
            if (!selectors || !(entry.senses ?? []).some((sense: any) => !sense.form_of)) continue;
            const key = `${entry.pos}|${entry.word}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const cases = selectCases(entry, selectors);
            if (cases.size === 0) continue;
            addLexeme(t, entry.word);
            for (const [caseName, form] of cases) addForm(t, caseName, form);
            addCompact(t, entry.word, cases);
        }
    }

    const ee = (totals.et = empty());
    const lexemeLemma = new Map<string, string>();
    for (const line of fs.readFileSync(path.join(EESTHETIC_DIR, 'estonian_lexemes.csv'), 'utf8').split('\n').slice(1)) {
        const [id, lemma] = line.split(',');
        if (id) lexemeLemma.set(id, lemma);
    }
    for (const lemma of lexemeLemma.values()) addLexeme(ee, lemma);
    const eeCases = new Map<string, [string, string][]>();
    for (const line of fs.readFileSync(path.join(EESTHETIC_DIR, 'estonian_paradigms.csv'), 'utf8').split('\n').slice(1)) {
        const [, lexeme, cell, , , orth] = line.split(',');
        if (!lexeme || !orth || !EE_CELLS.has(cell)) continue;
        // Our case names are ~20 characters ("singularOsastavEE"); pad the short cell ids to match.
        addForm(ee, cell.padEnd(20, 'x'), orth);
        (eeCases.get(lexeme) ?? eeCases.set(lexeme, []).get(lexeme)!).push([cell.padEnd(20, 'x'), orth]);
    }
    for (const [lexeme, cases] of eeCases) addCompact(ee, lexemeLemma.get(lexeme) ?? '', cases);

    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    const lines = [`# Slice 0 size estimate (generated ${new Date().toISOString()})`, ''];
    lines.push('Layout A: one `lexeme_form` row per form (strategy doc §12). Layout B: one jsonb column of forms per `lexeme`, cells equal to the lemma not stored (filled from the lemma at read time).', '');
    lines.push('| language | lexemes | A: forms | A: total | B: stored forms | B: total |', '|---|---|---|---|---|---|');
    let grandA = 0, grandB = 0;
    for (const [lang, t] of Object.entries(totals)) {
        const totalA = t.lexemeBytes + t.formBytes + t.lexemeIndexBytes + t.formIndexBytes;
        const totalB = t.lexemeBytes + t.compactBytes + t.lexemeIndexBytes;
        grandA += totalA;
        grandB += totalB;
        lines.push(`| ${lang} | ${t.lexemes.toLocaleString('en')} | ${t.forms.toLocaleString('en')} | ${mb(totalA)} | ${t.compactForms.toLocaleString('en')} | ${mb(totalB)} |`);
    }
    lines.push(`| translations (EN → es/de/et) | — | ${translations.toLocaleString('en')} rows | ${mb(translationBytes)} | same | ${mb(translationBytes)} |`);
    lines.push('', `Total without translations: A ${mb(grandA)}, B ${mb(grandB)}. With translations: A ${mb(grandA + translationBytes)}, B ${mb(grandB + translationBytes)}. Postgres pages are not full, so allow up to +30%.`);
    fs.writeFileSync(path.join(DATA_DIR, 'estimate-size.md'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
