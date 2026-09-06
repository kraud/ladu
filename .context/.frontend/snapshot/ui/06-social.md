# UI Spec 06 — Account, Notifications, Tag view, modals

*Grounded in `snapshot/pages-social-account.md`. NOTE: this file describes the REDESIGNED flows (§8.1/§8.2/§8.3 intentional deltas) — decline actions exist, notifications are a display-only inbox, tag shares have explicit state.*

---

## Account (`/user`)

Profile hub: profile editing + tags + friends.

```
┌───────────────────────────────────────────────────┐
│ ┌─ Profile card ────────────────────────────────┐ │
│ │ (avatar)  Name [____]   Username [____]       │ │
│ │           Email (read-only)                   │ │
│ │ Languages: [DnD two-container list]           │ │
│ │   [🇩🇪 German] ⇅   [🇬🇧 English] ⇅   …         │ │
│ │   native-language pin on one item             │ │
│ │ UI language: [EN ▾]                           │ │
│ │           [Edit profile] → [Save] [Cancel]    │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ My tags ────────────┐ ┌─ Followed tags ──────┐ │
│ │ [chip] [chip] [chip] │ │ [chip] [chip]        │ │
│ │ [+ Create tag]       │ │                      │ │
│ └──────────────────────┘ └──────────────────────┘ │
│ ┌─ Friends ─────────────────────────────────────┐ │
│ │ [avatar] username →     (row list)            │ │
│ │ [+ Add friends]                               │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

- **Profile card** (`UserBadge`): avatar; name/username as text, switching to inputs in Edit mode (min 3 chars each; Save disabled otherwise); email read-only. **Languages**: two-container DnD list (selected ⇄ other; min-2 invariant with error toast; click +/− as fallback; native-language pin button on the selected list). **UI language**: dropdown (EN/ES/DE/EE) — persists immediately.
- Save → success/error toast; Cancel → revert local edits.
- **Tags**: own tags as chips (`label (n words)` — word count from `words.length`); clicking a chip opens **TagInfoModal** for it. Followed tags in a second chip row. Empty → "No tags yet" + "Create your first tag" CTA.
- **Friends**: rows (avatar-initials + username → opens **FriendSearchModal** on that user). Empty → "No friends yet" + "Search and add friends" CTA.
- **Buttons**: "Create tag" → TagInfoModal in create mode; "Add friends" → FriendSearchModal in search mode.

## Notification inbox (`/user/:userId/notifications`)

Display-only list of `friendRequest` and `shareTagRequest` items. Polling is visibility-aware (pause when tab hidden); badge in header counts non-dismissed.

```
┌───────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────┐ │
│ │ (avatar) <username> sent you a friend request │ │
│ │          [Accept ✓] [Decline ✗] [Dismiss 🔕]   │ │
│ ├───────────────────────────────────────────────┤ │
│ │ (avatar) <username> shared tag "<label>"      │ │
│ │          [Accept ✓] [Decline ✗] [Dismiss 🔕]   │ │
│ └───────────────────────────────────────────────┘ │
│ (empty: "No notifications")                       │
└───────────────────────────────────────────────────┘
```

- **Row**: sender avatar (initials), one-line description (variant-specific: friend request / tag share with label), three icon actions with tooltips.
- **Accept friend request** → accepts the friendship (new model: one endpoint, server-side notification handling) → row removed; friend list + badge refresh.
- **Accept tag share** → server-side clone (translations **and cases** preserved) → row removed; success toast with the new tag's label.
- **Decline** (new capability) → marks the share/request declined; row removed; no data cloned.
- **Dismiss** (snooze) → toggles `dismissed` (keeps the row but grays it and excludes from badge); dismissed rows can be re-activated from the same list.
- Icons per variant: friendRequest → person-add / x / bell-off; shareTagRequest → bookmark-add / x / bookmark-remove.

## Tag view (`/tag/:tagId`)

Full-page tag viewer.

```
┌───────────────────────────────────────────────────┐
│ [◀ Return]        <label>            (visibility) │
│ <description>                                     │
│ [Clone tag + words]  [Follow / Unfollow]          │  ← non-author, public only
│ ┌─ Words in tag ────────────────────────────────┐ │
│ │ (word table or chip list; read-only)          │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

- **Return** → history-back + clears loaded tag.
- **Non-author + Public**: two actions — **Clone tag and words** (server-side transactional clone incl. translations+cases → success toast with the new label) and **Follow/Unfollow** (toggle button; label + state from the follow query; confirms via AlertDialog for unfollow).
- **Words**: read-only listing of the tag's words (reuse the Review table read-only mode or a simple list — implementer's choice; data = tag's `words[]`).
- Loading: full-page loader only on first load (suppress during clone/follow actions).

## TagInfoModal (Dialog — create/edit/review a tag)

- **Create** (opened empty): label (unique — server availability check), description, visibility radio (Private/Public/Friends-Only). "Create tag" disabled until form valid; Cancel closes.
- **Edit** (author): same form + "Save changes" + "Delete tag" (AlertDialog) + "Delete all words" (AlertDialog; disabled when tag has no words).
- **Review** (author, read-only): shows details + words count; actions: **Send to friend** (→ switches to FriendSearchModal share mode), Edit, Delete all words, Close.
- **Review** (non-author): Follow/Unfollow (AlertDialog confirm) + Close.
- One dialog component, mode-driven; distinct mutation states per op (create/update/delete) — never one shared response slot.

## FriendSearchModal (Dialog — two modes)

- **Friend mode** (search/manage):
  - Search input (debounced 400 ms) over users → results list (icon by type, second line: username + friendship-state icon).
  - Select → **profile view**: avatar, name/username, their public tags as chips (click → close modal, navigate `/tag/:id`).
  - **Friendship action button** — 4 states: Add friend (no relation) / Accept (they requested) / Cancel request (I requested) / Remove friend (accepted). Add/Accept act immediately; Cancel/Remove require AlertDialog confirm.
  - Back to search / Close.
- **Share mode** (opened with a tag to share): multi-select recipients (search + remaining-friends list; already-selected as removable chips; users with a pending share for that tag excluded) + **Send tag** (disabled when selection empty) → success toast; modal closes.
