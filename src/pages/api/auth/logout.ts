import type { APIRoute } from "astro";
import { getContextualAuth } from "@wix/sdk-runtime/context";

// @wix/astro ships a POST-only /api/auth/logout route, but the UI logs out via a
// plain link (GET) — which hit no handler and landed on an "unknown page". This GET
// override runs the same logout flow, and (like the login override) forces HTTPS on
// the callback URL because Wix's cloud proxy terminates TLS so the internal request
// URL arrives as http://.
export const GET: APIRoute = async ({ request, url, redirect }) => {
  const returnToUrl = url.searchParams.get("returnToUrl") ?? "/";

  const callbackUrl = new URL("/api/auth/logout-callback", url);
  callbackUrl.protocol = "https:";
  callbackUrl.searchParams.set("returnTo", returnToUrl);

  // getContextualAuth returns a broad AuthenticationStrategy; the OAuth-capable
  // implementation exposes logout() at runtime.
  const auth = getContextualAuth() as unknown as {
    logout: (postFlowUrl: string) => Promise<{ logoutUrl: string }>;
  };
  const { logoutUrl } = await auth.logout(callbackUrl.toString());
  return redirect(logoutUrl);
};
