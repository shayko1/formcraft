import type { APIRoute } from "astro";
import { redirects } from "@wix/redirects";
import { getCurrentMemberId } from "../../lib/session";
import { PRO_PLAN_ID } from "../../lib/plan";

// POST /api/upgrade — starts a Wix-hosted checkout for the Pro plan and returns the
// redirect URL. Created in the logged-in MEMBER's context (NOT elevated) so their
// identity carries into checkout and the subscription attaches to their account.
export const POST: APIRoute = async ({ request }) => {
  const memberId = await getCurrentMemberId();
  const origin = new URL(request.url).origin;

  if (!memberId) {
    // Not logged in — tell the client to send them through login first.
    return new Response(
      JSON.stringify({ loginUrl: `/api/auth/login?returnToUrl=${encodeURIComponent("/pricing")}` }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const session = await redirects.createRedirectSession({
      paidPlansCheckout: { planId: PRO_PLAN_ID },
      callbacks: {
        postFlowUrl: `${origin}/dashboard?upgraded=1`,
        planListUrl: `${origin}/pricing`,
      },
      preferences: { maintainIdentity: true },
    });
    const url = session.redirectSession?.fullUrl;
    if (!url) throw new Error("No redirect URL returned");
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start checkout";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
