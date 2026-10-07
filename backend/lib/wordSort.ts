/**
 * Sorting the word list by one language column (`GET /api/words/simple?sort=EN&dir=asc`).
 *
 * The sort key of a word is the text the table shows in that language's cell:
 * the "main" case of its translation (singular nominative for a German noun,
 * the infinitive for a verb...). The names below must match the ones in
 * `getRequiredFieldsData` (wordController.ts). The key is lowercase, so
 * "apple" and "Banana" sort as a person expects. A word with no text in the
 * language has a NULL key and always goes last, in both directions.
 *
 * The paging cursor of a sorted list holds the key of the last row and its id.
 * (The default list keeps its own cursor on `createdAt`.)
 */
const { sql }: typeof import("drizzle-orm") = require("drizzle-orm");
const { words }: typeof import("../src/db/schema") = require("../src/db/schema");

const LANGUAGE_BY_KEY: Record<string, string> = {
  EN: "English",
  ES: "Spanish",
  DE: "German",
  EE: "Estonian",
};

/** The main case names of each language, over all parts of speech. A case name belongs to one part of speech only. */
const MAIN_CASE_NAMES: Record<string, string[]> = {
  English: ["singularEN", "adverbEN", "positiveEN", "simplePresent1sEN"],
  Spanish: ["singularES", "adverbES", "maleSingularES", "neutralSingularES", "infinitiveNonFiniteSimpleES"],
  German: ["singularNominativDE", "adverbDE", "positiveDE", "infinitiveDE"],
  Estonian: ["singularNimetavEE", "algvorreEE", "infinitiveMaEE"],
};

export type SortDirection = "asc" | "desc";

export interface WordSort {
  langKey: string;
  direction: SortDirection;
}

/** `null` when the query has no sort. Throws a message for an unknown language or direction. */
function parseSort(query: { sort?: unknown; dir?: unknown }): WordSort | null {
  if (query.sort === undefined || query.sort === "") return null;
  if (typeof query.sort !== "string" || !(query.sort in LANGUAGE_BY_KEY)) {
    throw new Error("Invalid sort language");
  }
  if (query.dir !== undefined && query.dir !== "asc" && query.dir !== "desc") {
    throw new Error("Invalid sort direction");
  }
  return { langKey: query.sort, direction: query.dir === "desc" ? "desc" : "asc" };
}

/** A scalar SQL expression: the lowercase main text of the word in the language, or NULL. */
function sortKeyExpression(langKey: string) {
  const names = sql.join(
    MAIN_CASE_NAMES[LANGUAGE_BY_KEY[langKey]].map((name) => sql`${name}`),
    sql`, `,
  );
  // A Spanish adjective may have the neutral form only: the male one wins when both exist.
  // Plain names and aliases (sql.raw): Drizzle drops table names from columns in a select list,
  // and the subquery then would not know which table a column belongs to.
  return sql`(
    SELECT lower(sort_tc.word)
    FROM translations sort_tr
    INNER JOIN translation_cases sort_tc ON sort_tc.translation_id = sort_tr.id
    WHERE sort_tr.word_id = ${sql.raw('"words"."id"')}
      AND sort_tr.language = ${LANGUAGE_BY_KEY[langKey]}
      AND sort_tc.case_name IN (${names})
    ORDER BY (sort_tc.case_name = 'neutralSingularES')
    LIMIT 1
  )`;
}

/** The rows after the cursor row, in the sorted order (NULL keys last). */
function afterCursorCondition(sort: WordSort, key: ReturnType<typeof sortKeyExpression>, cursor: { key: string | null; id: string }) {
  const asc = sort.direction === "asc";
  if (cursor.key === null) {
    return asc ? sql`(${key} IS NULL AND ${words.id} > ${cursor.id})` : sql`(${key} IS NULL AND ${words.id} < ${cursor.id})`;
  }
  return asc
    ? sql`(${key} > ${cursor.key} OR (${key} = ${cursor.key} AND ${words.id} > ${cursor.id}) OR ${key} IS NULL)`
    : sql`(${key} < ${cursor.key} OR (${key} = ${cursor.key} AND ${words.id} < ${cursor.id}) OR ${key} IS NULL)`;
}

function orderByClauses(sort: WordSort, key: ReturnType<typeof sortKeyExpression>) {
  return sort.direction === "asc"
    ? [sql`${key} ASC NULLS LAST`, sql`${words.id} ASC`]
    : [sql`${key} DESC NULLS LAST`, sql`${words.id} DESC`];
}

function encodeSortCursor(key: string | null, id: string): string {
  return Buffer.from(JSON.stringify({ k: key, id }), "utf-8").toString("base64");
}

function decodeSortCursor(cursor: string): { key: string | null; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    if (typeof parsed?.id !== "string" || !(parsed.k === null || typeof parsed.k === "string")) return null;
    return { key: parsed.k, id: parsed.id };
  } catch {
    return null;
  }
}

export {
  parseSort,
  sortKeyExpression,
  afterCursorCondition,
  orderByClauses,
  encodeSortCursor,
  decodeSortCursor,
};
