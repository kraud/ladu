const { and, asc, count, desc, eq, gt, ilike, inArray, lt, ne, not, or, sql }: typeof import("drizzle-orm") =
  require("drizzle-orm");
const { db }: typeof import("../src/db") = require("../src/db");
const {
  friendships,
  notifications,
  tagShares,
  tags,
  tagWords,
  translationCases,
  translations,
  users,
  userFollowingTags,
  words,
}: typeof import("../src/db/schema") = require("../src/db/schema");

const asyncHandler = require("express-async-handler");

// Generic keyset-pagination helpers live in wordService.ts, not
// wordController.ts — wordController.ts already requires *this* file (for
// `getWordsIdFromFollowedTagsByUserId`), so requiring wordController.ts back
// from here would be a circular require (and, in practice, would hand this
// file wordController's still-empty `module.exports` from mid-load).
const {
  fetchWordsWithRelations,
  parseLimitParam,
  encodeCursor,
  decodeCursor,
}: typeof import("../services/wordService") = require("../services/wordService");
import type { WordResponse } from "../services/wordService";

type TagRow = typeof tags.$inferSelect;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

/**
 * The tag response shape for every new list/get/mutate endpoint
 * (phase-4-tags.md's `TagSummary`). Counts and relations are always
 * computed via SQL, never by loading the tag's actual word list — that's
 * the whole point of the rebuild (see the plan's "Why" section).
 */
interface TagSummary {
  id: string;
  label: string;
  description: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; username: string };
  wordCount: number;
  followerCount: number;
  isOwner: boolean;
  isFollowing: boolean;
  isAvailable: boolean;
  sourceTag: { id: string; label: string } | null;
}

/**
 * The legacy-minus-`_id` shape still used by `acceptTagShare`'s response
 * (accept-a-share stays dormant until Phase 7 builds its frontend, and
 * doesn't ask the recipient to choose anything the way `cloneTag`'s
 * Discover-driven clone does, so its response shape wasn't worth touching
 * in this slice). Not `TagSummary` — just the raw tag row plus its `words`
 * (still resolved via `fetchWordsWithRelations`).
 */
const normalizeTag = (tag: TagRow & { words?: WordResponse[] }) => ({
  ...tag,
  words: tag.words || [],
});

/**
 * Determine whether `viewerId` may see a tag: the author, anyone for Public
 * tags, and friends of the author for Friends-Only tags. Used to gate
 * *new* standing on a tag (following it, cloning it) — `buildTagSummaries`
 * below has its own, wider notion of "can see this tag's card at all" that
 * also accounts for already-following it (D9's "unavailable" state).
 */
const canViewTag = async (tag: TagRow, viewerId: string): Promise<boolean> => {
  if (tag.authorId === viewerId || tag.visibility === "Public") return true;
  if (tag.visibility !== "Friends-Only") return false;

  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(
            eq(friendships.requesterId, viewerId),
            eq(friendships.addresseeId, tag.authorId),
          ),
          and(
            eq(friendships.requesterId, tag.authorId),
            eq(friendships.addresseeId, viewerId),
          ),
        ),
      ),
    )
    .limit(1);

  return friendship !== undefined;
};

const getFollowedTagIdsByUserId = async (userId: string) => {
  // Followed tags are tracked in a junction table, so we fetch the ids directly.
  const rows = await db
    .select({ tagId: userFollowingTags.tagId })
    .from(userFollowingTags)
    .where(eq(userFollowingTags.followerUserId, userId));

  return rows.map((row) => row.tagId);
};

/**
 * Word ids reachable through a tag `userId` follows AND can currently view —
 * `canViewTag`-equivalent visibility, evaluated fresh on every call rather
 * than trusting the `user_following_tags` row alone. This is what makes D9
 * (phase-4-tags.md) work: the moment an owner flips a followed tag to
 * Private, its words stop matching here immediately, with no separate
 * "unfollow" step — the follow row itself is untouched.
 *
 * (`userId` never needs the "or I'm the author" branch `canViewTag` has —
 * a user's own words already come from the separate "own words" condition
 * everywhere this is called, e.g. `getWordsSimplified`.)
 */
