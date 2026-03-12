import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import clickToSourceAstro from "click-to-source/astro";

export default defineConfig({
  integrations: [react(), clickToSourceAstro({ framework: "react" })],
});
