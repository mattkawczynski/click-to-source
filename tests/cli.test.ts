import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchViteConfig, runCli, runSetup } from "../src/cli.ts";

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
    "click-to-source/angular:dev-server"
  );
  assert.deepEqual(
    angularConfig.projects.app.architect.serve.options.clickToSource,
    {}
  );
});

test("runCli returns a non-zero exit code for invalid usage", () => {
  const logs: string[] = [];
  const exitCode = runCli(["unknown-command"], process.cwd(), (message) =>
    logs.push(message)
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(logs, ["Usage: click-to-source setup"]);
});
