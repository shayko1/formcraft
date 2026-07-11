import { auth } from "@wix/essentials";
import { items } from "@wix/data";
import { members } from "@wix/members";

// The FormCraft headless site.
export const SITE_ID = "6b080820-d034-497b-9643-dafcdb9e15d5";

export const FORMS_COLLECTION = "Forms";
export const SUBMISSIONS_COLLECTION = "Submissions";

// Admin data access via elevation. `auth.elevate()` wraps each @wix/data function so
// it runs with admin-level permissions inside the Wix-managed headless backend — no
// external API key needed. Elevation is backend-only and must never be exposed to the
// client; every caller here runs in a server route that authorizes the request first.
//
// Wrapping happens once at module load (auth.elevate is pure — it only wraps, it does
// not execute), so these are safe module-level singletons.
export const adminItems = {
  query: auth.elevate(items.query),
  get: auth.elevate(items.get),
  insert: auth.elevate(items.insert),
  update: auth.elevate(items.update),
  remove: auth.elevate(items.remove),
  bulkPatch: auth.elevate(items.bulkPatch),
  bulkRemove: auth.elevate(items.bulkRemove),
};

const elevatedGetMember = auth.elevate(members.getMember);

/** Resolve the login email of a Wix member (lowercased), or null. */
export async function getMemberEmail(memberId: string): Promise<string | null> {
  try {
    const res = await elevatedGetMember(memberId, { fieldsets: ["FULL"] });
    return res.member?.loginEmail?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
