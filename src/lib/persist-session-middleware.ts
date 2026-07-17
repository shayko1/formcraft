import { defineMiddleware } from "astro:middleware";
import { OAuthStrategy, TokenRole } from "@wix/sdk";

/**
 * Wix's auth middleware (order: "pre") treats an expired access token as "no
 * session" and overwrites `wixSession` with anonymous visitor tokens — it never
 * refreshes the member refresh_token. In production it also omits Max-Age, so
 * the cookie is a browser session cookie that vanishes easily.
 *
 * This middleware must run BEFORE @wix/astro auth (registered as order:"pre"
 * ahead of wix() in astro.config) so we can renew member tokens first.
 */

const SESSION_COOKIE = "wixSession";
/** Keep logged-in members signed in across browser restarts. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Refresh when access token is expired or within 5 minutes of expiry. */
const REFRESH_SKEW_SEC = 300;

type SessionCookie = {
  clientId: string;
  tokens: {
    accessToken: { value: string; expiresAt: number };
    refreshToken: { value: string; role: string };
  };
};

function isSessionCookie(value: unknown): value is SessionCookie {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.clientId !== "string") return false;
  const tokens = v.tokens as Record<string, unknown> | undefined;
  if (!tokens || typeof tokens !== "object") return false;
  const access = tokens.accessToken as Record<string, unknown> | undefined;
  const refresh = tokens.refreshToken as Record<string, unknown> | undefined;
  return (
    !!access &&
    typeof access.value === "string" &&
    typeof access.expiresAt === "number" &&
    !!refresh &&
    typeof refresh.value === "string" &&
    typeof refresh.role === "string"
  );
}

function cookieOptions() {
  return {
    path: "/",
    secure: true,
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    // Not HttpOnly — @wix/astro browser runtime reads document.cookie.
  };
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  try {
    const raw = context.cookies.get(SESSION_COOKIE)?.json();
    if (!isSessionCookie(raw)) return next();
    if (raw.tokens.refreshToken.role !== TokenRole.MEMBER) return next();

    const now = Math.floor(Date.now() / 1000);
    let tokens = raw.tokens;

    if (tokens.accessToken.expiresAt < now + REFRESH_SKEW_SEC) {
      const auth = OAuthStrategy({ clientId: raw.clientId, tokens });
      // Misnamed API: renews via refresh_token when present; falls back to visitor.
      const renewed = await auth.generateVisitorTokens(tokens);
      if (renewed.refreshToken?.role !== TokenRole.MEMBER) {
        // Refresh failed — leave cookie alone; Wix middleware will demote.
        return next();
      }
      tokens = renewed;
    }

    context.cookies.set(
      SESSION_COOKIE,
      { clientId: raw.clientId, tokens },
      cookieOptions(),
    );
  } catch {
    // Never block the request on session repair.
  }

  return next();
});