const getWordsIdFromFollowedTagsByUserId = async (userId: string) => {
  const rows = await db
    .select({ wordId: tagWords.wordId })
    .from(userFollowingTags)
    .innerJoin(tags, eq(userFollowingTags.tagId, tags.id))
    .innerJoin(tagWords, eq(tagWords.tagId, tags.id))
    .leftJoin(
      friendships,
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, tags.authorId)),
          and(eq(friendships.requesterId, tags.authorId), eq(friendships.addresseeId, userId)),
        ),
      ),
    )
    .where(
      and(
        eq(userFollowingTags.followerUserId, userId),
        or(
          eq(tags.visibility, "Public"),
          and(eq(tags.visibility, "Friends-Only"), sql`${friendships.id} IS NOT NULL`),
        ),
      ),
    );

  return [...new Set(rows.map((row) => row.wordId))];
};

const getTagsIdFromFollowedTagsByUserId = getFollowedTagIdsByUserId;

/**
 * Every user id `viewerId` has an accepted friendship with. Bounded by one
 * small query per request (filtered to rows involving the viewer), unlike
 * the legacy `searchTags`/`getOtherUserTags` this replaces, which each
 * loaded every accepted friendship row in the whole database.
 */
const getFriendUserIds = async (viewerId: string): Promise<Set<string>> => {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, viewerId)),
      ),
    );
  return new Set(
    rows.map((row) => (row.requesterId === viewerId ? row.addresseeId : row.requesterId)),
  );
};

/**
 * Whether `viewerId` can currently see `tag`'s *content* (its words) —
 * `isAvailable` on a `TagSummary`. Always true for the owner; for anyone
 * else it tracks the tag's current visibility exactly, with no memory of
 * having followed it before — that's what makes a followed tag flip to
 * "unavailable" the instant its owner sets it Private (D9), and back the
 * instant they undo that.
 */
const computeIsAvailable = (
  tag: { authorId: string; visibility: string },
  viewerId: string,
  friendIds: Set<string>,
): boolean => {
  if (tag.authorId === viewerId) return true;
  if (tag.visibility === "Public") return true;
  if (tag.visibility === "Friends-Only") return friendIds.has(tag.authorId);
  return false;
};

/**
 * Build `TagSummary` objects for a batch of tag rows, in the same order,
 * for `viewerId`. Author and source-tag lookups and the word/follower
 * counts are each one batched query (Map-joined in application code,
 * mirroring wordService.ts's own `fetchTranslationsMap`/`fetchTagsMap`
 * pattern) rather than N+1 queries per tag, and never load the tags' actual
 * word lists — that per-tag cost is exactly what made the legacy tag list
 * endpoints slow (phase-4-tags.md's "Why" section).
 */
