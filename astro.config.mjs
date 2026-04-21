import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://events-wageningen.nl",
  base: "/website",
  output: "static",
  integrations: [tailwind()],
});
