import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { clickToSourceReact } from "click-to-source/vite";

export default defineConfig({
  plugins: [
    react(),
    clickToSourceReact(),
  ],
  server: {
    port: 5173,
  },
})
