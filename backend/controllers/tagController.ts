const { and, eq, ilike, inArray, or, sql } = require("drizzle-orm");
const { db } = require("../src/db");
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
} = require("../src/db/schema");

const asyncHandler = require("express-async-handler");

const { fetchWordsWithRelations } = require("../services/wordService");
import type { WordResponse } from "../services/wordService";

type TagRow = typeof tags.$inferSelect;

const queryParamToBool = (value: unknown) =>
  (value + "").toLowerCase() === "true";

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const normalizeTag = (tag: TagRow & { words?: WordResponse[] }) => ({
  ...tag,
  _id: tag.id,
  author: tag.authorId,
  words: tag.words || [],
});

/**
 * Determine whether `viewerId` may see a tag: the author, anyone for Public
 * tags, and friends of the author for Friends-Only tags.
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

const getWordsIdFromFollowedTagsByUserId = async (userId: string) => {
  const followedTagIds = await getFollowedTagIdsByUserId(userId);
  if (followedTagIds.length === 0) return [];

  // Resolve all word ids that belong to the followed tags.
  const rows = await db
    .select({ wordId: tagWords.wordId })
    .from(tagWords)
    .where(inArray(tagWords.tagId, followedTagIds));

  return rows.map((row) => row.wordId);
};

const getTagsIdFromFollowedTagsByUserId = getFollowedTagIdsByUserId;

const getTagWordsByTagIds = async (tagIds: string[]) => {
  if (tagIds.length === 0) return [];

  return db
    .select({
      tagId: tagWords.tagId,
      wordId: tagWords.wordId,
    })
    .from(tagWords)
    .where(inArray(tagWords.tagId, tagIds));
};

const getTagsByIdsWithWords = async (tagIds: string[]) => {
  if (tagIds.length === 0) return [];

  const tagRows = await db.select().from(tags).where(inArray(tags.id, tagIds));
  const tagWordRows = await getTagWordsByTagIds(tagIds);
  const wordIds = [...new Set(tagWordRows.map((row) => row.wordId))];
  // fetchWordsWithRelations includes translations + cases + tags
  // (the full legacy Word shape that the front-end expects).
  const wordRows = await fetchWordsWithRelations(wordIds);
  const wordMap = new Map(wordRows.map((word) => [word.id, word]));

  return tagRows.map((tagRow) => ({
    ...normalizeTag(tagRow),
    words: tagWordRows
      .filter((row) => row.tagId === tagRow.id)
      .map((row) => wordMap.get(row.wordId))
      .filter(Boolean),
  }));
};

const getTagDataByRequest = async (req: any, tagForceRequest?: any) => {
  // Preserve the legacy helper shape: either a direct forced filter or query-derived filter.
  const query = req?.query || {};
  const filters: any[] = tagForceRequest || [];

  if (!tagForceRequest) {
    if (query.id !== undefined) {
      if (!isUuid(query.id))
        throw new Error("Tag auxiliary function getTagDataByRequest failed");
      filters.push(eq(tags.id, query.id));
    }
    if (query.author !== undefined) {
      if (!isUuid(query.author))
        throw new Error("Tag auxiliary function getTagDataByRequest failed");
      filters.push(eq(tags.authorId, query.author));
    }
    if (query.label !== undefined) {
      filters.push(ilike(tags.label, `%${query.label}%`));
    }
    if (query.description !== undefined) {
      filters.push(ilike(tags.description, `%${query.description}%`));
    }
    if (query.visibility !== undefined) {
      filters.push(eq(tags.visibility, query.visibility));
    }
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const tagRows = await db.select().from(tags).where(whereClause);
  const tagIds = tagRows.map((tagRow) => tagRow.id);
  const tagWordRows = await getTagWordsByTagIds(tagIds);
  const wordIds = [...new Set(tagWordRows.map((row) => row.wordId))];
  // fetchWordsWithRelations returns WordResponse objects (includes
  // translations + cases), replacing the old getWordsByIds which only
  // returned bare word rows without those nested fields.
  const wordRows = await fetchWordsWithRelations(wordIds);
  const wordMap = new Map(wordRows.map((word) => [word.id, word]));

  return tagRows.map((tagRow) => ({
    ...normalizeTag(tagRow),
    words: tagWordRows
      .filter((row) => row.tagId === tagRow.id)
      .map((row) => wordMap.get(row.wordId))
      .filter(Boolean),
  }));
};

const searchTags = asyncHandler(async (req: any, res: any) => {
  const includeOtherUserTags = queryParamToBool(
    req.query.includeOtherUsersTags,
  );
  const includeFollowedTags = queryParamToBool(req.query.includeFollowedTags);
  const matchingTagsId = await getTagsIdFromFollowedTagsByUserId(req.user.id);

  const tagFilter = req.query.query
    ? ilike(tags.label, `%${req.query.query}%`)
    : undefined;
  const authorIsCurrentUser = eq(tags.authorId, req.user.id);

  let allowedTagIds: string[] | null = null;
  if (includeOtherUserTags) {
    const friendRows = await db
      .select({
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
      })
      .from(friendships)
      .where(eq(friendships.status, "accepted"));

    const friendUserIds = friendRows
      .filter(
        (friendship) =>
          friendship.requesterId === req.user.id ||
          friendship.addresseeId === req.user.id,
      )
      .map((friendship) =>
        friendship.requesterId === req.user.id
          ? friendship.addresseeId
          : friendship.requesterId,
      );

    const allowedRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        or(
          authorIsCurrentUser,
          eq(tags.visibility, "Public"),
          and(
            eq(tags.visibility, "Friends-Only"),
            inArray(tags.authorId, friendUserIds),
          ),
          matchingTagsId.length > 0
            ? inArray(tags.id, matchingTagsId)
            : sql`false`,
        ),
      );

    allowedTagIds = allowedRows.map((row) => row.id);
  } else {
    const allowedRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        or(
          authorIsCurrentUser,
          includeFollowedTags && matchingTagsId.length > 0
            ? inArray(tags.id, matchingTagsId)
            : sql`false`,
        ),
      );
    allowedTagIds = allowedRows.map((row) => row.id);
  }

  const tagRows = await getTagsByIdsWithWords(allowedTagIds || []);
  const searchResultTags = tagRows
    .filter(
      (tagRow) =>
        !tagFilter ||
        String(tagRow.label)
          .toLowerCase()
          .includes(String(req.query.query).toLowerCase()),
    )
    .map((tagData) => ({
      id: tagData._id,
      label: tagData.label,
      type: "tag",
      completeTagInfo: tagData,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  res.status(200).json(searchResultTags);
});

const getUserTags = asyncHandler(async (req: any, res: any) => {
  const tagsData = await getTagDataByRequest({
    query: { author: req.user.id },
  });
  res.status(200).json(tagsData);
});

const getTagsFollowedByUser = asyncHandler(async (req: any, res: any) => {
  if (!req.query.userId) {
    res.status(401);
    throw new Error("User-query not found");
  }

  const matchingTagsId = await getTagsIdFromFollowedTagsByUserId(
    req.query.userId,
  );
  const matchingTagsFullData = await getTagsByIdsWithWords(matchingTagsId);
  res.status(200).json(matchingTagsFullData);
});

const getOtherUserTags = asyncHandler(async (req: any, res: any) => {
  const userId = req.query.userId;
  const currentUserId = req.user.id;

  const friendRows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
    })
    .from(friendships)
    .where(eq(friendships.status, "accepted"));

  const usersAreFriends = friendRows.some(
    (friendship) =>
      (friendship.requesterId === userId &&
        friendship.addresseeId === currentUserId) ||
      (friendship.addresseeId === userId &&
        friendship.requesterId === currentUserId),
  );

  const whereClause = usersAreFriends
    ? and(
        eq(tags.authorId, userId),
        inArray(tags.visibility, ["Public", "Friends-Only"]),
      )
    : and(eq(tags.authorId, userId), eq(tags.visibility, "Public"));

  const tagsData = await db.select().from(tags).where(whereClause);
  res.status(200).json(tagsData.map(normalizeTag));
});

const getTagById = asyncHandler(async (req: any, res: any) => {
  const tagData = await getTagDataByRequest({ query: { id: req.params.id } });
  const tag = tagData[0];
  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }

  if (!(await canViewTag(tag, req.user.id))) {
    res.status(401);
    throw new Error("User not authorized to view this tag");
  }

  res.status(200).json(tag);
});

const addTagsInBulkToWords = asyncHandler(async (req: any, res: any) => {
  const tagIds: string[] = req.body.newTagsToApply || [];
  const wordsIds: string[] = req.body.selectedWords || [];

  // Ownership: a user may only associate their own tags with their own words.
  const ownedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.authorId, req.user.id), inArray(tags.id, tagIds)));
  if (ownedTags.length !== tagIds.length) {
    res.status(401);
    throw new Error("User not authorized to apply one or more of these tags");
  }

  const ownedWords = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.userId, req.user.id), inArray(words.id, wordsIds)));
  if (ownedWords.length !== wordsIds.length) {
    res.status(401);
    throw new Error("User not authorized to modify one or more of these words");
  }

  const response = await Promise.all(
    tagIds.map(async (tagIdToAssign) => {
      const existingTagWordRows = await db
        .select({ wordId: tagWords.wordId })
        .from(tagWords)
        .where(eq(tagWords.tagId, tagIdToAssign));

      const allWordIdsRelatedToTag = existingTagWordRows.map(
        (row) => row.wordId,
      );
      const tagWordsToBeCreated = wordsIds
        .filter((wordId) => !allWordIdsRelatedToTag.includes(wordId))
        .map((wordId) => ({ tagId: tagIdToAssign, wordId }));

      if (tagWordsToBeCreated.length === 0) return [];

      return db.insert(tagWords).values(tagWordsToBeCreated).returning();
    }),
  );

  res.status(200).json(response);
});

const followTag = asyncHandler(async (req: any, res: any) => {
  if (!req.body.tagId) {
    res.status(401);
    throw new Error("Tag not found");
  }

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, req.body.tagId))
    .limit(1);
  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }

  if (!(await canViewTag(tag, req.user.id))) {
    res.status(401);
    throw new Error("User not authorized to follow this tag");
  }

  const [userFollowTag] = await db
    .insert(userFollowingTags)
    .values({
      tagId: req.body.tagId,
      followerUserId: req.user.id,
    })
    .returning();

  res.status(200).json(userFollowTag);
});

/**
 * Clone a tag and its words (with translations + cases) for a recipient.
 * Runs as a transaction so a partial clone is impossible.
 */
