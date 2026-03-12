import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  patchBundlerConfig,
  patchViteConfig,
  runCli,
  runSetup,
} from "../src/cli.ts";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("runSetup patches a Vite React app and stays idempotent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-react-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "tmp-react-app",
        private: true,
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          vite: "^6.4.1",
          "@vitejs/plugin-react": "^4.7.0",
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(root, "src", "main.tsx"),
    [
      "import React from 'react';",
      "import ReactDOM from 'react-dom/client';",
      "import App from './App';",
      "",
      "ReactDOM.createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(root, "vite.config.ts"),
    [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      "  plugins: [react()],",
      "});",
      "",
    ].join("\n")
  );

  const logs: string[] = [];
  const result = runSetup(root, (message) => logs.push(message));

  assert.equal(result.framework, "react");
  assert.equal(result.bundler, "vite");
  assert.equal(result.entryUpdated, true);
  assert.equal(result.configUpdated, true);

  const entryFile = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
  const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");

  assert.match(entryFile, /import "click-to-source\/init";/);
  assert.match(viteConfig, /import \{ clickToSourceReact \} from "click-to-source\/vite";/);
  assert.match(viteConfig, /clickToSourceReact\(\)/);
  assert.match(viteConfig, /react\(\)/);
  assert.equal(countOccurrences(viteConfig, "clickToSourceReact()"), 1);
  assert.equal(countOccurrences(viteConfig, "react()"), 1);

  const secondLogs: string[] = [];
  const secondResult = runSetup(root, (message) => secondLogs.push(message));
  const secondEntryFile = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
  const secondViteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");

  assert.equal(secondResult.entryUpdated, false);
  assert.equal(secondResult.configUpdated, true);
  assert.equal(countOccurrences(secondEntryFile, 'import "click-to-source/init";'), 1);
  assert.equal(countOccurrences(secondViteConfig, "clickToSourceReact()"), 1);
  assert.ok(logs.some((message) => message.includes("Updated vite.config.ts")));
});

test("patchViteConfig preserves existing react options and adds clickToSourceReact", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-react-options-"));
  const configPath = path.join(root, "vite.config.ts");

  fs.writeFileSync(
    configPath,
    [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      '  plugins: [react({ jsxImportSource: "@emotion/react" })],',
      "});",
      "",
    ].join("\n")
  );

  const updated = patchViteConfig(configPath, "react");
  const config = fs.readFileSync(configPath, "utf8");

  assert.equal(updated, true);
  assert.match(config, /react\(\{ jsxImportSource: "@emotion\/react" \}\)/);
  assert.match(config, /clickToSourceReact\(\)/);
});

test("patchViteConfig replaces vue() with clickToSourceVue() and preserves options", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-vue-options-"));
  const configPath = path.join(root, "vite.config.ts");

  fs.writeFileSync(
    configPath,
    [
      'import { defineConfig } from "vite";',
      'import vue from "@vitejs/plugin-vue";',
      "",
      "export default defineConfig({",
      '  plugins: [vue({ template: { transformAssetUrls: false } })],',
      "});",
      "",
    ].join("\n")
  );

  const updated = patchViteConfig(configPath, "vue");
  const config = fs.readFileSync(configPath, "utf8");

  assert.equal(updated, true);
  assert.match(config, /import \{ clickToSourceVue \} from "click-to-source\/vite";/);
  assert.doesNotMatch(config, /@vitejs\/plugin-vue/);
  assert.match(
    config,
    /clickToSourceVue\(\{ vue: \{ template: \{ transformAssetUrls: false \} \} \}\)/
  );
  assert.doesNotMatch(config, /\bvue\(/);
});