const buildTagSummaries = async (
  tagRows: TagRow[],
  viewerId: string,
): Promise<TagSummary[]> => {
  if (tagRows.length === 0) return [];

  const tagIds = tagRows.map((tag) => tag.id);
  const authorIds = [...new Set(tagRows.map((tag) => tag.authorId))];
  const sourceTagIds = [
    ...new Set(
      tagRows
        .map((tag) => tag.sourceTagId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const [authorRows, sourceTagRows, wordCountRows, followerCountRows, followingRows, friendIds] =
    await Promise.all([
      db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, authorIds)),
      sourceTagIds.length > 0
        ? db.select({ id: tags.id, label: tags.label }).from(tags).where(inArray(tags.id, sourceTagIds))
        : Promise.resolve([] as Array<{ id: string; label: string }>),
      db
        .select({ tagId: tagWords.tagId, value: sql<number>`count(*)::int` })
        .from(tagWords)
        .where(inArray(tagWords.tagId, tagIds))
        .groupBy(tagWords.tagId),
      db
        .select({ tagId: userFollowingTags.tagId, value: sql<number>`count(*)::int` })
        .from(userFollowingTags)
        .where(inArray(userFollowingTags.tagId, tagIds))
        .groupBy(userFollowingTags.tagId),
      db
        .select({ tagId: userFollowingTags.tagId })
        .from(userFollowingTags)
        .where(
          and(inArray(userFollowingTags.tagId, tagIds), eq(userFollowingTags.followerUserId, viewerId)),
        ),
      getFriendUserIds(viewerId),
    ]);

  const authorById = new Map(authorRows.map((user) => [user.id, user]));
  const sourceTagById = new Map(sourceTagRows.map((tag) => [tag.id, tag]));
  const wordCountByTagId = new Map(wordCountRows.map((row) => [row.tagId, row.value]));
  const followerCountByTagId = new Map(followerCountRows.map((row) => [row.tagId, row.value]));
  const followedTagIdSet = new Set(followingRows.map((row) => row.tagId));

  return tagRows.map((tag) => {
    const author = authorById.get(tag.authorId);
    const sourceTag = tag.sourceTagId ? sourceTagById.get(tag.sourceTagId) : undefined;
    return {
      id: tag.id,
      label: tag.label,
      description: tag.description,
      visibility: tag.visibility,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      // Falls back to a blank username rather than throwing — only reachable
      // if the author row vanished between the two queries (deleted account).
      author: { id: tag.authorId, username: author?.username ?? "" },
      wordCount: wordCountByTagId.get(tag.id) ?? 0,
      followerCount: followerCountByTagId.get(tag.id) ?? 0,
      isOwner: tag.authorId === viewerId,
      isFollowing: followedTagIdSet.has(tag.id),
      isAvailable: computeIsAvailable(tag, viewerId, friendIds),
      sourceTag: sourceTag ? { id: sourceTag.id, label: sourceTag.label } : null,
    };
  });
};

const buildTagSummary = async (tagRow: TagRow, viewerId: string): Promise<TagSummary> => {
  const [summary] = await buildTagSummaries([tagRow], viewerId);
  return summary;
};

// @desc    List tags in a scope, optionally searched, sorted, and
//          keyset-paginated (phase-4-tags.md D2/D16 — replaces
//          getTags/searchTags/getOtherUserTags/getFollowedTagsIdByUserId/
//          filterTags, all of which either loaded every matching tag's full
//          word list or leaked another user's followed-tag list with no
//          authorization check at all).
// @route   GET /api/tags?scope=all|owned|followed|discover&q=&sort=recent|label&cursor=&limit=
// @access  Private
const listTags = asyncHandler(async (req: any, res: any) => {
  const viewerId = req.user.id;
  const scope = ["owned", "followed", "discover"].includes(req.query.scope)
    ? req.query.scope
    : "all";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sortBy = req.query.sort === "label" ? "label" : "recent";

  const followedTagIds = await getFollowedTagIdsByUserId(viewerId);

  let scopeCondition;
  if (scope === "owned") {
    scopeCondition = eq(tags.authorId, viewerId);
  } else if (scope === "followed") {
    // Every followed tag, regardless of its CURRENT visibility — an
    // "unavailable" (owner-turned-Private) tag still belongs in this list
    // (D9); only its word-reachability is gated elsewhere.
    scopeCondition = followedTagIds.length > 0 ? inArray(tags.id, followedTagIds) : sql`false`;
  } else if (scope === "discover") {
    const friendIds = await getFriendUserIds(viewerId);
    const visibilityCondition =
      friendIds.size > 0
        ? or(
            eq(tags.visibility, "Public"),
            and(eq(tags.visibility, "Friends-Only"), inArray(tags.authorId, [...friendIds])),
          )
        : eq(tags.visibility, "Public");
    scopeCondition = and(
      visibilityCondition,
      ne(tags.authorId, viewerId),
      followedTagIds.length > 0 ? not(inArray(tags.id, followedTagIds)) : sql`true`,
    );
  } else {
    // 'all' = owned + followed, regardless of current visibility — same
    // reasoning as 'followed' above.
    scopeCondition = or(
      eq(tags.authorId, viewerId),
      followedTagIds.length > 0 ? inArray(tags.id, followedTagIds) : sql`false`,
    );
  }

  const conditions = [scopeCondition];
  if (q) {
    conditions.push(or(ilike(tags.label, `%${q}%`), ilike(tags.description, `%${q}%`)));
  }

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(tags)
    .where(and(...conditions));

  if (req.query.cursor !== undefined) {
    const cursor = decodeCursor(req.query.cursor);
    if (!cursor) {
      res.status(400);
      throw new Error("Invalid cursor");
    }
    if (sortBy === "label") {
      conditions.push(
        or(
          gt(tags.label, cursor.sortValue),
          and(eq(tags.label, cursor.sortValue), gt(tags.id, cursor.id)),
        ),
      );
    } else {
      const cursorCreatedAt = new Date(cursor.sortValue);
      if (Number.isNaN(cursorCreatedAt.getTime())) {
        res.status(400);
        throw new Error("Invalid cursor");
      }
      conditions.push(
        or(
          lt(tags.createdAt, cursorCreatedAt),
          and(eq(tags.createdAt, cursorCreatedAt), lt(tags.id, cursor.id)),
        ),
      );
    }
  }

  const limit = parseLimitParam(req.query.limit);

  const pageRows =
    sortBy === "label"
      ? await db.select().from(tags).where(and(...conditions)).orderBy(asc(tags.label), asc(tags.id)).limit(limit + 1)
      : await db.select().from(tags).where(and(...conditions)).orderBy(desc(tags.createdAt), desc(tags.id)).limit(limit + 1);

  const hasMore = pageRows.length > limit;
  const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
  const nextCursor = hasMore
    ? encodeCursor(
        sortBy === "label" ? rows[rows.length - 1].label : rows[rows.length - 1].createdAt.toISOString(),
        rows[rows.length - 1].id,
      )
    : null;

  const items = await buildTagSummaries(rows, viewerId);
  res.status(200).json({ items, nextCursor, total });
});

// @desc    Get one tag's summary.
// @route   GET /api/tags/:id
// @access  Private
const getTagById = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!tag) {
    res.status(404);
    throw new Error("Tag not found");
  }

  const summary = await buildTagSummary(tag, req.user.id);
  // A stranger with no standing at all (doesn't own it, doesn't follow it,
  // and it isn't currently viewable) gets the same 404 as a truly
  // nonexistent id, so the response never confirms a Private tag's
  // existence to someone who can't see it. Following a now-Private tag IS
  // standing, though — that's what lets the "unavailable" state render
  // instead of 404ing a tag the caller already had access to (D9).
  if (!summary.isFollowing && !summary.isAvailable) {
    res.status(404);
    throw new Error("Tag not found");
  }

  res.status(200).json(summary);
});

