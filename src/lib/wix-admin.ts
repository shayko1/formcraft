import { auth } from "@wix/essentials";
import { items } from "@wix/data";
import { members } from "@wix/members";
import { files } from "@wix/media";

// The FormCraft headless site.
export const SITE_ID = "6b080820-d034-497b-9643-dafcdb9e15d5";

export const FORMS_COLLECTION = "Forms";
export const SUBMISSIONS_COLLECTION = "Submissions";
export const FORM_VERSIONS_COLLECTION = "FormVersions";
export const MAX_FORM_VERSIONS = 10;

// Admin data access via elevation. `auth.elevate()` wraps each @wix/data function so
// it runs with admin-level permissions inside the Wix-managed headless backend — no
// external API key needed. Elevation is backend-only and must never be exposed to
// the client; every caller here runs in a server route that authorizes the request first.
//
// Wrapping happens once at module load (auth.elevate is pure — it only wraps, it does
// not execute), so these are safe module-level singletons.
export const adminItems = {
  query: auth.elevate(items.query),
  get: auth.elevate(items.get),
  insert: auth.elevate(items.insert),
  update: auth.elevate(items.update),
  remove: auth.elevate(items.remove),
  bulkRemove: auth.elevate(items.bulkRemove),
};

/** Mint a signed Media Manager upload URL (admin). Used by public form uploads. */
export const generateUploadUrl = auth.elevate(files.generateFileUploadUrl);

const elevatedGetMember = auth.elevate(members.getMember);

/** Resolve the login email of a Wix member (lowercased), or null. */
export async function getMemberEmail(memberId: string): Promise<string | null> {
  try {
    const res = (await elevatedGetMember(memberId, { fieldsets: ["FULL"] })) as {
      loginEmail?: string;
      member?: { loginEmail?: string };
    };
    const email = res.loginEmail ?? res.member?.loginEmail;
    return email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
