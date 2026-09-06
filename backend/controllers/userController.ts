const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { db } = require("../src/db");
const {
  friendships,
  tokens,
  users,
  words,
  translations,
} = require("../src/db/schema");

const {
  and,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
}: typeof import("drizzle-orm") = require("drizzle-orm");
const asyncHandler = require("express-async-handler");
const sendMail = require("../utils/sendEmail");
const { calculateBasicUserMetrics } = require("./metricController");

type UserRow = typeof users.$inferSelect;
type NewUserRow = typeof users.$inferInsert;

const userColumnsWithoutPassword = {
  id: users.id,
  name: users.name,
  email: users.email,
  username: users.username,
  languages: users.languages,
  uiLanguage: users.uiLanguage,
  nativeLanguage: users.nativeLanguage,
  verified: users.verified,
  passwordTokens: users.passwordTokens,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const queryParamToBool = (value: unknown) =>
  (value + "").toLowerCase() === "true";

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const generateToken = (id: string) => {
  // JWTs carry only the stable user id; user profile data is reloaded by auth middleware.
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

const serializeUser = (user: Partial<UserRow>) => ({
  ...user,
  _id: user.id,
});

const serializeLoginUser = (user: UserRow) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  languages: user.languages,
  uiLanguage: user.uiLanguage,
  nativeLanguage:
    user.nativeLanguage === null ? undefined : user.nativeLanguage,
  token: generateToken(user.id),
  verified: user.verified,
});

const findUserById = async (id: string) => {
  // Centralize id lookups so invalid UUID strings become normal "not found" results.
  if (!isUuid(id)) return undefined;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
};

const findUserByEmailInsensitive = async (email: string) => {
  // The legacy Mongo query used case-insensitive matching for email login and duplicates.
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return user;
};

const findUserByUsernameInsensitive = async (username: string) => {
  // Registration rejects usernames regardless of casing, matching the old regex query.
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return user;
};

const publicUserResponse = (user: UserRow) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  languages: user.languages,
  uiLanguage: user.uiLanguage,
  nativeLanguage: user.nativeLanguage,
  verified: user.verified,
});

const registerUser = asyncHandler(async (req: any, res: any) => {
  const { name, email, username, password } = req.body;

  // Validate the required registration fields before any database work.
  if (!name || !email || !username || !password) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // Enforce the app-level case-insensitive uniqueness rules used by the legacy API.
  const emailExists = await findUserByEmailInsensitive(email);
  const usernameExists = await findUserByUsernameInsensitive(username);

  if (emailExists) {
    res.status(400);
    throw new Error("Email already in use");
  }

  if (usernameExists) {
    res.status(400);
    throw new Error("Username already in use");
  }

  // Store only the bcrypt hash; plaintext passwords never leave this request.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create the user with the same defaults the old controller returned to the frontend.
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      username,
      password: hashedPassword,
      languages: [],
      uiLanguage: "English",
      nativeLanguage: null,
      verified: false,
      passwordTokens: [],
    } satisfies NewUserRow)
    .returning();

  // Create a one-time email verification token in the normalized tokens table.
  const [token] = await db
    .insert(tokens)
    .values({
      userId: user.id,
      token: crypto.randomBytes(32).toString("hex"),
    })
    .returning();

  // Send the verification email after both user and token rows exist.
  const url = `${process.env.BASE_URL}/user/${user.id}/verify/${token.token}`;
  await sendMail({
    email: user.email,
    subject: "Verify Email",
    url,
    name: user.name,
    type: "verifyEmail",
  });

  res.status(201).json(publicUserResponse(user));
});