test("patchViteConfig replaces svelte() with clickToSourceSvelte() and preserves options", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-svelte-options-"));
  const configPath = path.join(root, "vite.config.js");

  fs.writeFileSync(
    configPath,
    [
      'import { defineConfig } from "vite";',
      'import { svelte } from "@sveltejs/vite-plugin-svelte";',
      "",
      "export default defineConfig({",
      '  plugins: [svelte({ compilerOptions: { dev: true } })],',
      "});",
      "",
    ].join("\n")
  );

  const updated = patchViteConfig(configPath, "svelte");
  const config = fs.readFileSync(configPath, "utf8");

  assert.equal(updated, true);
  assert.match(config, /import \{ clickToSourceSvelte \} from "click-to-source\/vite";/);
  assert.doesNotMatch(config, /@sveltejs\/vite-plugin-svelte/);
  assert.match(
    config,
    /clickToSourceSvelte\(\{ svelte: \{ compilerOptions: \{ dev: true \} \} \}\)/
  );
  assert.doesNotMatch(config, /\bsvelte\(/);
});

test("patchViteConfig explains manual steps when the plugins field is not an inline array", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-vite-manual-"));
  const configPath = path.join(root, "vite.config.ts");
  const logs: string[] = [];

  fs.writeFileSync(
    configPath,
    [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "const plugins = [react()];",
      "",
      "export default defineConfig({",
      "  plugins,",
      "});",
      "",
    ].join("\n")
  );

  const updated = patchViteConfig(configPath, "react", (message) =>
    logs.push(message)
  );

  assert.equal(updated, false);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /not declared as an inline array/i);
  assert.match(logs[0], /Manual Vite setup:/);
  assert.match(logs[0], /clickToSourceReact/);
  assert.match(logs[0], /click-to-source\/init/);
});

test("runSetup patches Angular builder configuration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-angular-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "tmp-angular-app",
        private: true,
        dependencies: {
          "@angular/core": "^20.0.0",
        },
        devDependencies: {
          "@angular/cli": "^20.0.0",
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    [
      "import { bootstrapApplication } from '@angular/platform-browser';",
      "",
      "bootstrapApplication({});",
      "",
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(root, "angular.json"),
    JSON.stringify(
      {
        projects: {
          app: {
            architect: {
              serve: {
                builder: "@angular-devkit/build-angular:dev-server",
                options: {},
              },
            },
          },
        },
      },
      null,
      2
    )
  );

  const result = runSetup(root, () => {});
  const entryFile = fs.readFileSync(path.join(root, "src", "main.ts"), "utf8");
  const angularConfig = JSON.parse(
    fs.readFileSync(path.join(root, "angular.json"), "utf8")
  ) as {
    projects: {
      app: {
        architect: {
          serve: {
            builder: string;
            options: {
              clickToSource?: object;
            };
          };
        };
      };
    };
  };

  assert.equal(result.framework, "angular");
  assert.equal(result.bundler, "angular");
  assert.equal(result.entryUpdated, true);
  assert.equal(result.configUpdated, true);
  assert.match(entryFile, /import "click-to-source\/init";/);
  assert.equal(
    angularConfig.projects.app.architect.serve.builder,
    "click-to-source:dev-server"
  );
  assert.deepEqual(
    angularConfig.projects.app.architect.serve.options.clickToSource,
    {}
  );
});

test("patchBundlerConfig wraps a webpack config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-webpack-config-"));
  const configPath = path.join(root, "webpack.config.cjs");

  fs.writeFileSync(
    configPath,
    [
      'const path = require("node:path");',
      "",
      "module.exports = {",
      '  entry: "./src/index.jsx",',
      "  output: {",
      '    path: path.resolve(__dirname, "dist"),',
      '    filename: "bundle.js",',
      "  },",
      "};",
      "",
    ].join("\n")
  );

  const updated = patchBundlerConfig(configPath, "webpack");
  const config = fs.readFileSync(configPath, "utf8");

  assert.equal(updated, true);
  assert.match(config, /require\("click-to-source\/webpack"\)/);
  assert.match(config, /module\.exports = \(_env, argv\) => \{/);
  assert.match(config, /if \(config\.mode == null && argv\?\.mode\)/);
  assert.match(config, /return withClickToSource\(config\);/);
});

