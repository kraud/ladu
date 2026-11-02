# Features

One live spec for each finished feature area. Code, tests and other documents cite these files. A spec changes together with the code it describes.

## What belongs here

- The lasting rules of a feature that is built: invariants, API and schema contracts, numbered decisions (with the reason and the rejected option), known defects, open items.
- Not here: unfinished work (`../plans/`), the history of a finished plan (`../archive/`, 30 lines), procedures (`../guides/`), look and feel (`../design/`), long evidence (`../research/`).

## Rules for a new feature document

1. **Start with a summary.** Right after the title, add the section `## Summary`: 2 to 4 sentences that say what the feature does for the user, who uses it, and where it is in the app. A reader who knows nothing about the feature must understand it from this section alone. Write in STE100: short sentences, active voice, no jargon.
2. **Then the header line:** which plan it replaces (with the archive record), when it was built, and the e2e spec that gates it.
3. **Then the code map:** the folders and files that hold the feature.
4. **Then the body**, in this order: decisions (ID, decision, rejected option), invariants, data and API contracts, behaviour the code does not show at a glance, known defects and traps, open items. Leave a section out when it is empty. Do not add narration of how it was built.
5. **Keep the decision IDs stable.** Code comments cite them (for example `D36`, `G-f`). When a decision is replaced, keep its row and mark its status.
6. **Close open items in the file.** When an item is done, write "Closed <date> (confirmed by <who>): ...". Do not delete the line silently.
7. **Name the file for the feature, not for the plan or the phase.**
8. A new feature file also needs a row in the table of `../README.md`, with its authority.
