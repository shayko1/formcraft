/**
 * Mobile QA: dashboard header + editor scroll shell (iframe-safe).
 * Run: node scripts/qa-mobile-layout.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("/tmp/formcraft-mobile-qa", { recursive: true });

const headerHtml = `<!DOCTYPE html>
<html class="h-full"><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="h-full bg-slate-100">
<header class="border-b border-slate-100 bg-white/80">
  <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
    <a class="flex min-w-0 items-center gap-2 text-lg font-extrabold">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">◆</span>
      <span class="truncate">Form<span class="text-indigo-600">Craft</span></span>
    </a>
    <div class="hidden items-center gap-4 sm:flex">
      <a class="whitespace-nowrap text-sm font-bold">My forms</a>
      <a class="whitespace-nowrap text-sm font-bold">Pricing</a>
      <a class="whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-bold">Sign out</a>
    </div>
    <details class="relative sm:hidden">
      <summary class="flex h-10 w-10 list-none items-center justify-center rounded-xl bg-slate-100 [&::-webkit-details-marker]:hidden">☰</summary>
      <div class="absolute end-0 z-50 mt-2 w-48 rounded-2xl border bg-white p-2 shadow-lg">
        <a class="block px-4 py-3 text-sm font-bold">My forms</a>
        <a class="block px-4 py-3 text-sm font-bold">Pricing</a>
        <a class="block px-4 py-3 text-sm font-bold text-red-600">Sign out</a>
      </div>
    </details>
  </div>
</header>
<main class="p-4"><p class="text-sm text-slate-500">Dashboard body</p></main>
</body></html>`;

const editorHtml = `<!DOCTYPE html>
<html class="h-full"><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="h-full overflow-hidden bg-slate-100">
<!-- Simulate short Wix iframe (not full device dvh) -->
<div style="position:relative;height:640px;width:390px;margin:0 auto;border:2px solid #f43f5e;overflow:hidden">
  <div class="fixed inset-0 flex flex-col overflow-hidden bg-slate-100" style="position:absolute;inset:0">
    <div class="shrink-0 border-b bg-white px-3 py-2 text-sm font-bold">Top bar</div>
    <div class="shrink-0 border-b bg-white px-3 py-2 text-xs">Build · Settings · Design</div>
    <div id="scroll" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" style="-webkit-overflow-scrolling:touch;touch-action:pan-y">
      ${Array.from({ length: 20 }, (_, i) => `<div class="mb-2 rounded-xl border bg-white p-4 text-sm">Field block ${i + 1}</div>`).join("")}
    </div>
  </div>
</div>
</body></html>`;

writeFileSync("/tmp/formcraft-mobile-qa/header.html", headerHtml);
writeFileSync("/tmp/formcraft-mobile-qa/editor.html", editorHtml);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Header QA
await page.goto("file:///tmp/formcraft-mobile-qa/header.html");
await page.wait_for_timeout(300);
await page.screenshot({ path: "/tmp/formcraft-mobile-qa/header.png" });
const myFormsVisible = await page.locator("header >> text=My forms").count();
const hamburger = await page.locator("header summary").count();
const signOutInBar = await page.locator("header >> text=Sign out").evaluateAll((els) =>
  els.some((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && getComputedStyle(el).display !== "none" && el.closest("details") == null;
  }),
);
console.log("header_hamburger", hamburger === 1);
console.log("header_my_forms_in_details_only", myFormsVisible >= 1 && !signOutInBar);
// Open menu
await page.click("header summary");
await page.wait_for_timeout(200);
await page.screenshot({ path: "/tmp/formcraft-mobile-qa/header-open.png" });
const menuOpen = await page.locator("details[open]").count();
console.log("header_menu_opens", menuOpen === 1);

// Editor scroll QA inside short iframe
await page.goto("file:///tmp/formcraft-mobile-qa/editor.html");
await page.wait_for_timeout(300);
const scroll = page.locator("#scroll");
const before = await scroll.evaluate((el) => el.scrollTop);
await scroll.evaluate((el) => {
  el.scrollTop = 400;
});
const after = await scroll.evaluate((el) => el.scrollTop);
const clientH = await scroll.evaluate((el) => el.clientHeight);
const scrollH = await scroll.evaluate((el) => el.scrollHeight);
console.log("scroll_before", before, "scroll_after", after);
console.log("scroll_clientH", clientH, "scroll_scrollH", scrollH);
console.log("scroll_works", after > before && scrollH > clientH);
await page.screenshot({ path: "/tmp/formcraft-mobile-qa/editor-scrolled.png" });

// Bad pattern: 100dvh inside short iframe
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;height:640px;overflow:hidden">
<div style="height:100dvh;overflow:hidden;display:flex;flex-direction:column;border:2px solid red">
  <div style="height:56px;background:#fff">bar</div>
  <div id="bad" style="flex:1;overflow-y:auto">${"<p>x</p>".repeat(40)}</div>
</div></body></html>`);
const bad = await page.evaluate(() => {
  const shell = document.querySelector("div");
  const iframeH = 640;
  return {
    shellH: shell.getBoundingClientRect().height,
    iframeH,
    overshoots: shell.getBoundingClientRect().height > iframeH + 1,
  };
});
console.log("dvh_overshoots_iframe", bad.overshoots, "shellH", Math.round(bad.shellH));

await browser.close();
console.log("screenshots in /tmp/formcraft-mobile-qa/");
