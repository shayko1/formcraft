import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Idempotent: add viewCount / startCount NUMBER fields to the existing Forms collection
// via Create Data Collection Field.
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

const getRes = await fetch(`https://www.wixapis.com/wix-data/v2/collections/Forms`, {
  headers: {
    Authorization: `Bearer ${bearer}`,
    "wix-site-id": SITE_ID,
  },
});
const getData = await getRes.json();
if (!getData.collection) {
  console.error("✗ Could not load Forms collection:", JSON.stringify(getData, null, 2));
  process.exit(1);
}

const existing = new Set((getData.collection.fields ?? []).map((f) => f.key));
const toAdd = [
  { key: "viewCount", displayName: "View Count", type: "NUMBER" },
  { key: "startCount", displayName: "Start Count", type: "NUMBER" },
].filter((f) => !existing.has(f.key));

if (toAdd.length === 0) {
  console.log("• viewCount and startCount already present");
  process.exit(0);
}

for (const field of toAdd) {
  const res = await fetch("https://www.wixapis.com/wix-data/v2/collections/create-field", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "wix-site-id": SITE_ID,
    },
    body: JSON.stringify({
      dataCollectionId: "Forms",
      field,
    }),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✓ Added field: ${field.key}`);
  } else if (JSON.stringify(data).includes("ALREADY_EXISTS") || res.status === 409) {
    console.log(`• Field already exists: ${field.key}`);
  } else {
    console.error(`✗ Failed for ${field.key} (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

console.log("Done.");