/**
 * Shared ownership guard for the link/unlink endpoints: the caller must own
 * every tag id AND every word id, or the whole call is refused — no
 * partial-apply (phase-4-tags.md Risks).
 */
const assertOwnsTagsAndWords = async (
  req: any,
  res: any,
  tagIds: string[],
  wordIds: string[],
) => {
  const ownedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.authorId, req.user.id), inArray(tags.id, tagIds)));
  if (ownedTags.length !== new Set(tagIds).size) {
    res.status(403);
    throw new Error("User not authorized to apply one or more of these tags");
  }

  const ownedWords = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.userId, req.user.id), inArray(words.id, wordIds)));
  if (ownedWords.length !== new Set(wordIds).size) {
    res.status(403);
    throw new Error("User not authorized to modify one or more of these words");
  }
};

// @desc    Attach tags to words (bulk). Caller must own every tag and every
//          word. Adding a link that already exists is a no-op.
// @route   POST /api/tags/links
// @access  Private
const linkTagsToWords = asyncHandler(async (req: any, res: any) => {
  const tagIds: string[] = Array.isArray(req.body.tagIds) ? req.body.tagIds : [];
  const wordIds: string[] = Array.isArray(req.body.wordIds) ? req.body.wordIds : [];

  await assertOwnsTagsAndWords(req, res, tagIds, wordIds);

  const pairs = tagIds.flatMap((tagId) => wordIds.map((wordId) => ({ tagId, wordId })));
  if (pairs.length > 0) {
    await db.insert(tagWords).values(pairs).onConflictDoNothing();
  }

  res.status(200).json({ tagIds, wordIds });
});

// @desc    Detach tags from words (bulk). Caller must own every tag and
//          every word. Removing a link that doesn't exist is a no-op.
// @route   POST /api/tags/links/remove
// @access  Private
const unlinkTagsFromWords = asyncHandler(async (req: any, res: any) => {
  const tagIds: string[] = Array.isArray(req.body.tagIds) ? req.body.tagIds : [];
  const wordIds: string[] = Array.isArray(req.body.wordIds) ? req.body.wordIds : [];

  await assertOwnsTagsAndWords(req, res, tagIds, wordIds);

  if (tagIds.length > 0 && wordIds.length > 0) {
    await db
      .delete(tagWords)
      .where(and(inArray(tagWords.tagId, tagIds), inArray(tagWords.wordId, wordIds)));
  }

  res.status(200).json({ tagIds, wordIds });
});

