# Archive

Records of finished work. A record is short. The full text of a removed plan is in git.

- **Read a removed file:** run `git log -- <old path>`, then `git show <commit>:<old path>`.
- **File name:** `YYYY-MM-<topic>.md`. `YYYY-MM` is the month of the last commit of the feature.
- **Length:** 30 lines or fewer.
- **Fields, in this order:**
  1. Status (done, with the date).
  2. PRs and commits.
  3. Decisions kept: the ID and the constraint it imposes today.
  4. Differences between the plan and what was built.
  5. Known traps.
  6. The line `git log -- <old path>`.
- **Before you write a record,** fold the durable content into the live spec it constrains: invariants, schema and API contracts, numbered decisions (rationale and rejected option), known defects, open items.
- **Do not archive** a plan that has an open item without the owner's decision.
- Write in STE100: short sentences, active voice.
