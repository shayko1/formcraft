import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Idempotent: add Forms.live + create FormVersions collection for draft/publish.
const SITE_ID = JSON.parse(readFileSync("wix.config.json", "utf-8")).siteId;

function token() {
  return execFileSync("npx", ["wix", "token", "--site", SITE_ID], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .pop()
    .trim();
}

const bearer = token();
console.log("✓ Got site token");

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${bearer}`,
  "wix-site-id": SITE_ID,
};

async function addFieldIfMissing(collectionId, field) {
  const getRes = await fetch(`https://www.wixapis.com/wix-data/v2/collections/${collectionId}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      "wix-site-id": SITE_ID,
    },
  });
  const getData = await getRes.json();
  if (!getData.collection) {
    console.error(`✗ Could not load ${collectionId}:`, JSON.stringify(getData, null, 2));
    process.exit(1);
  }
  const existing = new Set((getData.collection.fields ?? []).map((f) => f.key));
  if (existing.has(field.key)) {
    console.log(`• ${collectionId}.${field.key} already present`);
    return;
  }
  const res = await fetch("https://www.wixapis.com/wix-data/v2/collections/create-field", {
    method: "POST",
    headers,
    body: JSON.stringify({ dataCollectionId: collectionId, field }),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✓ Added field: ${collectionId}.${field.key}`);
  } else if (JSON.stringify(data).includes("ALREADY_EXISTS") || res.status === 409) {
    console.log(`• Field already exists: ${collectionId}.${field.key}`);
  } else {
    console.error(`✗ Failed for ${field.key} (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

async function createCollection(collection) {
  const res = await fetch("https://www.wixapis.com/wix-data/v2/collections", {
    method: "POST",
    headers,
    body: JSON.stringify({ collection }),
  });
  const data = await res.json();
  if (data.collection?.id) {
    console.log(`✓ Created collection: ${data.collection.id}`);
  } else if (JSON.stringify(data).includes("ALREADY_EXISTS") || res.status === 409) {
    console.log(`• Collection already exists: ${collection.id}`);
  } else {
    console.error(`✗ Failed for ${collection.id} (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

await addFieldIfMissing("Forms", {
  key: "live",
  displayName: "Live snapshot (JSON)",
  type: "TEXT",
});

await createCollection({
  id: "FormVersions",
  displayName: "FormCraft — Form Versions",
  fields: [
    { key: "formId", displayName: "Form ID", type: "TEXT" },
    { key: "version", displayName: "Version", type: "NUMBER" },
    { key: "title", displayName: "Title", type: "TEXT" },
    { key: "description", displayName: "Description", type: "TEXT" },
    { key: "fields", displayName: "Fields (JSON)", type: "TEXT" },
    { key: "theme", displayName: "Theme (JSON)", type: "TEXT" },
    { key: "createdDate", displayName: "Created Date", type: "TEXT" },
  ],
  permissions: {
    insert: "ADMIN",
    read: "ADMIN",
    update: "ADMIN",
    remove: "ADMIN",
  },
});

console.log("Done.");