// @desc    Follow a tag. Idempotent — following an already-followed tag is
//          a no-op, not an error.
// @route   POST /api/tags/:id/follow
// @access  Private
const followTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!tag) {
    res.status(404);
    throw new Error("Tag not found");
  }
  if (tag.authorId === req.user.id) {
    res.status(400);
    throw new Error("You already own this tag");
  }
  if (!(await canViewTag(tag, req.user.id))) {
    res.status(403);
    throw new Error("User not authorized to follow this tag");
  }

  await db
    .insert(userFollowingTags)
    .values({ tagId: tag.id, followerUserId: req.user.id })
    .onConflictDoNothing();

  res.status(200).json(await buildTagSummary(tag, req.user.id));
});

// @desc    Unfollow a tag. Idempotent — unfollowing a tag not currently
//          followed is a no-op, not an error.
// @route   DELETE /api/tags/:id/follow
// @access  Private
const unfollowTag = asyncHandler(async (req: any, res: any) => {
  await db
    .delete(userFollowingTags)
    .where(
      and(
        eq(userFollowingTags.tagId, req.params.id),
        eq(userFollowingTags.followerUserId, req.user.id),
      ),
    );

  const [tag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!tag) {
    res.status(404);
    throw new Error("Tag not found");
  }

  res.status(200).json(await buildTagSummary(tag, req.user.id));
});

/**
 * Append a numeric suffix until `label` is unique for `authorId`
 * (phase-4-tags.md D13/D11 — a clone whose label collides with one the
 * recipient already has gets "Label (2)", "Label (3)", ...).
 */
const resolveUniqueLabel = async (label: string, authorId: string): Promise<string> => {
  if (!(await labelAlreadyUsedByAuthor(label, authorId))) return label;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop -- each check depends on the last suffix tried
  while (await labelAlreadyUsedByAuthor(`${label} (${suffix})`, authorId)) {
    suffix += 1;
  }
  return `${label} (${suffix})`;
};

/**
 * Clone a tag and its words (with translations + cases) for a recipient,
 * inside the caller's own transaction (`tx`) — the caller opens and commits
 * it, so a share-accept and a direct clone can each wrap this in their own
 * single transaction instead of this function nesting a second one
 * (phase-4-tags.md's "Why" section — the old nested-transaction bug this
 * fixes).
 *
 * Batch-inserts words/translations/cases (three `INSERT ... RETURNING`
 * calls total, not one per word) rather than the old per-word loop —
 * `RETURNING` preserves the input array's order, the same guarantee
 * `setWord` already relies on for its own translation batch insert.
 *
 * Sets `sourceTagId`/`sourceWordId` (D11) for display/auditing, resolves a
 * unique label for the recipient, and — if the recipient already follows
 * the source tag — removes that follow (D11: otherwise the same words would
 * appear twice, original and clone, in their Review).
 */
