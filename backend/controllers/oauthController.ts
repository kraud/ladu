/**
 * OAuth sign-in — oauth-login-strategy.md. Phase 2 scope: only an
 * already-linked `oauth_identities` row can complete sign-in (outcome (a) in
 * the plan's flow diagram). A brand-new identity or one whose email matches
 * an existing password account (outcomes (b)/(c)) gets a clear "not yet
 * supported" redirect instead — Phases 3 and 4 build those.
 */
const asyncHandler = require("express-async-handler");
const { jwtVerify } = require("jose");
const { db }: typeof import("../src/db") = require("../src/db");
const { oauthIdentities, users }: typeof import("../src/db/schema") = require("../src/db/schema");
const { and, eq }: typeof import("drizzle-orm") = require("drizzle-orm");

const { generateToken }: typeof import("./userController") = require("./userController");
const { getProvider, listConfiguredProviders }: typeof import("../lib/oauth/providers") = require("../lib/oauth/providers");
const { generateCodeVerifier, generateCodeChallenge, generateNonce }: typeof import("../lib/oauth/pkce") = require("../lib/oauth/pkce");
const { issueStateToken, verifyStateToken }: typeof import("../lib/oauth/stateToken") = require("../lib/oauth/stateToken");
const { getDiscoveryDocument, getJwks }: typeof import("../lib/oauth/discovery") = require("../lib/oauth/discovery");

const OAUTH_STATE_COOKIE = "__Host-ladu_oauth";
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

const OAUTH_ERROR = {
  // Phase 2's own scope limit — a real, expected outcome until Phases 3/4 ship.
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

    // sub/email only — Phase 2 doesn't act on email_verified (nothing here
    // branches on email yet; that starts in Phase 3/4).
    const identity = provider.mapClaims(claims as Record<string, unknown>);

    // Identity lookup is always by (provider, provider_user_id), never by
    // email — a provider's email can change; its `sub` cannot.
    const [existingIdentity] = await db
      .select()
      .from(oauthIdentities)
      .where(and(eq(oauthIdentities.provider, provider.name), eq(oauthIdentities.providerUserId, identity.sub)))
      .limit(1);

    if (!existingIdentity) {
      // Outcomes (b) new-email and (c) email-matches-password-account both
      // land here in Phase 2 — Phase 3 (signup) and Phase 4 (linking) give
      // each its own real screen instead of this shared "not yet" redirect.
      redirectWithError(OAUTH_ERROR.NOT_LINKED);
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, existingIdentity.userId)).limit(1);
    if (!user) throw new Error("Linked identity has no matching user row");

    const token = generateToken(user.id);
    res.redirect(`${frontendBase}/auth/callback#token=${token}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    redirectWithError(OAUTH_ERROR.FAILED);
  }
});

export = {
  getProviders,
  startAuth,
  callback,
};
