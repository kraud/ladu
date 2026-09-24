const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { db }: typeof import("../src/db") = require("../src/db");
const {
  friendships,
  passwordResetTokens,
  tokens,
  users,
  words,
  translations,
}: typeof import("../src/db/schema") = require("../src/db/schema");

const {
  and,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
}: typeof import("drizzle-orm") = require("drizzle-orm");
const asyncHandler = require("express-async-handler");
const sendMail = require("../utils/sendEmail");
const { calculateBasicUserMetrics } = require("./metricController");

type UserRow = typeof users.$inferSelect;
type NewUserRow = typeof users.$inferInsert;

// Client-safe user columns. The bcrypt `password` hash is deliberately
// excluded so it never reaches a response. Password-reset tokens live in
// their own table (`password_reset_tokens`), not a user column.
const userColumnsWithoutPassword = {
  id: users.id,
  name: users.name,
  email: users.email,
  username: users.username,
  languages: users.languages,
  uiLanguage: users.uiLanguage,
  nativeLanguage: users.nativeLanguage,
  verified: users.verified,
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

// The four languages the app supports (the `Lang` enum values). There is no
// backend enums module, so this list is the source of truth server-side.
const SUPPORTED_LANGUAGES = ["English", "Spanish", "German", "Estonian"];

const isSupportedLanguage = (value: unknown): value is string =>
  typeof value === "string" && SUPPORTED_LANGUAGES.includes(value);

// Validate + normalize a `languages` array a client sends (registration, and a
// profile edit on `updateUser`): every entry must be a supported language, and
// at least two are required (a Word needs translations in >= 2 languages).
// Order is preserved and duplicates dropped — the array order is the user's
// language preference. Returns a discriminated result so the caller can set
// `res.status(400)` (the error middleware only reads `res.statusCode`, not
// `err.statusCode`).
const normalizeLanguageSelection = (
  input: unknown,
):
  | { ok: true; languages: string[] }
  | { ok: false; message: string } => {
  if (!Array.isArray(input)) {
    return { ok: false, message: "Please select at least 2 languages" };
  }
  if (!input.every(isSupportedLanguage)) {
    return { ok: false, message: "Invalid language selection" };
  }
  const deduped = [...new Set(input)];
  if (deduped.length < 2) {
    return { ok: false, message: "Please select at least 2 languages" };
  }
  return { ok: true, languages: deduped };
};

const generateToken = (id: string) => {
  // JWTs carry only the stable user id; user profile data is reloaded by auth middleware.
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

// Explicit allowlist of the user fields safe to return to a client. Never spread
// a raw row here: `findUserById` selects every column (incl. the bcrypt
// `password` hash), and this is the serializer for
// `getUserById` / `updateUser` / `verifyUser`.
const serializeUser = (user: Partial<UserRow>) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  languages: user.languages,
  uiLanguage: user.uiLanguage,
  nativeLanguage: user.nativeLanguage,
  verified: user.verified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const serializeLoginUser = (user: UserRow) => ({
  id: user.id,
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
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  languages: user.languages,
  uiLanguage: user.uiLanguage,
  nativeLanguage: user.nativeLanguage,
  verified: user.verified,
});

const registerUser = asyncHandler(async (req: any, res: any) => {
  const { name, email, username, password, languages, uiLanguage } = req.body;

  // Validate the required registration fields before any database work.
  if (!name || !email || !username || !password) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // The account is created with the languages the user picked at sign-up (>= 2,
  // all supported); the array order is their language preference.
  const languagesResult = normalizeLanguageSelection(languages);
  if (!languagesResult.ok) {
    res.status(400);
    throw new Error(languagesResult.message);
  }

  // The UI language picked on the login/register screen is stored on the row.
  // Absent -> default "English"; present but unsupported -> reject.
  let resolvedUiLanguage = "English";
  if (uiLanguage !== undefined && uiLanguage !== null && uiLanguage !== "") {
    if (!isSupportedLanguage(uiLanguage)) {
      res.status(400);
      throw new Error("Invalid language selection");
    }
    resolvedUiLanguage = uiLanguage;
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

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      username,
      password: hashedPassword,
      languages: languagesResult.languages,
      uiLanguage: resolvedUiLanguage,
      nativeLanguage: null,
      verified: false,
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

  // Send the verification email after both user and token rows exist. Not
  // awaited: sendEmail.js already catches its own send errors internally and
  // never rejects, so awaiting it only ever adds latency, not safety — and
  // with a slow or unreachable mail provider, that latency used to be
  // nodemailer's full default timeout (~2 min), blocking a response for a
  // registration that already succeeded (.dev-context/deployment-strategy.md
  // D-g). sendEmail.js now caps its own connect/greeting/socket timeouts at
  // 5s each, so the real worst case is much smaller — this still stays
  // un-awaited regardless, since the response has no reason to wait on it.
  const url = `${process.env.BASE_URL}/user/${user.id}/verify/${token.token}`;
  sendMail({
    email: user.email,
    url,
    name: user.name,
    type: "verifyEmail",
    language: resolvedUiLanguage,
  }).catch((error: unknown) => console.error("Failed to send verification email:", error));

  res.status(201).json(publicUserResponse(user));
});

const loginUser = asyncHandler(async (req: any, res: any) => {
  const { email, password, uiLanguage } = req.body;

  // Look up by email first so password comparison only runs for a real account.
  const user = email ? await findUserByEmailInsensitive(email) : undefined;

  // A password-less (OAuth-only) account has no hash to compare against —
  // point it at the right button instead of a confusing generic rejection.
  // This confirms account existence to an unauthenticated caller, same as
  // registerUser's "Email already in use" already does.
  if (user && user.password === null) {
    res.status(400);
    throw new Error("Sign in with Google");
  }

  if (!user || !(await bcrypt.compare(password || "", user.password))) {
    res.status(400);
    throw new Error("Invalid credentials");
  }

  // A UI language chosen on the login screen is persisted to the row so the app
  // opens in that language and stays consistent on the next visit.
  if (uiLanguage !== undefined && uiLanguage !== null && uiLanguage !== "") {
    if (!isSupportedLanguage(uiLanguage)) {
      res.status(400);
      throw new Error("Invalid language selection");
    }
    if (uiLanguage !== user.uiLanguage) {
      await db
        .update(users)
        .set({ uiLanguage, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      user.uiLanguage = uiLanguage;
    }
  }

  res.json(serializeLoginUser(user));
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

  // A profile edit may change the language selection: validate it exactly as
  // registration does (>= 2 supported, de-duped, order preserved). Omitting the
  // key leaves the stored selection untouched.
  let resolvedLanguages = userData.languages;
  if (languages !== undefined) {
    const languagesResult = normalizeLanguageSelection(languages);
    if (!languagesResult.ok) {
      res.status(400);
      throw new Error(languagesResult.message);
    }
    resolvedLanguages = languagesResult.languages;
  }

  // Same rule as login/register for the UI language: absent -> keep the stored
  // value; present but unsupported -> reject.
  if (
    uiLanguage !== undefined &&
    uiLanguage !== null &&
    uiLanguage !== "" &&
    !isSupportedLanguage(uiLanguage)
  ) {
    res.status(400);
    throw new Error("Invalid language selection");
  }

  // Only update profile fields owned by this endpoint; email and password stay unchanged.
  const [updatedUser] = await db
    .update(users)
    .set({
      name: name ?? userData.name,
      username: username ?? userData.username,
      languages: resolvedLanguages,
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
            eq(friendships.requesterId, req.user.id),
            eq(friendships.addresseeId, req.user.id),
          ),
        ),
      );

    matchingFriendIds = matchingFriendships.map((friendship) =>
      friendship.requesterId === req.user.id
        ? friendship.addresseeId
        : friendship.requesterId,
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

    // Return profile data plus a JWT so the client can enter authenticated routes
    // immediately. `serializeUser` is an allowlist, so no `password` strip needed.
    const userWithToken = {
      ...serializeUser({ ...user, verified: true }),
      token: generateToken(user.id),
    };

    res
      .status(200)
      .send({ user: userWithToken, message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// Password-reset links expire this long after they're issued (2026-09-22
// decision — unlike email verification, which never expires).
const PASSWORD_RESET_TTL_MINUTES = 30;

const requestPasswordReset = asyncHandler(async (req: any, res: any) => {
  const email = req.body.email;

  // Password reset starts from email because users may not know their id.
  const user = email ? await findUserByEmailInsensitive(email) : undefined;
  if (!user) {
    res.status(400);
    throw new Error("There is no user registered with the email given.");
  }

  // Insert a new reset-token row; a user may have several outstanding
  // requests at once (e.g. one per device) until one of them is used.
  const newPasswordToken = crypto.randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: newPasswordToken,
  });

  // Send the reset link only after the token has been persisted. Not
  // awaited — see the register handler's own comment on why.
  const url = `${process.env.BASE_URL}/resetPassword/${user.id}/${newPasswordToken}`;
  sendMail({
    email: user.email,
    url,
    name: user.name,
    type: "resetPassword",
    language: user.uiLanguage,
  }).catch((error: unknown) => console.error("Failed to send password reset email:", error));

  res.status(200).json({});
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

  // A token only authorizes a password change while it matches this user,
  // hasn't been used yet, and is within the 30-minute TTL.
  const ttlCutoff = new Date(Date.now() - PASSWORD_RESET_TTL_MINUTES * 60_000);
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.createdAt, ttlCutoff),
      ),
    )
    .limit(1);

  if (!resetToken) {
    res.status(400);
    throw new Error("Invalid token.");
  }

  // Replace the password hash, mark the used token, and invalidate every
  // other outstanding reset request for this user so old links stop working.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const now = new Date();

  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: now })
    .where(eq(users.id, user.id));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetToken.id));
  await db
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        ne(passwordResetTokens.id, resetToken.id),
      ),
    );

  res.status(200).json({});
});

const getBasicUserMetrics = asyncHandler(async (req: any, res: any) => {
  try {
    const metrics = await calculateBasicUserMetrics({
      id: req.user.id,
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
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// `export =` (not `module.exports =`) so `typeof import("./userController")`
// resolves — oauthController.ts uses that to type its typed require of
// generateToken/serializeLoginUser. Compiles to the same `module.exports =`
// under CommonJS; every existing plain `require(...)` caller is unaffected.
export = {
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
  // Reused by oauthController.ts (oauth-login-strategy.md Phase 2) rather
  // than duplicating session-minting logic for a second sign-in path.
  generateToken,
  serializeLoginUser,
  // Reused by oauthController.ts's signup/callback flow (Phase 3) rather
  // than duplicating registration's validation and lookup rules.
  normalizeLanguageSelection,
  isSupportedLanguage,
  findUserByUsernameInsensitive,
  findUserByEmailInsensitive,
  // Reused by oauthController.ts's identities endpoints (Phase 5) so an
  // invalid :id param 404s cleanly instead of hitting Postgres with
  // malformed uuid input.
  isUuid,
};
