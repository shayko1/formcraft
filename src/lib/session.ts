import { auth } from "@wix/essentials";

/**
 * Resolve the logged-in Wix member/user id, or null for visitors.
 * Used by dashboard pages (to gate + redirect) and API routes (to authorize).
 */
export async function getCurrentMemberId(): Promise<string | null> {
  try {
    const tokenInfo = await auth.getTokenInfo();
    const loggedIn = tokenInfo.subjectType === "MEMBER" || tokenInfo.subjectType === "USER";
    return loggedIn ? (tokenInfo.subjectId ?? null) : null;
  } catch {
    return null;
  }
}

/** Build the login redirect URL that returns to `pathname` after auth. */
export function loginRedirect(pathname: string): string {
  return `/api/auth/login?returnToUrl=${encodeURIComponent(pathname)}`;
}