const cloneTagForUser = async (
  sourceTag: TagRow,
  recipientId: string,
): Promise<TagRow> => {
  const wordIdRows = await db
    .select({ wordId: tagWords.wordId })
    .from(tagWords)
    .where(eq(tagWords.tagId, sourceTag.id));
  const wordIds = wordIdRows.map((row) => row.wordId);

  const sourceWords = await fetchWordsWithRelations(wordIds);

  return db.transaction(async (tx) => {
    const [clonedTag] = await tx
      .insert(tags)
      .values({
        authorId: recipientId,
        label: sourceTag.label,
        description: sourceTag.description,
        visibility: sourceTag.visibility,
      })
      .returning();

    for (const sourceWord of sourceWords) {
      const [clonedWord] = await tx
        .insert(words)
        .values({
          userId: recipientId,
          partOfSpeech: sourceWord.partOfSpeech,
          clue: sourceWord.clue,
          isCloned: true,
          originalCreatorId: sourceWord.user,
        })
        .returning();

      for (const translation of sourceWord.translations) {
        const [clonedTranslation] = await tx
          .insert(translations)
          .values({
            wordId: clonedWord.id,
            language: translation.language,
          })
          .returning();

        if (translation.cases.length > 0) {
          await tx.insert(translationCases).values(
            translation.cases.map((c) => ({
              translationId: clonedTranslation.id,
              caseName: c.caseName,
              word: c.word,
            })),
          );
        }
      }

      await tx.insert(tagWords).values({
        tagId: clonedTag.id,
        wordId: clonedWord.id,
      });
    }

    return clonedTag;
  });
};

