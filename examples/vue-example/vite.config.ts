import { defineConfig } from "vite";
import { clickToSourceVue } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceVue()],
  server: {
    port: 5174,
  },
});