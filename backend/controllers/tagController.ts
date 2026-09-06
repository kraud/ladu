const crypto = require("crypto");
const { and, eq, ilike, inArray, or, sql } = require("drizzle-orm");
const { db } = require("../src/db");
const {
  friendships,
  tags,
  tagWords,
  users,
  userFollowingTags,
  words,
} = require("../src/db/schema");

const asyncHandler = require("express-async-handler");

const { fetchWordsWithRelations, getWordsByIds } = require("../services/wordService");
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
    if (query.public !== undefined) {
      filters.push(eq(tags.public, query.public));
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
        user1Id: friendships.user1Id,
        user2Id: friendships.user2Id,
      })
      .from(friendships)
      .where(eq(friendships.status, "accepted"));

    const friendUserIds = friendRows
      .filter(
        (friendship) =>
          friendship.user1Id === req.user.id ||
          friendship.user2Id === req.user.id,
      )
      .map((friendship) =>
        friendship.user1Id === req.user.id
          ? friendship.user2Id
          : friendship.user1Id,
      );

    const allowedRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        or(
          authorIsCurrentUser,
          eq(tags.public, "Public"),
          and(
            eq(tags.public, "Friends-Only"),
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
      user1Id: friendships.user1Id,
      user2Id: friendships.user2Id,
    })
    .from(friendships)
    .where(eq(friendships.status, "accepted"));

  const usersAreFriends = friendRows.some(
    (friendship) =>
      (friendship.user1Id === userId && friendship.user2Id === currentUserId) ||
      (friendship.user2Id === userId && friendship.user1Id === currentUserId),
  );

  const whereClause = usersAreFriends
    ? and(
        eq(tags.authorId, userId),
        inArray(tags.public, ["Public", "Friends-Only"]),
      )
    : and(eq(tags.authorId, userId), eq(tags.public, "Public"));

  const tagsData = await db.select().from(tags).where(whereClause);
  res.status(200).json(tagsData.map(normalizeTag));
});

const getTagById = asyncHandler(async (req: any, res: any) => {
  const tagData = await getTagDataByRequest({ query: { id: req.params.id } });
  res.status(200).json(tagData[0]);
});

const addTagsInBulkToWords = asyncHandler(async (req: any, res: any) => {
  const tagIds: string[] = req.body.newTagsToApply || [];
  const wordsIds: string[] = req.body.selectedWords || [];

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
  if (!req.body.userId) {
    res.status(401);
    throw new Error("User not found");
  }
  if (!req.body.tagId) {
    res.status(401);
    throw new Error("Tag not found");
  }

  const [userFollowTag] = await db
    .insert(userFollowingTags)
    .values({
      tagId: req.body.tagId,
      followerUserId: req.body.userId,
    })
    .returning();

  res.status(200).json(userFollowTag);
});

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

  const tagWordRows = await db
    .select({ wordId: tagWords.wordId })
    .from(tagWords)
    .where(eq(tagWords.tagId, tagId));
  const wordIdList = tagWordRows.map((row) => row.wordId);
  const originalWords = await getWordsByIds(wordIdList);

  const [tagCloneData] = await db
    .insert(tags)
    .values({
      authorId: req.user.id,
      label: tagData.label,
      description: tagData.description,
      public: tagData.public,
    })
    .returning();

  const clonedWordRows = await Promise.all(
    originalWords.map(async (originalWordItem) => {
      const [newWord] = await db
        .insert(words)
        .values({
          userId: req.user.id,
          partOfSpeech: originalWordItem.partOfSpeech,
          clue: originalWordItem.clue,
          isCloned: true,
          originalCreatorId: originalWordItem.id,
        })
        .returning();
      return newWord;
    }),
  );

  const newTagWordList = clonedWordRows.map((clonedWordItem) => ({
    tagId: tagCloneData.id,
    wordId: clonedWordItem.id,
  }));

  const tagWordResponse =
    newTagWordList.length > 0
      ? await db.insert(tagWords).values(newTagWordList).returning()
      : [];

  res.status(200).json({
    clonedTag: normalizeTag(tagCloneData),
    clonedWords: clonedWordRows,
    clonedTagWords: tagWordResponse,
  });
});

const checkIfTagLabelAvailable = asyncHandler(async (req: any, res: any) => {
  const { tagLabel, userId } = req.body;
  const [existingTag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.label, tagLabel), eq(tags.authorId, userId)))
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
  if (!req.body.author) {
    res.status(400);
    throw new Error("Missing tag author");
  }
  if (!["Public", "Private", "Friends-Only"].includes(req.body.public)) {
    res.status(400);
    throw new Error("Invalid public status");
  }

  const [value] = await db
    .insert(tags)
    .values({
      authorId: req.body.author,
      label: req.body.label,
      public: req.body.public,
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
  const userId = req.body.userId;

  if (!tagId) {
    res.status(400);
    throw new Error("Missing tag id");
  }
  if (!userId) {
    res.status(401);
    throw new Error("Missing user id");
  }

  const [userFollowingTag] = await db
    .select()
    .from(userFollowingTags)
    .where(
      and(
        eq(userFollowingTags.tagId, tagId),
        eq(userFollowingTags.followerUserId, userId),
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
        eq(userFollowingTags.followerUserId, userId),
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
  if (req.body.author !== undefined) tagUpdateFields.authorId = req.body.author;
  if (req.body.label !== undefined) tagUpdateFields.label = req.body.label;
  if (req.body.public !== undefined) tagUpdateFields.public = req.body.public;
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
  checkIfTagLabelAvailable,
  addTagsInBulkToWords,
  followTag,
  getTagsFollowedByUser,
  deleteUserFollowingTag,
  getWordsIdFromFollowedTagsByUserId,
  getTagsIdFromFollowedTagsByUserId,
};
