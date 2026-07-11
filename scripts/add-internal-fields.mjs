import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Idempotent: add internalFields TEXT field to the existing Forms collection.
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
if (existing.has("internalFields")) {
  console.log("• internalFields already present");
  process.exit(0);
}

const field = { key: "internalFields", displayName: "Internal Fields (JSON)", type: "TEXT" };
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

console.log("Done.");
