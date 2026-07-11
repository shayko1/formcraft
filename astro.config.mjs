// @ts-check
import { defineConfig } from 'astro/config';
import wix from "@wix/astro";
import wixPages from "@wix/astro-pages";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import cloudProviderFetchAdapter from "@wix/cloud-provider-fetch-adapter";

const isBuild = process.env.NODE_ENV === "production";

// Public site URL — used for canonical links, sitemap, OG tags.
const SITE_URL = process.env.PUBLIC_SITE_URL || "https://formcraft.wix-site-host.com";

export default defineConfig({
  site: SITE_URL,
  output: "server",
  integrations: [wix({ auth: true, adminRedirect: false }), wixPages(), react()],
  security: { checkOrigin: false },
  image: { domains: ["static.wixstatic.com"] },
  vite: { plugins: [tailwindcss()] },
  ...(isBuild && { adapter: cloudProviderFetchAdapter({}) }),
});
