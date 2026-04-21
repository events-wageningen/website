import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://events-wageningen.nl",
  output: "static",
  integrations: [tailwind()],
});
