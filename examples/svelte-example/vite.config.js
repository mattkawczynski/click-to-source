import { defineConfig } from "vite";
import { clickToSourceSvelte } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceSvelte()],
  server: {
    port: 5175,
  },
});