# Request access (plan, 2026-10-19)

**Status:** done 2026-10-19 (four slices), merged in PR #95. Open items closed 2026-11-02 (confirmed by the user). The live spec is `.context/features/access-control.md`, section 6.

**Decisions kept:** R1 to R8 in the spec (the `/request` page and its buttons; the "I have an account" checkbox sets the kind; the captcha action `access_request`, refusing when Cloudflare is down; one team email per new request; Approve and Remove buttons; the invite email unchanged; a new "Send email" button on the allowed accounts).

**Plan versus built:**
- The plan added `DELETE /api/admin/access/requests/:id` (remove without approving), which the original request did not ask for.
- Decisions D1 to D3 of the plan (the recommended option each) were confirmed on 2026-10-19; D4 to D6 followed the request.

**Traps:**
- The route answers 202 in every silent-skip case, so it never confirms that an email has an account or is listed. Do not add a distinct error.
- Approval works when the gate is `closed`; it takes effect when the gate becomes `limited`.
- The gate spec runs alone (global state).

**Old text:** `git log -- .context/plans/access-requests.md`
