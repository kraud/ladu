# Landing: Terms, licence study, Blog (plan, 2026-10-04)

**Status:** done 2026-10-06 (slices 1 to 5; the plan's status line "no code was written" was stale). The live spec is `.context/features/landing-and-legal.md`; the licence study is `.context/research/licence-study.md`.

**Decisions kept:** Q1 to Q9 of the plan, in the spec. Key constraints: the Privacy Policy is the single source of truth for data facts; a note, not a checkbox, with the Terms version and time recorded by the server (Q2); age 13 plus the under-16 sentence (Q4); CC BY-SA data in separate tables, credited, with no download (Q5); the repo is public under MIT (Q8 revised).

**Plan versus built:**
- Q8 changed on 2026-10-06: the repo was already public, so the planned FSL licence and the "before it goes public" checklist were dropped. The history scan for secrets (licence study action A6) became urgent.
- Slice 1b was added: private GHCR images for the backend and admin (they carry a GPL word list) and a root `LICENSE`.
- The Impressum page and the controller's identity in the Privacy Policy were added (Q9).

**Traps:** a new landing page needs a `COPY` line in `landing/Dockerfile` and the theme script; legal pages are English with `lang="en"` on the article; the blog build runs at image-build time.

**Not done, on purpose:** a full postal address (ignored for now, 2026-11-02); the one-time lawyer check (`research/deferred-ideas.md` I-3).

**Old text:** `git log -- .context/plans/landing-terms-licences-blog.md`
