import { defineNuxtConfig } from "nuxt/config";
import clickToSourceNuxt from "click-to-source/nuxt";

export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: [clickToSourceNuxt()],
});
