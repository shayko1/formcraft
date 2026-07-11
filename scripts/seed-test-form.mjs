import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SITE_ID = JSON.parse(readFileSync("wix.config.json", "utf-8")).siteId;

function token() {
  return execFileSync("npx", ["wix", "token", "--site", SITE_ID], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .pop()
    .trim();
}

const bearer = token();

const fields = [
  { id: "f1", type: "text", label: "Full name", required: true },
  { id: "f2", type: "phone", label: "Phone", required: true, dir: "ltr" },
  { id: "f3", type: "select", label: "Reason", required: false, options: ["Sales", "Support", "Other"] },
];

const dataItem = {
  ownerId: "seed-owner",
  title: "Live Test Form",
  description: "Seeded to validate the public render + submit path.",
  slug: "live-test",
  templateId: "contact",
  fields: JSON.stringify(fields),
  theme: JSON.stringify({ accent: "#059669", dir: "ltr" }),
  published: true,
  submissionCount: 0,
};

const res = await fetch("https://www.wixapis.com/wix-data/v2/items", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearer}`,
    "wix-site-id": SITE_ID,
  },
  body: JSON.stringify({ dataCollectionId: "Forms", dataItem: { data: dataItem } }),
});
const body = await res.json();
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(body?.dataItem?.data ?? body, null, 2).slice(0, 500));
