import type { APIRoute } from "astro";

// Only public marketing pages are indexed. Dashboard and published forms are private.
const ROUTES = ["/", "/pricing"];

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).toString().replace(/\/$/, "");
  const urls = ROUTES.map(
    (r) => `  <url><loc>${origin}${r}</loc><changefreq>weekly</changefreq></url>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
