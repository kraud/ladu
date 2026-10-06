# Licence study: can Ladu go online, and what changes with a paid tier?

Written 2026-10-06 (slice 1 of `.context/plans/landing-terms-licences-blog.md`). This is research. It is not legal advice. One lawyer check is still advised (see section 7).

## 1. Answer

**Yes, Ladu can be published online now as a free service.** No package in the production dependency tree needs us to open our code (no GPL, AGPL or LGPL in npm).

Five items need action **before the public launch** (section 6, list A). None blocks the launch for long. Three more matter **before a paid tier** (list C).

## 2. Method

- Listed the production dependencies of `backend` (106 packages), `frontend` (94) and `admin` (57) with `npm ls --omit=dev --all`. Read the `license` field of each installed package.
- `e2e` has no production dependencies. Dev-only tools (about 1,450 lockfile entries in total) were counted separately in the plan. They are not shipped to users.
- Read the licence file of each language package, and the Debian copyright files for the word lists inside `is-word`.
- Read the terms of Sentry, UptimeRobot and Resend, and Google's API user-data policy.
- The first scan of the whole lockfile was in the plan, section 3.3.

## 3. Result: npm production tree

| Workspace | Packages | Licences |
|---|---|---|
| backend | 106 | MIT 80, Apache-2.0 19, ISC 3, BSD-3 2, BSD-2 1, MIT-0 1 (`nodemailer`) |
| frontend | 94 | MIT 88, Apache-2.0 2, Unlicense 1 (`isbot`), 0BSD 1, BSD-2 1, MIT-or-CC0 1 (`type-fest`) |
| admin | 57 | MIT 55, Apache-2.0 1, Unlicense 1 |

Three entries showed "UNKNOWN": our own `frontend` and `admin` workspaces (no `license` field), and two nested packages (`@base-ui/utils`, `@floating-ui/react-dom`). I opened the nested ones: both are **MIT**.

Dev-only, not shipped: `lightningcss*` (MPL-2.0, 12 entries) and `caniuse-lite` (CC-BY-4.0). MPL-2.0 covers only changes to its own files. It does not affect the CSS it produces.

## 4. Findings by item

Risk: **Low** = keep a notice or credit. **Medium** = act before launch.