const cloneTagForUser = async (
  tx: any,
  sourceTag: TagRow,
  recipientId: string,
  visibility: string,
): Promise<TagRow> => {
  const wordIdRows = await db
    .select({ wordId: tagWords.wordId })
    .from(tagWords)
    .where(eq(tagWords.tagId, sourceTag.id));
  const wordIds = wordIdRows.map((row) => row.wordId);

  // Only `.translations`/`.cases` off each source word are read below — the
  // viewer id just has to be someone who can see the source tag's own tags
  // on these words, so the tag's own author is the natural, always-correct
  // choice regardless of who triggered the clone (D5-adjacent — cloning
  // itself is not gated on viewing the words' *other* tags).
  const sourceWords = await fetchWordsWithRelations(wordIds, sourceTag.authorId);
  const label = await resolveUniqueLabel(sourceTag.label, recipientId);

  const [clonedTag] = await tx
    .insert(tags)
    .values({
      authorId: recipientId,
      label,
      description: sourceTag.description,
      visibility,
      sourceTagId: sourceTag.id,
    })
    .returning();

  const clonedWordRows =
    sourceWords.length > 0
      ? await tx
          .insert(words)
          .values(
            sourceWords.map((sourceWord) => ({
              userId: recipientId,
              partOfSpeech: sourceWord.partOfSpeech,
              clue: sourceWord.clue,
              isCloned: true,
              originalCreatorId: sourceWord.user,
              sourceWordId: sourceWord.id,
            })),
          )
          .returning()
      : [];

  // Flattened one-row-per-translation inserts, tagged with the cloned word
  // (by index — `sourceWords[i]` <-> `clonedWordRows[i]`) they belong to.
  const translationInserts = sourceWords.flatMap((sourceWord, i) =>
    sourceWord.translations.map((translation) => ({
      wordId: clonedWordRows[i].id,
      language: translation.language,
    })),
  );
  const clonedTranslationRows =
    translationInserts.length > 0
      ? await tx.insert(translations).values(translationInserts).returning()
      : [];

  // Same flattening for cases, one level deeper: rebuild the parallel
  // flattened *source* translation list so `flattenedSourceTranslations[j]`
  // <-> `clonedTranslationRows[j]` for every source translation regardless
  // of which word it came from.
  const flattenedSourceTranslations = sourceWords.flatMap((sourceWord) => sourceWord.translations);
  const caseInserts = flattenedSourceTranslations.flatMap((translation, j) =>
    translation.cases.map((c) => ({
      translationId: clonedTranslationRows[j].id,
      caseName: c.caseName,
      word: c.word,
    })),
  );
  if (caseInserts.length > 0) {
    await tx.insert(translationCases).values(caseInserts);
  }

  if (clonedWordRows.length > 0) {
    await tx
      .insert(tagWords)
      .values(clonedWordRows.map((clonedWord: { id: string }) => ({ tagId: clonedTag.id, wordId: clonedWord.id })));
  }

  // D11: cloning a tag you follow removes the follow, so the words don't
  // appear twice (the original, read-only, and now the independent clone).
  await tx
    .delete(userFollowingTags)
    .where(and(eq(userFollowingTags.tagId, sourceTag.id), eq(userFollowingTags.followerUserId, recipientId)));

  return clonedTag;
};

// @desc    Clone a Public tag (and its words) for the current user, with a
//          visibility the caller chooses (phase-4-tags.md D11).
// @route   POST /api/tags/:id/clone
// @access  Private
const cloneTag = asyncHandler(async (req: any, res: any) => {
  const [sourceTag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!sourceTag) {
    res.status(404);
    throw new Error("Tag not found");
  }
  if (sourceTag.authorId === req.user.id) {
    res.status(400);
    throw new Error("You already own this tag");
  }
  // Direct (self-service, Discover) cloning is only allowed for Public
  // tags — a Friends-Only tag reaches a non-friend only via an explicit
  // share (shareTag/acceptTagShare), never this endpoint.
  if (sourceTag.visibility !== "Public") {
    res.status(403);
    throw new Error("User not authorized to clone this tag");
  }
  if (!["Public", "Private", "Friends-Only"].includes(req.body.visibility)) {
    res.status(400);
    throw new Error("Invalid visibility status");
  }

  const clonedTag = await db.transaction((tx: any) =>
    cloneTagForUser(tx, sourceTag, req.user.id, req.body.visibility),
  );
  res.status(200).json(await buildTagSummary(clonedTag, req.user.id));
});

// @desc    Share a tag with another user (creates the notification in-transaction)
// @route   POST /api/tags/:id/share
// @access  Private
const shareTag = asyncHandler(async (req: any, res: any) => {
  const tagId = req.params.id;
  const recipientId: unknown = req.body.recipientId;

  if (!isUuid(recipientId)) {
    res.status(400);
    throw new Error("Please specify a valid recipientId.");
  }
  if (recipientId === req.user.id) {
    res.status(400);
    throw new Error("You cannot share a tag with yourself.");
  }

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);
  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }
  if (tag.authorId !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized to share this tag");
  }

  const [recipient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  if (!recipient) {
    res.status(400);
    throw new Error("Recipient not found");
  }

  // One outstanding share per (tag, recipient) — enforced by a partial unique
  // index; the duplicate check here yields a friendly 400 instead of a 23505.
  const [existing] = await db
    .select({ id: tagShares.id })
    .from(tagShares)
    .where(
      and(
        eq(tagShares.tagId, tagId),
        eq(tagShares.recipientId, recipientId),
        eq(tagShares.status, "pending"),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(400);
    throw new Error("This tag has already been shared with this user.");
  }

  const [created] = await db.transaction(async (tx) => {
    const [share] = await tx
      .insert(tagShares)
      .values({
        tagId,
        senderId: req.user.id,
        recipientId,
        status: "pending",
      })
      .returning();

    await tx.insert(notifications).values({
      userId: recipientId,
      variant: "shareTagRequest",
      dismissed: false,
      content: { tagId, requesterId: req.user.id },
    });

    return [share];
  });

  res.status(200).json(created);
});

