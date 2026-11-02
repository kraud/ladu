# Guide: Testing policy

Use this guide before you add a test to a feature. It says which tests to write by default, which tests to write only on request, and which layer owns which rule.

## Summary

- **Default:** write functional tests. A functional test proves what the user or the API client can do, and what they cannot do.
- **Each rule has one owner layer:** the lowest layer that can prove it. A higher layer proves only that the parts connect (one case, not every variant).
- **Responsive behaviour is tested** (what is present, stacked or scrolled on a phone). **Styling is not tested** (classes, pixels, colours, radius, alignment, spacing).
- **e2e:** one spec for each feature, with the headline journey. No API-only checks. No repeat for each language.
- **On demand:** all other detail tests. Write them when the user asks, or when a bug comes back.

Decided on 2026-11-02, after the inventory in `.context/research/2026-11-test-inventory.md`. This policy is for new work. The old tests are pruned in a separate slice (`.context/backlog/deferred-ideas.md`, I-10).

## 1. The test types

| Type | Where | What it can prove | Cost |
|---|---|---|---|
| Unit | `backend/tests/unit/`, `*.test.ts` next to the code | One pure function gives the right result. No network, no database. | Very low |
| Backend integration | `backend/tests/*.test.js` | A route works with the real database: result, permission, validation, stored data. Import `require('./request')`, never `supertest`. | Low |
| Frontend flow | `*.test.tsx` of a page, with MSW | A user journey on one page works against a mocked API. | Medium |
| Component | `*.test.tsx` of one component | One component reacts to its props and events. | Medium |
| e2e | `e2e/tests/*.spec.ts` | The real backend, Postgres and a browser work together. | High (slow, can be flaky) |

A higher type costs more to run and to keep. Use the lowest type that can prove the rule.

## 2. Tests to write by default

For each feature, write these:

1. **Backend integration**, for each new or changed route:
   - the normal path;
   - permissions (the owner, another user, a demo user, an admin, no token);
   - validation errors;
   - data integrity (what is stored, what is not stored).
2. **Unit tests**, only for pure logic with real branches. Examples: the exercise engine, the forgetting curve, lexicon selectors, yup schemas, transforms.
3. **Frontend flow**, for each user journey on a page. Test what the user sees and does. Test what is sent to the API.
4. **A component test** only when the page test cannot reach the behaviour. Example: a keyboard rule inside a combobox.
5. **Responsive structure.** When the page changes between phone and desktop, test the structure: what is present, what is stacked, what scrolls. Do not test the classes that cause it.
6. **Form-engine config tests.** They stay a default (`.context/roadmap.md` §6): the field list of a form must equal its spec.
7. **One e2e spec** for each feature. It walks the headline journey (for example: sign up, add a word, find it again). The per-phase gate stays: `npm run test:e2e` must be green.

## 3. Tests to write only on request

Do not write these by default. Write them when the user asks, or for a regression (see §5).

- Pixel sizes, CSS classes, colours, border radius, alignment, spacing and fonts. Example of what to avoid: "renders at 36px with the Ladu radius".
- Geometry checks in e2e (bounding boxes, "lines up with the logo").
- A repeat for each language or variant after the first one. The first one proves the path. Language data is proved by the unit tests of the lexicon selectors.
- Edge cases that a lower layer already proves.
- An e2e test of a backend rule through the API (for example, "another user gets 404"). The backend integration test owns it.
- A test of text content that the user can change (copy, translation strings), except the rule that all languages have the same files.
- Snapshots of data shapes.

## 4. Who owns which rule

| Rule | Owner layer | Higher layers prove only |
|---|---|---|
| "der See" gives its main sense | Unit (lexicon selector) | Nothing. The route test has one case. |
| A user cannot read the word of another user | Backend integration | Nothing. |
| A filter is kept in the URL and sent to the API | Frontend flow | Nothing. |
| Form fields of Spanish verbs | Form-engine config test | Nothing. |
| A new user adds a word and finds it again | e2e | (This is the e2e test.) |
| The type-ahead fills a form from the lexicon | Backend integration (route) + frontend flow (fill) | One e2e case for the whole feature, in one language. |

When you are not sure, ask: "What breaks first if this rule is wrong?" Test at that layer.

## 5. Exception: regression

When a bug is fixed, add one test at the layer where the bug appeared. This can be a layout test. Name the bug in the test title, so that a later reader knows why the test exists.

## 6. Checklist for each slice

Answer these four questions before you add a test:

1. Does this test prove something the user or the API client can see? If not, it is a detail test (§3). Skip it.
2. Does a lower layer already prove this rule? If yes, do not repeat it.
3. Is this the first language or variant? If not, skip it.
4. Will this test break when only the design changes? If yes, do not write it.

Then write the plan's "Verification" section from the tests you kept, not from the tests you could write.
