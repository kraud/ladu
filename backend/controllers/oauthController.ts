/**
 * OAuth sign-in — oauth-login-strategy.md. Three callback outcomes:
 * (a) an already-linked `oauth_identities` row logs straight in (Phase 2);
 * (b) a `sub` with no matching email issues a signup ticket (Phase 3, this
 *     file's newest piece); (c) a `sub` whose email matches an existing
 *     password account still gets the "not yet supported" redirect — Phase 4
 *     builds real linking.
 */
const asyncHandler = require("express-async-handler");
const { jwtVerify } = require("jose");
const { db }: typeof import("../src/db") = require("../src/db");
const { oauthIdentities, users }: typeof import("../src/db/schema") = require("../src/db/schema");
const { and, eq }: typeof import("drizzle-orm") = require("drizzle-orm");

const {
  generateToken,
  serializeLoginUser,
  normalizeLanguageSelection,
  isSupportedLanguage,
  findUserByUsernameInsensitive,
  findUserByEmailInsensitive,
}: typeof import("./userController") = require("./userController");
const { getProvider, listConfiguredProviders }: typeof import("../lib/oauth/providers") = require("../lib/oauth/providers");
const { generateCodeVerifier, generateCodeChallenge, generateNonce }: typeof import("../lib/oauth/pkce") = require("../lib/oauth/pkce");
const { issueStateToken, verifyStateToken }: typeof import("../lib/oauth/stateToken") = require("../lib/oauth/stateToken");
const { issueTicket, verifyTicket }: typeof import("../lib/oauth/ticket") = require("../lib/oauth/ticket");
const { getDiscoveryDocument, getJwks }: typeof import("../lib/oauth/discovery") = require("../lib/oauth/discovery");

const OAUTH_STATE_COOKIE = "__Host-ladu_oauth";
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

const OAUTH_ERROR = {
  // Outcome (c) — a real, expected outcome until Phase 4 ships linking.
  NOT_LINKED: "oauth_not_linked",
  // Anything else: a malformed callback, a provider/network error, a forged
  // or expired state, a failed token exchange or ID-token verification.
  // Deliberately not split further — none of those distinctions are
  // actionable for the person looking at the login screen.
  FAILED: "oauth_failed",
} as const;

/** `GET /api/auth/:provider/callback`'s redirect_uri — registered with the
 * provider ahead of time, so it must be built identically on both legs.
 * Defaults to BASE_URL (true in production/staging, same-origin FE+BE); only
 * needed as an override where the backend's own address differs from the
 * frontend's, i.e. local dev (BASE_URL is the Vite dev server, not :5001). */
function buildCallbackUri(providerName: string): string {
  const base = process.env.OAUTH_REDIRECT_BASE || process.env.BASE_URL;
  return `${base}/api/auth/${providerName}/callback`;
}

/** No `cookie-parser` dependency for one cookie — see oauth-login-strategy.md "State, not sessions". */
function readCookie(req: any, name: string): string | undefined {
  const header = req.headers.cookie as string | undefined;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

const getProviders = asyncHandler(async (req: any, res: any) => {
  res.json(listConfiguredProviders());
});

const startAuth = asyncHandler(async (req: any, res: any) => {
  const provider = getProvider(req.params.provider);
  if (!provider) {
    res.status(404);
    throw new Error("Unknown or unconfigured provider");
  }

  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const nonce = generateNonce();
  const jti = generateNonce();

  const stateJwt = issueStateToken({ provider: provider.name, verifier, nonce, jti });

  // `Secure` cookies (including `__Host-` prefixed ones) are accepted by
  // browsers on http://localhost without TLS — localhost is treated as a
  // secure context — so this works unchanged in local dev.
  res.cookie(OAUTH_STATE_COOKIE, stateJwt, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_MS,
  });

  const discovery = await getDiscoveryDocument(provider.issuer);
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", provider.clientId);
  authorizeUrl.searchParams.set("redirect_uri", buildCallbackUri(provider.name));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", provider.scope);
  // Only the state JWT's `jti` crosses the wire to the provider — the
  // verifier and nonce it protects stay server-side in the cookie.
  authorizeUrl.searchParams.set("state", jti);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  res.redirect(authorizeUrl.toString());
});

