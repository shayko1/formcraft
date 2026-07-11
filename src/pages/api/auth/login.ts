import type { APIRoute } from "astro";
import { getContextualAuth } from "@wix/sdk-runtime/context";

const OAUTH_STATE_COOKIE = "oAuthState";

// Overrides @wix/astro's built-in login route to force HTTPS in the callback URL —
// Wix's cloud proxy terminates TLS so the internal request URL arrives as http://,
// which otherwise produces an "invalid redirect URI" error.
export const GET: APIRoute = async ({ url, cookies }) => {
  const returnToUrl = url.searchParams.get("returnToUrl") ?? "/dashboard";

  const callbackUrl = new URL("/api/auth/callback", url);
  callbackUrl.protocol = "https:";

  // getContextualAuth returns a broad AuthenticationStrategy; the OAuth-capable
  // implementation exposes generateOAuthData/getAuthUrl at runtime.
  const auth = getContextualAuth() as unknown as {
    generateOAuthData: (redirectUri: string, originalUri: string) => unknown;
    getAuthUrl: (data: unknown, opts: { responseMode: string }) => Promise<{ authUrl: string }>;
  };
  const oauthData = auth.generateOAuthData(callbackUrl.toString(), returnToUrl);
  const { authUrl } = await auth.getAuthUrl(oauthData, { responseMode: "query" });

  cookies.set(OAUTH_STATE_COOKIE, JSON.stringify(oauthData), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 1800,
  });

  return new Response(null, {
    headers: { Location: authUrl },
    status: 302,
  });
};
