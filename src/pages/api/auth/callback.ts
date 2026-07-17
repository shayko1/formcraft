import type { APIRoute } from "astro";
import { getContextualAuth } from "@wix/sdk-runtime/context";
import { WIX_CLIENT_ID } from "astro:env/client";

const OAUTH_STATE_COOKIE = "oAuthState";
const SESSION_COOKIE = "wixSession";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Overrides @wix/astro's /api/auth/callback so the member session cookie gets a
 * real Max-Age. Wix's built-in saver omits Max-Age in production (session cookie
 * only), which makes logins disappear as soon as the browser drops the session.
 */
export const GET: APIRoute = async (context) => {
  const oauthStateCookie = context.cookies.get(OAUTH_STATE_COOKIE);
  if (oauthStateCookie == null) throw new Error(`Missing \`${OAUTH_STATE_COOKIE}\` cookie`);

  let oauthData: {
    codeChallenge: string;
    codeVerifier: string;
    originalUri: string;
    redirectUri: string;
    state: string;
  };
  try {
    oauthData = JSON.parse(oauthStateCookie.value);
  } catch {
    throw new Error(`Invalid \`${OAUTH_STATE_COOKIE}\` cookie`);
  }

  if (!oauthData.originalUri?.startsWith("/")) {
    throw new Error("Invalid `originalUri` cookie param, only relative URLs are allowed");
  }

  const auth = getContextualAuth() as unknown as {
    parseFromUrl: (
      url: string,
      mode: string,
    ) => { code?: string; error?: string; errorDescription?: string; state?: string };
    getMemberTokens: (
      code: string | undefined,
      state: string | undefined,
      oauthData: unknown,
    ) => Promise<unknown>;
  };

  const { code, error, errorDescription, state } = auth.parseFromUrl(context.url.toString(), "query");
  if (error != null) throw new Error(`Error while authenticating: \`${errorDescription}\``);

  const memberTokens = await auth.getMemberTokens(code, state, oauthData);

  context.cookies.delete(OAUTH_STATE_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  context.cookies.set(
    SESSION_COOKIE,
    { clientId: WIX_CLIENT_ID, tokens: memberTokens },
    {
      path: "/",
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    },
  );

  return context.redirect(oauthData.originalUri);
};