// @desc    Clone a Public tag (and its words) for the current user.
// @route   POST /api/tags/addExternalTag
// @access  Private
const addExternalTag = asyncHandler(async (req: any, res: any) => {
  const tagId = req.body.tagId;
  const [tagData] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);
  if (!tagData) {
    res.status(400);
    throw new Error("Tag not found");
  }

  // Direct cloning is only allowed for Public tags (and not one's own tag).
  if (tagData.authorId === req.user.id) {
    res.status(400);
    throw new Error("You already own this tag");
  }
  if (tagData.visibility !== "Public") {
    res.status(401);
    throw new Error("User not authorized to clone this tag");
  }

  const clonedTag = await cloneTagForUser(tagData, req.user.id);
  res.status(200).json(normalizeTag(clonedTag));
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

  const result = await db.transaction(async (tx) => {
    const clonedTag = await cloneTagForUser(tag, req.user.id);

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

const checkIfTagLabelAvailable = asyncHandler(async (req: any, res: any) => {
  const { tagLabel } = req.body;
  const [existingTag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.label, tagLabel), eq(tags.authorId, req.user.id)))
    .limit(1);

  if (existingTag) {
    res.status(200).json({
      isAvailable: false,
      tagId: existingTag.id,
    });
  } else {
    res.status(200).json({ isAvailable: true });
  }
});

const createTag = asyncHandler(async (req: any, res: any) => {
  if (!req.body.label) {
    res.status(400);
    throw new Error("Please specify label for tag");
  }
  if (!["Public", "Private", "Friends-Only"].includes(req.body.visibility)) {
    res.status(400);
    throw new Error("Invalid visibility status");
  }

  const [value] = await db
    .insert(tags)
    .values({
      authorId: req.user.id,
      label: req.body.label,
      visibility: req.body.visibility,
      description: req.body.description ?? null,
    })
    .returning();

  const tagWordsItems = Array.isArray(req.body.words)
    ? req.body.words.map((wordData: any) => ({
        tagId: value.id,
        wordId: wordData._id,
      }))
    : [];

  if (tagWordsItems.length > 0) {
    await db.insert(tagWords).values(tagWordsItems);
  }

  res.status(200).json({
    ...normalizeTag(value),
    words: req.body.words || [],
  });
});

const deleteTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, req.params.id))
    .limit(1);

  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }

  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  if (tag.authorId !== req.user.id) {
    res.status(401);
    throw new Error(
      "User not authorized to delete this tag (does not match author).",
    );
  }

  await db.delete(tagWords).where(eq(tagWords.tagId, req.params.id));
  await db
    .delete(userFollowingTags)
    .where(eq(userFollowingTags.tagId, req.params.id));
  await db.delete(tags).where(eq(tags.id, req.params.id));
  res.status(200).json(normalizeTag(tag));
});

