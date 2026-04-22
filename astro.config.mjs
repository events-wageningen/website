import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://events-wageningen.nl",
  base: process.env.ASTRO_BASE ?? "/",
  output: "static",
  integrations: [tailwind()],
});
