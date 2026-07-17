// @ts-check
import { defineConfig } from 'astro/config';
import wix from "@wix/astro";
import wixPages from "@wix/astro-pages";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import cloudProviderFetchAdapter from "@wix/cloud-provider-fetch-adapter";

const isBuild = process.env.NODE_ENV === "production";

// Public site URL — the primary custom domain. Used for canonical links, sitemap,
// and OG tags so search engines consolidate to formcraft.biz (not the wix-host URL).
const SITE_URL = process.env.PUBLIC_SITE_URL || "https://www.formcraft.biz";

/** Runs before @wix/astro auth so member refresh tokens are renewed, not wiped. */
const persistSession = {
  name: "formcraft-persist-session",
  hooks: {
    "astro:config:setup"({ addMiddleware }) {
      addMiddleware({
        entrypoint: new URL("./src/lib/persist-session-middleware.ts", import.meta.url),
        order: "pre",
      });
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  output: "server",
  integrations: [
    persistSession,
    wix({ auth: true, adminRedirect: false }),
    wixPages(),
    react(),
  ],
  security: { checkOrigin: false },
  image: { domains: ["static.wixstatic.com"] },
  vite: { plugins: [tailwindcss()] },
  ...(isBuild && { adapter: cloudProviderFetchAdapter({}) }),
});