const deleteUserFollowingTag = asyncHandler(async (req: any, res: any) => {
  const tagId = req.params.id;

  if (!tagId) {
    res.status(400);
    throw new Error("Missing tag id");
  }

  const [userFollowingTag] = await db
    .select()
    .from(userFollowingTags)
    .where(
      and(
        eq(userFollowingTags.tagId, tagId),
        eq(userFollowingTags.followerUserId, req.user.id),
      ),
    )
    .limit(1);

  if (!userFollowingTag) {
    res.status(400);
    throw new Error("User-following-tag not found");
  }

  await db
    .delete(userFollowingTags)
    .where(
      and(
        eq(userFollowingTags.tagId, tagId),
        eq(userFollowingTags.followerUserId, req.user.id),
      ),
    );

  res.status(200).json(userFollowingTag);
});

const updateTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, req.params.id))
    .limit(1);

  if (!tag) {
    res.status(400);
    throw new Error("Tag not found");
  }
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }
  if (tag.authorId !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  const updatedWordsList = (req.body.words || []).map(
    (wordFullData: any) => wordFullData._id,
  );
  const existingTagWordRows = await db
    .select({ wordId: tagWords.wordId })
    .from(tagWords)
    .where(eq(tagWords.tagId, req.params.id));
  const existingWords = existingTagWordRows.map((row) => row.wordId);

  const wordsToBeRemoved = existingWords.filter(
    (wordId) => !updatedWordsList.includes(wordId),
  );
  const wordsToBeAdded = updatedWordsList.filter(
    (wordId) => !existingWords.includes(wordId),
  );

  if (wordsToBeRemoved.length > 0) {
    await db
      .delete(tagWords)
      .where(
        and(
          eq(tagWords.tagId, req.params.id),
          inArray(tagWords.wordId, wordsToBeRemoved),
        ),
      );
  }
  if (wordsToBeAdded.length > 0) {
    await db.insert(tagWords).values(
      wordsToBeAdded.map((wordId) => ({
        tagId: req.params.id,
        wordId,
      })),
    );
  }

  const tagUpdateFields: Record<string, any> = {};
  if (req.body.label !== undefined) tagUpdateFields.label = req.body.label;
  if (req.body.visibility !== undefined) tagUpdateFields.visibility = req.body.visibility;
  if (req.body.description !== undefined) tagUpdateFields.description = req.body.description;

  const [updatedTag] = await db
    .update(tags)
    .set(tagUpdateFields)
    .where(eq(tags.id, req.params.id))
    .returning();

  res.status(200).json({
    ...normalizeTag(updatedTag),
    words: req.body.words || [],
  });
});

const getAmountByTag = asyncHandler(async (req: any, res: any) => {
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, req.params.id))
    .limit(1);

  if (!tag) {
    res.status(400);
    throw new Error("Tag ID does not match any existing tag.");
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tagWords)
    .where(eq(tagWords.tagId, req.params.id));

  res.status(200).json(countRows[0]?.count || 0);
});

module.exports = {
  searchTags,
  getUserTags,
  getTagById,
  createTag,
  deleteTag,
  updateTag,
  getAmountByTag,
  getOtherUserTags,
  getTagDataByRequest,
  addExternalTag,
  shareTag,
  acceptTagShare,
  declineTagShare,
  checkIfTagLabelAvailable,
  addTagsInBulkToWords,
  followTag,
  getTagsFollowedByUser,
  deleteUserFollowingTag,
  getWordsIdFromFollowedTagsByUserId,
  getTagsIdFromFollowedTagsByUserId,
};