// @desc    Accept a pending tag share (recipient only); clones tag + words.
// @route   POST /api/tag-shares/:id/accept
// @access  Private
const acceptTagShare = asyncHandler(async (req: any, res: any) => {
  const [share] = await db
    .select()
    .from(tagShares)
    .where(eq(tagShares.id, req.params.id))
    .limit(1);
  if (!share) {
    res.status(400);
    throw new Error("Tag share not found");
  }
  if (share.status !== "pending") {
    res.status(400);
    throw new Error("Only a pending tag share can be accepted.");
  }
  if (share.recipientId !== req.user.id) {
    res.status(401);
    throw new Error("Not allowed to accept: user is not the recipient of this share");
  }

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, share.tagId))
    .limit(1);
  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }

  const result = await db.transaction(async (tx: any) => {
    // Accept-share doesn't ask the recipient to choose a visibility (that
    // choice is Slice 7's clone-dialog UI, not accept) — keep the existing
    // behavior of copying the source tag's own visibility.
    const clonedTag = await cloneTagForUser(tx, tag, req.user.id, tag.visibility);

    const [updated] = await tx
      .update(tagShares)
      .set({ status: "accepted" })
      .where(eq(tagShares.id, req.params.id))
      .returning();

    // Remove the corresponding shareTagRequest notification.
    await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, req.user.id),
          eq(notifications.variant, "shareTagRequest"),
          sql`${notifications.content}->>'tagId' = ${share.tagId}`,
          sql`${notifications.content}->>'requesterId' = ${share.senderId}`,
        ),
      );

    return { share: updated, clonedTag };
  });

  res.status(200).json({
    tagShare: result.share,
    clonedTag: normalizeTag(result.clonedTag),
  });
});

// @desc    Decline a pending tag share (recipient only).
// @route   POST /api/tag-shares/:id/decline
// @access  Private
const declineTagShare = asyncHandler(async (req: any, res: any) => {
  const [share] = await db
    .select()
    .from(tagShares)
    .where(eq(tagShares.id, req.params.id))
    .limit(1);
  if (!share) {
    res.status(400);
    throw new Error("Tag share not found");
  }
  if (share.status !== "pending") {
    res.status(400);
    throw new Error("Only a pending tag share can be declined.");
  }
  if (share.recipientId !== req.user.id) {
    res.status(401);
    throw new Error("Not allowed to decline: user is not the recipient of this share");
  }

  const [updated] = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(tagShares)
      .set({ status: "declined" })
      .where(eq(tagShares.id, req.params.id))
      .returning();

    await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, req.user.id),
          eq(notifications.variant, "shareTagRequest"),
          sql`${notifications.content}->>'tagId' = ${share.tagId}`,
          sql`${notifications.content}->>'requesterId' = ${share.senderId}`,
        ),
      );

    return [result];
  });

  res.status(200).json(updated);
});

/**
 * `err.code === '23505'` is Postgres' unique-violation code — the backstop
 * against a racing double-submit slipping past the pre-check below (D13's
 * own comment on the migration's unique index flags this exact window).
 * Anything else is rethrown for the normal error-handling middleware.
 */
const rethrowAsLabelConflict = (res: any, err: any): never => {
  if (err?.code === "23505") {
    res.status(409);
    throw new Error("You already have a tag with this label.");
  }
  throw err;
};

const labelAlreadyUsedByAuthor = async (
  label: string,
  authorId: string,
  excludeTagId?: string,
): Promise<boolean> => {
  const conditions = [eq(tags.authorId, authorId), sql`lower(${tags.label}) = lower(${label})`];
  if (excludeTagId) conditions.push(ne(tags.id, excludeTagId));
  const [existing] = await db.select({ id: tags.id }).from(tags).where(and(...conditions)).limit(1);
  return existing !== undefined;
};

