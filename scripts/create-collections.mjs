import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SITE_ID = JSON.parse(readFileSync("wix.config.json", "utf-8")).siteId;

function token() {
  // execFile (no shell) — args passed as an array, so SITE_ID is never interpolated into a shell string.
  return execFileSync("npx", ["wix", "token", "--site", SITE_ID], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .pop()
    .trim();
}

async function createCollection(bearer, collection) {
  const res = await fetch("https://www.wixapis.com/wix-data/v2/collections", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "wix-site-id": SITE_ID,
    },
    body: JSON.stringify({ collection }),
  });
  const data = await res.json();
  if (data.collection?.id) {
    console.log(`✓ Created collection: ${data.collection.id}`);
  } else if (JSON.stringify(data).includes("ALREADY_EXISTS") || res.status === 409) {
    console.log(`• Collection already exists: ${collection.id}`);
  } else {
    console.error(`✗ Failed for ${collection.id} (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
  }
}

const bearer = token();
console.log("✓ Got site token");

await createCollection(bearer, {
  id: "Forms",
  displayName: "FormCraft — Forms",
  fields: [
    { key: "ownerId", displayName: "Owner ID", type: "TEXT" },
    { key: "title", displayName: "Title", type: "TEXT" },
    { key: "description", displayName: "Description", type: "TEXT" },
    { key: "slug", displayName: "Slug", type: "TEXT" },
    { key: "templateId", displayName: "Template ID", type: "TEXT" },
    { key: "fields", displayName: "Fields (JSON)", type: "TEXT" },
    { key: "internalFields", displayName: "Internal Fields (JSON)", type: "TEXT" },
    { key: "theme", displayName: "Theme (JSON)", type: "TEXT" },
    { key: "published", displayName: "Published", type: "BOOLEAN" },
    { key: "submissionCount", displayName: "Submission Count", type: "NUMBER" },
    { key: "viewCount", displayName: "View Count", type: "NUMBER" },
    { key: "startCount", displayName: "Start Count", type: "NUMBER" },
  ],
  permissions: {
    insert: "ADMIN",
    read: "ADMIN",
    update: "ADMIN",
    remove: "ADMIN",
  },
});

await createCollection(bearer, {
  id: "Submissions",
  displayName: "FormCraft — Submissions",
  fields: [
    { key: "formId", displayName: "Form ID", type: "TEXT" },
    { key: "ownerId", displayName: "Owner ID", type: "TEXT" },
    { key: "data", displayName: "Data (JSON)", type: "TEXT" },
    { key: "exported", displayName: "Exported", type: "BOOLEAN" },
  ],
  permissions: {
    insert: "ANYONE",
    read: "ADMIN",
    update: "ADMIN",
    remove: "ADMIN",
  },
});

console.log("Done.");