const callback = asyncHandler(async (req: any, res: any) => {
  const frontendBase = process.env.BASE_URL;
  const redirectWithError = (code: string) => {
    res.redirect(`${frontendBase}/auth/callback#error=${code}`);
  };

  const provider = getProvider(req.params.provider);
  if (!provider) {
    redirectWithError(OAUTH_ERROR.FAILED);
    return;
  }

  try {
    const cookieValue = readCookie(req, OAUTH_STATE_COOKIE);
    // Cleared unconditionally, before the outcome is even known — one-time use either way.
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    if (!cookieValue) throw new Error("Missing OAuth state cookie");

    const statePayload = verifyStateToken(cookieValue);
    if (statePayload.provider !== provider.name) throw new Error("Provider mismatch");

    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string" || state !== statePayload.jti) {
      throw new Error("Invalid or mismatched OAuth state");
    }

    const discovery = await getDiscoveryDocument(provider.issuer);

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: buildCallbackUri(provider.name),
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code_verifier: statePayload.verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokenBody = (await tokenRes.json()) as { id_token?: unknown };
    if (typeof tokenBody.id_token !== "string") throw new Error("Token response missing id_token");

    const jwks = getJwks(discovery.jwks_uri);
    const { payload: claims } = await jwtVerify(tokenBody.id_token, jwks, {
      issuer: discovery.issuer,
      audience: provider.clientId,
    });
    if (claims.nonce !== statePayload.nonce) throw new Error("Nonce mismatch");

    const identity = provider.mapClaims(claims as Record<string, unknown>);

    // Identity lookup is always by (provider, provider_user_id), never by
    // email — a provider's email can change; its `sub` cannot.
    const [existingIdentity] = await db
      .select()
      .from(oauthIdentities)
      .where(and(eq(oauthIdentities.provider, provider.name), eq(oauthIdentities.providerUserId, identity.sub)))
      .limit(1);

    if (existingIdentity) {
      // Outcome (a) — already linked.
      const [user] = await db.select().from(users).where(eq(users.id, existingIdentity.userId)).limit(1);
      if (!user) throw new Error("Linked identity has no matching user row");

      const token = generateToken(user.id);
      res.redirect(`${frontendBase}/auth/callback#token=${token}`);
      return;
    }

    const existingUser = await findUserByEmailInsensitive(identity.email);
    if (existingUser) {
      // Outcome (c) — email matches a password account. Phase 4 builds real
      // linking; the message here already tells them what to do meanwhile.
      redirectWithError(OAUTH_ERROR.NOT_LINKED);
      return;
    }

    // Outcome (b) — brand-new identity. A ticket, not an account: the
    // browser hasn't chosen a username or confirmed languages yet.
    const ticket = issueTicket({
      typ: "oauth_signup",
      provider: provider.name,
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
    });
    res.redirect(`${frontendBase}/auth/callback#ticket=${ticket}&mode=signup`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    redirectWithError(OAUTH_ERROR.FAILED);
  }
});

const signupComplete = asyncHandler(async (req: any, res: any) => {
  const { ticket, username, languages, uiLanguage } = req.body;

  let payload;
  try {
    payload = verifyTicket(ticket, "oauth_signup");
  } catch {
    res.status(400);
    throw new Error("Invalid or expired ticket");
  }

  if (!username) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // Same rule as regular registration, not relaxed (oauth-login-strategy.md).
  const languagesResult = normalizeLanguageSelection(languages);
  if (!languagesResult.ok) {
    res.status(400);
    throw new Error(languagesResult.message);
  }

  let resolvedUiLanguage = "English";
  if (uiLanguage !== undefined && uiLanguage !== null && uiLanguage !== "") {
    if (!isSupportedLanguage(uiLanguage)) {
      res.status(400);
      throw new Error("Invalid language selection");
    }
    resolvedUiLanguage = uiLanguage;
  }

  // Race guard: the ticket's identity may have been linked, or its email
  // claimed by a password account, in the 10-minute window since it was
  // issued (a retried request, another tab). Both make completing signup
  // here wrong — re-run the same lookups the callback itself did.
  const [alreadyLinked] = await db
    .select()
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, payload.provider), eq(oauthIdentities.providerUserId, payload.sub)))
    .limit(1);
  if (alreadyLinked) {
    res.status(400);
    throw new Error("This Google account is already linked to an account");
  }

  const emailExists = await findUserByEmailInsensitive(payload.email);
  if (emailExists) {
    res.status(400);
    throw new Error("Email already in use");
  }

  const usernameExists = await findUserByUsernameInsensitive(username);
  if (usernameExists) {
    res.status(400);
    throw new Error("Username already in use");
  }

  const [user] = await db
    .insert(users)
    .values({
      name: payload.name,
      email: payload.email,
      username,
      password: null,
      languages: languagesResult.languages,
      uiLanguage: resolvedUiLanguage,
      nativeLanguage: null,
      // Google already verified the address — the standard registration
      // flow's confirmation email is deliberately skipped (Decisions).
      verified: true,
    })
    .returning();

  await db.insert(oauthIdentities).values({
    userId: user.id,
    provider: payload.provider,
    providerUserId: payload.sub,
    emailAtLink: payload.email,
  });

  res.status(201).json(serializeLoginUser(user));
});

export = {
  getProviders,
  startAuth,
  callback,
  signupComplete,
};