| # | Item | What I found | Risk | Action |
|---|---|---|---|---|
| 1 | **`is-word` word lists** (en, es, de) | The npm code is ISC. The lists match Debian's `wamerican` (102,305 lines), `wspanish` (86,016) and `wngerman` (356,008) in size and format. This is a strong match, not a proof. Licences: `ngerman` is **GPL v2 or v3** (igerman98). The English list is SCOWL: permissive, but the copyright notice must be shown, and the UKACD part wants it "prominently". The Spanish list is public domain. | **Medium** | The GPL list is data read by our program, not linked into it. Using it on our server is fine. **Giving the file to others counts as distribution.** Our backend image holds the list. If the GHCR images are public, that is distribution. See list A, item 2. Best fix: replace `is-word` with the planned lexicon. |
| 2 | **German dictionary data** (`german-verbs-dict`, `german-words-dict`) | The npm packages say Apache-2.0. The data is LanguageTool `german-pos-dict`, **CC BY-SA 4.0**. This licence allows commercial use. | Low | Credit it. Decision taken: option C (separate table, `source` and `licence` columns, no data download). |
| 3 | **Estonian data, `api.sonapi.ee`** | A third-party, community service (not run by EKI). EKI data is **CC BY 4.0** (commercial use allowed with credit). I found no terms for the service itself. | Low (licence), **Medium** (reliability) | Credit "Sõnaveeb / EKI". Move to the official Ekilex API with a free key. Read its terms first. |
| 4 | **`spanish-verbs`** | Apache-2.0. A fork of HealthTap's `conjugator`. The `LICENSE` file carries both copyrights (HealthTap 2017, Ludan Stoecklé 2019). Upstream is also Apache-2.0. The README is CC-BY-4.0 (docs only). | Low | Keep both notices in the notices file. |
| 5 | **RosaeNLG packages** (`english-verbs-*`, `german-*`, `rosaenlg-gender-es`) | Apache-2.0 and MIT. | Low | Notices. I did not check the origin of the English irregular-verb data. Read `node_modules/english-verbs-irregular/README.md` when writing the credits. |
| 6 | **`colors`** | MIT, version 1.4.0 (locked). It is used in `backend/api/index.js` and `backend/scripts/migrate.js`. `package.json` says `^1.4.0`, which allows later versions. Later versions were published with sabotage in 2022. | Low | Pin to exactly `1.4.0`, or remove it. |
| 7 | **Our own licence** | **Correction 2026-10-06: the repo `kraud/ladu` is public** (this study first assumed private). Root and `backend` said `MIT`. There was no `LICENSE` file. `frontend`, `admin`, `e2e` had no field. | Low | **Decided: keep MIT. Done:** `LICENSE` file added, `"license": "MIT"` added to `frontend`, `admin`, `e2e`. Consequence for a paid tier: anyone may copy the code, including a competitor. Our edge is hosting, brand and data, not the code. |
| 8 | **Phosphor icons** | `@phosphor-icons/react` is MIT (© 2020 Phosphor Icons). I compared the landing moon icon with the package: **the path is identical**. | Low | Add the Phosphor notice. Check the sun and check-mark icons the same way when writing the credits. |
| 9 | **Flags** (`landing/flags/`, `frontend/public/`) | The files are copies of each other. The repo does not say where they came from. The colour values (`#0052B4`, `#D80027`) look like a common stock set, but I could not prove the source. | **Medium** | Find the source. If it needs attribution, give it. If unknown, replace them with an MIT or public-domain set. |
| 10 | **Own assets** | Brand SVGs are ours. Fonts are system fonts, so there is no font licence. | None | None. |
| 11 | **Terraform** | Used in `deploy/terraform` (`>= 1.9.0`). Since version 1.6 it is under BUSL 1.1. Using it for our own infrastructure is allowed. The limit is on products that compete with HashiCorp. | Low | None. OpenTofu (MPL-2.0) is the open alternative. |
| 12 | **Ansible, Caddy, Postgres, Trivy, Playwright** | GPL-3 (Ansible), Apache-2.0, PostgreSQL licence. Tools and runtimes only. | None | None. |

## 5. Outside services

| Service | What the terms say (read 2026-10-06) | Risk | Action |
|---|---|---|---|
| **Sentry** | "Unless Customer and Sentry have entered into a DPA, Customer will not submit any Personal Data to the Service." The free plan has no warranty and can end at any time. Use is for "internal business purposes". Our SDK setup does not set `sendDefaultPii` (default: off). Error events can still hold page URLs. | **Medium** | Sign the Sentry DPA in the account settings. Check the DSN host: an EU project (`de.sentry.io`) keeps data in the EU. Mention the region in the privacy policy. |
| **UptimeRobot** | "UptimeRobot is available for any use, including commercial and business use." Free plan: 10 monitors. This corrects my earlier doubt in the plan. | Low | None. Re-read before a paid tier. |
| **Resend** | Free tier has limits (about 100 emails per day and 3,000 per month, per their docs). Terms do not ban commercial use. A separate Acceptable Use Policy applies. I did not read that policy. | Low | Read `resend.com/legal/acceptable-use`. Plan the paid plan when the user count grows. |
| **Google Sign-In** | Standard sign-in (email and profile) needs a published privacy policy and an accurate description of data use. No ads and no data resale. No commercial ban. | Low | Put the privacy URL in the OAuth client. We have the page. |
| **Cloudflare, GHCR, VPS host, GitHub** | **Not checked in this slice.** | Unknown | Read their free-tier and acceptable-use terms before launch. |

