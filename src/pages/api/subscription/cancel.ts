import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import {
  cancelSubscriptionAtPeriodEnd,
  memberOwnsOrder,
} from "../../../lib/subscription";

/** POST /api/subscription/cancel — cancel Pro at next payment date (end of period). */
export const POST: APIRoute = async ({ request }) => {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let orderId = "";
  try {
    const body = (await request.json()) as { orderId?: string };
    orderId = String(body.orderId ?? "").trim();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!orderId) {
    return new Response(JSON.stringify({ message: "orderId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owns = await memberOwnsOrder(memberId, orderId);
  if (!owns) {
    return new Response(JSON.stringify({ message: "Order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await cancelSubscriptionAtPeriodEnd(orderId);
    return new Response(JSON.stringify({ ok: true, effectiveAt: "NEXT_PAYMENT_DATE" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not cancel subscription";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
