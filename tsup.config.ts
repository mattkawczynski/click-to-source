import { defineConfig } from "tsup";

const externals = [
  "@vitejs/plugin-react",
  "@vitejs/plugin-vue",
  "@sveltejs/vite-plugin-svelte",
  "@vue/compiler-core",
  "svelte",
  "magic-string",
  "parse5",
  "webpack",
  "@angular-devkit/architect",
  "@angular-devkit/build-angular",
];

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      init: "src/init.ts",
      vite: "src/vite-plugin.ts",
      babel: "src/babel-plugin.ts",
      vue: "src/vue.ts",
      svelte: "src/svelte.ts",
      webpack: "src/webpack.ts",
      rspack: "src/rspack.ts",
      "server/open-handler": "src/server/open-handler.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    shims: true,
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    external: externals,
  },
  {
    entry: {
      "angular/dev-server": "src/angular/dev-server.ts",
      "angular/template-loader": "src/angular/template-loader.ts",
    },
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    shims: true,
    platform: "node",
    external: externals,
  },
  {
    entry: {
      cli: "src/cli.ts",
    },
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    shims: true,
    platform: "node",
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: externals,
  },
]);