const loginUser = asyncHandler(async (req: any, res: any) => {
  const { email, password } = req.body;

  // Look up by email first so password comparison only runs for a real account.
  const user = email ? await findUserByEmailInsensitive(email) : undefined;

  if (user && (await bcrypt.compare(password || "", user.password))) {
    res.json(serializeLoginUser(user));
  } else {
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

const updateUser = asyncHandler(async (req: any, res: any) => {
  const { email, name, username, languages, uiLanguage, nativeLanguage } =
    req.body;

  // The route is protected, so req.user identifies the account allowed to edit itself.
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  // Keep username unique across users while allowing the current user to keep their own.
  const [usernameExists] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (usernameExists && usernameExists.id !== req.user.id) {
    res.status(400);
    throw new Error("Username already in use!");
  }

  // Preserve the legacy credential check: the submitted email must belong to the logged-in user.
  const userData = await findUserByEmailInsensitive(email);
  if (!userData || userData.id !== req.user.id) {
    res.status(400);
    throw new Error("Invalid credentials");
  }

  // Only update profile fields owned by this endpoint; email and password stay unchanged.
  const [updatedUser] = await db
    .update(users)
    .set({
      name: name ?? userData.name,
      username: username ?? userData.username,
      languages: languages ?? userData.languages,
      uiLanguage: uiLanguage ?? userData.uiLanguage,
      nativeLanguage: nativeLanguage === undefined ? null : nativeLanguage,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userData.id))
    .returning(userColumnsWithoutPassword);

  res.status(200).json(serializeUser(updatedUser));
});

const getMe = asyncHandler(async (req: any, res: any) => {
  // authMiddleware already loaded the current user without the password hash.
  res.status(200).json(req.user);
});

const getUsersBy = asyncHandler(async (req: any, res: any) => {
  // Query strings arrive as strings, so normalize booleans before building SQL filters.
  const requestQuery = {
    ...req.query,
    searchOnlyFriends: queryParamToBool(req.query.searchOnlyFriends),
  };

  if (!req.query) {
    res.status(400);
    throw new Error("Missing search query text");
  }

  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  const searchText = `%${requestQuery.nameOrUsernameMatch || ""}%`;
  let matchingFriendIds: string[] | null = null;

  if (requestQuery.searchOnlyFriends) {
    // Find accepted friendships first, then constrain the user search to the other participants.
    const matchingFriendships = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(
            eq(friendships.user1Id, req.user.id),
            eq(friendships.user2Id, req.user.id),
          ),
        ),
      );

    matchingFriendIds = matchingFriendships.map((friendship: any) =>
      friendship.user1Id === req.user.id
        ? friendship.user2Id
        : friendship.user1Id,
    );

    if (matchingFriendIds.length === 0) {
      return res.status(200).json([]);
    }
  }

  // Search by display name or username, exclude the requester, and optionally restrict to friends.
  const matchingUsersData = await db
    .select(userColumnsWithoutPassword)
    .from(users)
    .where(
      and(
        or(ilike(users.name, searchText), ilike(users.username, searchText)),
        ne(users.id, req.user.id),
        matchingFriendIds ? inArray(users.id, matchingFriendIds) : undefined,
      ),
    );

  const simpleResults = matchingUsersData
    .map((matchingUser: any) => ({
      id: matchingUser.id,
      type: "user",
      label: matchingUser.name,
      username: matchingUser.username,
      email: matchingUser.email,
      languages: matchingUser.languages,
    }))
    .sort((a: any, b: any) => a.label.localeCompare(b.label));

  res.status(200).json(simpleResults);
});

const getUserById = asyncHandler(async (req: any, res: any) => {
  // Private lookup used by the frontend when it already has a user id.
  const user = await findUserById(req.params.id);

  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  if (!req.user) {
    res.status(401);
    throw new Error("Logged in user not found");
  }

  res.status(200).json(serializeUser(user));
});

const verifyUser = asyncHandler(async (req: any, res: any) => {
  try {
    // Validate the URL user id before checking the one-time verification token.
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(400).send({ message: "Invalid Link (no user match)" });
    }

    const [token] = await db
      .select()
      .from(tokens)
      .where(
        and(eq(tokens.userId, user.id), eq(tokens.token, req.params.token)),
      )
      .limit(1);

    if (!token) {
      return res.status(400).send({ message: "Invalid Link (no token match)" });
    }

    // Mark the user as verified, then delete the consumed verification token.
    await db
      .update(users)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await db.delete(tokens).where(eq(tokens.id, token.id));

    // Return profile data plus a JWT so the client can enter authenticated routes immediately.
    const userWithToken = {
      ...serializeUser({ ...user, verified: true }),
      token: generateToken(user.id),
    };
    delete (userWithToken as any).password;

    res
      .status(200)
      .send({ user: userWithToken, message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

const requestPasswordReset = asyncHandler(async (req: any, res: any) => {
  const email = req.body.email;

  // Password reset starts from email because users may not know their id.
  const user = email ? await findUserByEmailInsensitive(email) : undefined;
  if (!user) {
    res.status(400);
    throw new Error("There is no user registered with the email given.");
  }

  // Append a new reset token; multiple outstanding reset links remain valid until a password update.
  const newPasswordToken = crypto.randomBytes(32).toString("hex");
  const passwordTokens = [...(user.passwordTokens || []), newPasswordToken];

  await db
    .update(users)
    .set({ passwordTokens, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  try {
    // Send the reset link only after the token has been persisted.
    const url = `${process.env.BASE_URL}/resetPassword/${user.id}/${newPasswordToken}`;
    await sendMail({
      email: user.email,
      subject: "Password reset link",
      url,
      name: user.name,
      type: "resetPassword",
    });

    res.status(200).json({});
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

const updatePassword = asyncHandler(async (req: any, res: any) => {
  const { userId, password, token } = req.body;

  // Reject malformed UUIDs before they reach PostgreSQL.
  if (!isUuid(userId)) {
    res.status(400);
    throw new Error("Invalid format for UserId");
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(400);
    throw new Error("Invalid Link (no user match).");
  }

  // Only a token stored on the user row can authorize a password change.
  if (
    user.passwordTokens === undefined ||
    !user.passwordTokens.includes(token)
  ) {
    res.status(400);
    throw new Error("Invalid token.");
  }

  // Replace the password hash and clear all reset tokens so links cannot be reused.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await db
    .update(users)
    .set({
      password: hashedPassword,
      passwordTokens: [],
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  res.status(200).json({});
});

const getBasicUserMetrics = asyncHandler(async (req: any, res: any) => {
  try {
    const metrics = await calculateBasicUserMetrics({
      _id: req.user.id,
      languages: req.user.languages,
    });

    res.status(200).json({
      totalWords: metrics?.totalWords || 0,
      incompleteWordsCount: metrics?.incompleteWordsCount || 0,
      translationsPerLanguage: metrics?.translationsPerLanguage || [],
      translationsPerLanguageAndPOS:
        metrics?.translationsPerLanguageAndPOS || [],
      wordsPerPOS: metrics?.wordsPerPOS || [],
      wordsPerMonth: metrics?.wordsPerMonth || [],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

module.exports = {
  registerUser,
  loginUser,
  updateUser,
  getMe,
  getUsersBy,
  getUserById,
  verifyUser,
  requestPasswordReset,
  updatePassword,
  getBasicUserMetrics,
};
