/**
 * Mobile QA: document scroll inside a short iframe (Wix dashboard pattern).
 * Run: node scripts/qa-mobile-layout.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("/tmp/formcraft-mobile-qa", { recursive: true });

const editorHtml = `<!DOCTYPE html>
<html class="min-h-full"><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-full bg-slate-100" style="margin:0">
<!-- Short host frame like Wix dashboard iframe -->
<div id="iframe" style="height:640px;width:390px;margin:0 auto;border:2px solid #f43f5e;overflow:auto">
  <div class="relative flex w-full flex-col bg-slate-100">
    <div class="sticky top-0 z-30 bg-white">
      <div class="border-b px-3 py-2 text-sm font-bold">Top bar</div>
      <div class="border-b px-3 py-2 text-xs">Build · Settings · Design</div>
    </div>
    <div class="grid gap-4 overflow-visible p-3">
      ${Array.from({ length: 24 }, (_, i) => `<div class="rounded-xl border bg-white p-4 text-sm">Field block ${i + 1}</div>`).join("")}
    </div>
  </div>
</div>
</body></html>`;

writeFileSync("/tmp/formcraft-mobile-qa/editor.html", editorHtml);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

await page.goto("file:///tmp/formcraft-mobile-qa/editor.html");
await page.waitForTimeout(200);

const metrics = await page.evaluate(() => {
  const frame = document.getElementById("iframe");
  const before = frame.scrollTop;
  frame.scrollTop = 800;
  const after = frame.scrollTop;
  return {
    before,
    after,
    clientH: frame.clientHeight,
    scrollH: frame.scrollHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  };
});

console.log("iframe_scroll", metrics);
console.log(
  "scroll_works",
  metrics.after > metrics.before && metrics.scrollH > metrics.clientH,
);
console.log(
  "body_not_locked",
  metrics.bodyOverflow !== "hidden" && metrics.htmlOverflow !== "hidden",
);

await page.screenshot({ path: "/tmp/formcraft-mobile-qa/editor-scrolled.png" });
await browser.close();
console.log("screenshots in /tmp/formcraft-mobile-qa/");