// @desc    Create a tag, optionally attaching it to some of the caller's
//          own words up front (phase-4-tags.md D4-adjacent).
// @route   POST /api/tags
// @access  Private
const createTag = asyncHandler(async (req: any, res: any) => {
  const label: string = typeof req.body.label === "string" ? req.body.label.trim() : "";
  if (!label) {
    res.status(400);
    throw new Error("Please specify label for tag");
  }
  if (!["Public", "Private", "Friends-Only"].includes(req.body.visibility)) {
    res.status(400);
    throw new Error("Invalid visibility status");
  }
  // Pre-check (D13): a friendly 409 in the common case; the transaction
  // below still guards the race via the DB's own unique index.
  if (await labelAlreadyUsedByAuthor(label, req.user.id)) {
    res.status(409);
    throw new Error("You already have a tag with this label.");
  }

  const rawWordIds: string[] = Array.isArray(req.body.wordIds) ? req.body.wordIds : [];
  const wordIds: string[] = [...new Set(rawWordIds)];
  if (wordIds.length > 0) {
    const ownedWords = await db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.userId, req.user.id), inArray(words.id, wordIds)));
    if (ownedWords.length !== wordIds.length) {
      res.status(403);
      throw new Error("User not authorized to add one or more of these words");
    }
  }

  try {
    const newTag: TagRow = await db.transaction(async (tx: any) => {
      const [created] = await tx
        .insert(tags)
        .values({
          authorId: req.user.id,
          label,
          visibility: req.body.visibility,
          description: req.body.description ?? null,
        })
        .returning();

      if (wordIds.length > 0) {
        await tx.insert(tagWords).values(wordIds.map((wordId) => ({ tagId: created.id, wordId })));
      }

      return created;
    });
    res.status(200).json(await buildTagSummary(newTag, req.user.id));
  } catch (err: any) {
    rethrowAsLabelConflict(res, err);
  }
});

// @desc    Update a tag's metadata (label/description/visibility). Word
//          membership is not touched here — that's `POST /api/tags/links`
//          and `/links/remove` (D5).
// @route   PATCH /api/tags/:id
// @access  Private
const updateTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!tag) {
    res.status(404);
    throw new Error("Tag not found");
  }
  if (tag.authorId !== req.user.id) {
    res.status(403);
    throw new Error("User not authorized");
  }

  const updateFields: Record<string, any> = {};

  if (req.body.label !== undefined) {
    const label = typeof req.body.label === "string" ? req.body.label.trim() : "";
    if (!label) {
      res.status(400);
      throw new Error("Please specify label for tag");
    }
    if (await labelAlreadyUsedByAuthor(label, req.user.id, req.params.id)) {
      res.status(409);
      throw new Error("You already have a tag with this label.");
    }
    updateFields.label = label;
  }
  if (req.body.description !== undefined) updateFields.description = req.body.description;
  if (req.body.visibility !== undefined) {
    if (!["Public", "Private", "Friends-Only"].includes(req.body.visibility)) {
      res.status(400);
      throw new Error("Invalid visibility status");
    }
    updateFields.visibility = req.body.visibility;
  }

  let updatedTag: TagRow = tag;
  if (Object.keys(updateFields).length > 0) {
    try {
      [updatedTag] = await db.update(tags).set(updateFields).where(eq(tags.id, req.params.id)).returning();
    } catch (err: any) {
      rethrowAsLabelConflict(res, err);
    }
  }

  res.status(200).json(await buildTagSummary(updatedTag, req.user.id));
});

// @desc    Delete a tag (D12 — the tag only; `tag_words`/
//          `user_following_tags` cascade via FK, the words themselves are
//          never touched).
// @route   DELETE /api/tags/:id
// @access  Private
const deleteTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db.select().from(tags).where(eq(tags.id, req.params.id)).limit(1);
  if (!tag) {
    res.status(404);
    throw new Error("Tag not found");
  }
  if (tag.authorId !== req.user.id) {
    res.status(403);
    throw new Error("User not authorized to delete this tag");
  }

  await db.delete(tags).where(eq(tags.id, req.params.id));
  res.status(200).json({ id: tag.id });
});

module.exports = {
  listTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  followTag,
  unfollowTag,
  linkTagsToWords,
  unlinkTagsFromWords,
  cloneTag,
  shareTag,
  acceptTagShare,
  declineTagShare,
  getWordsIdFromFollowedTagsByUserId,
};