test("patchBundlerConfig explains manual steps when the export is not a plain object", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-webpack-manual-"));
  const configPath = path.join(root, "webpack.config.cjs");
  const logs: string[] = [];

  fs.writeFileSync(
    configPath,
    [
      "function createConfig() {",
      "  return {",
      '    entry: "./src/index.jsx",',
      "  };",
      "}",
      "",
      "module.exports = createConfig();",
      "",
    ].join("\n")
  );

  const updated = patchBundlerConfig(configPath, "webpack", (message) =>
    logs.push(message)
  );

  assert.equal(updated, false);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /not a plain object literal/i);
  assert.match(logs[0], /Manual webpack setup:/);
  assert.match(logs[0], /withClickToSource/);
  assert.match(logs[0], /click-to-source\/init/);
});

test("runSetup patches webpack projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-webpack-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "tmp-webpack-app",
        private: true,
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          webpack: "^5.0.0",
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(root, "src", "index.jsx"),
    [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'createRoot(document.getElementById("root")).render(<div>Hello</div>);',
      "",
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(root, "webpack.config.cjs"),
    [
      "module.exports = {",
      '  entry: "./src/index.jsx",',
      "};",
      "",
    ].join("\n")
  );

  const result = runSetup(root, () => {});
  const entryFile = fs.readFileSync(path.join(root, "src", "index.jsx"), "utf8");
  const config = fs.readFileSync(path.join(root, "webpack.config.cjs"), "utf8");

  assert.equal(result.framework, "react");
  assert.equal(result.bundler, "webpack");
  assert.equal(result.entryUpdated, true);
  assert.equal(result.configUpdated, true);
  assert.match(entryFile, /import "click-to-source\/init";/);
  assert.match(config, /require\("click-to-source\/webpack"\)/);
  assert.match(config, /return withClickToSource\(config\);/);
});

test("runSetup patches rspack projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-rspack-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "tmp-rspack-app",
        private: true,
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@rspack/core": "^1.0.0",
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(root, "src", "index.jsx"),
    [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'createRoot(document.getElementById("root")).render(<div>Hello</div>);',
      "",
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(root, "rspack.config.cjs"),
    [
      "module.exports = {",
      '  entry: "./src/index.jsx",',
      "};",
      "",
    ].join("\n")
  );

  const result = runSetup(root, () => {});
  const entryFile = fs.readFileSync(path.join(root, "src", "index.jsx"), "utf8");
  const config = fs.readFileSync(path.join(root, "rspack.config.cjs"), "utf8");

  assert.equal(result.framework, "react");
  assert.equal(result.bundler, "rspack");
  assert.equal(result.entryUpdated, true);
  assert.equal(result.configUpdated, true);
  assert.match(entryFile, /import "click-to-source\/init";/);
  assert.match(config, /require\("click-to-source\/rspack"\)/);
  assert.match(config, /return withClickToSource\(config\);/);
});

test("runCli returns a non-zero exit code for invalid usage", () => {
  const logs: string[] = [];
  const exitCode = runCli(["unknown-command"], process.cwd(), (message) =>
    logs.push(message)
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(logs, ["Usage: click-to-source setup"]);
});

test("runSetup explains manual entry and config setup when files are missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-cli-missing-files-"));
  const logs: string[] = [];

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "tmp-react-app",
        private: true,
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          vite: "^6.4.1",
          "@vitejs/plugin-react": "^4.7.0",
        },
      },
      null,
      2
    )
  );

  const result = runSetup(root, (message) => logs.push(message));

  assert.equal(result.entryFile, null);
  assert.equal(result.entryUpdated, false);
  assert.equal(result.configUpdated, false);
  assert.ok(logs.some((message) => /Manual entry setup:/i.test(message)));
  assert.ok(logs.some((message) => /Manual Vite setup:/i.test(message)));
});