Not a licence matter, but linked: these services (Google, Sentry, Cloudflare, Resend) may process data outside the EU. The privacy policy should say so and name the legal basis (for example standard contractual clauses). Add this to the privacy-page review in slice 2.

## 6. Actions

**A. Before the public launch**

1. Sign the **Sentry DPA** (finding in section 5).
2. **GHCR visibility.** Checked 2026-10-06: all four images were public. The backend image holds the GPL German word list. **Decided: `ladu-backend` and `ladu-admin` go private.** Repo side is done (Ansible login task, docs). Left for the user: create the token, add it to the vault, run Ansible, switch the two packages to private (order in `06-secrets-and-access.md`). The word files are not in git (they live in `node_modules`).
3. Add the **credits page** and a generated **third-party notices file** (slices 2 and 3). It must list: LanguageTool data (CC BY-SA 4.0), EKI (CC BY 4.0), SCOWL / Debian lists, `igerman98` (GPL), RosaeNLG, HealthTap `conjugator`, Phosphor, and the npm packages.
4. Find the **flag source**, or replace the flags.
5. ~~Set `UNLICENSED`~~ **Done as MIT** (finding 7): `LICENSE` file and `license` fields.
6. **Scan the git history for secrets.** The repo is public (308 commits), so this is urgent. Checked so far: the vault password file is not tracked, `vault.yml` is encrypted, and no `.env`, key or Terraform state file is tracked. The history itself is **not** scanned. Use `gitleaks` (for example `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo`). If it finds a live secret, rotate it. Do not rely on deleting it from history.

**B. Soon after**

6. Pin or remove `colors`.
7. Move Estonian lookups to the official Ekilex API (read its terms first).
8. Read the Resend AUP and the Cloudflare, GHCR and VPS terms.
9. Replace `is-word` with the lexicon planned in `autocomplete-data-source-strategy.md`. This removes the GPL list.

**C. Before a paid tier**

10. Re-check the CC BY-SA position (section 7).
11. Move Sentry, Resend and any other free plan to a paid plan if its terms or limits need it.
12. Update the Terms and the privacy policy (price, renewals, payment provider, consumer withdrawal right in the EU). Register the business (Germany).

## 7. Questions for a lawyer

1. Does serving a few German word forms through our API count as sharing "adapted material" under CC BY-SA 4.0? (Our view: low risk.)
2. Is the "under 13, and under 16 with a parent's permission" wording enough for users in DE, ES and EE?
3. Is an Impressum required for a free, non-commercial service run by a private person in Germany?
4. Liability and governing-law wording of the Terms.

## 8. Re-running this study

The licence data changes with each dependency update. To repeat the check:

1. For each workspace run `npm ls --workspace <name> --omit=dev --all --json`.
2. Read the `license` field of each package in `node_modules`.
3. Compare the result with the table in section 3. A GPL, AGPL, LGPL, "UNKNOWN" or "SEE LICENSE" entry needs a review.

A CI job for this is a good later slice.

## Sources

- [LanguageTool `german-pos-dict`, CC BY-SA 4.0](https://npmjs.com/package/german-words-dict)
- [igerman98 / wngerman copyright (Debian), GPL v2 or v3](https://metadata.ftp-master.debian.org/changelogs/main/i/igerman98/stable_wngerman.copyright)
- [SCOWL / wamerican copyright (Debian)](https://metadata.ftp-master.debian.org/changelogs/main/s/scowl/stable_copyright)
- [wspanish copyright (Debian)](https://metadata.ftp-master.debian.org/changelogs/main/w/wspanish/stable_copyright)
- [Ekilex licence, CC BY 4.0](https://sonaveeb.ee/about)
- [Sentry terms](https://sentry.io/legal/terms/)
- [UptimeRobot terms](https://uptimerobot.com/terms/)
- [Resend terms](https://resend.com/legal/terms-of-service)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
