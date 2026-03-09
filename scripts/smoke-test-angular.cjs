const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  isWindows,
  npmCommand,
  createInvocation,
  run,
  assert,
  getFiles,
  normalizePath,
  findFreePort,
  waitForText,
  waitForContent,
  stopProcessTree,
  writeFiles,
  packPackage,
} = require("./smoke-helpers.cjs");

function createAngularFiles(tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-angular",
        private: true,
        scripts: {
          dev: "ng serve",
          build: "ng build",
        },
        dependencies: {
          "@angular/common": "^21.2.1",
          "@angular/compiler": "^21.2.1",
          "@angular/core": "^21.2.1",
          "@angular/platform-browser": "^21.2.1",
          "click-to-source": `file:../${tarballName}`,
          rxjs: "^7.8.2",
          tslib: "^2.8.1",
          "zone.js": "^0.16.1",
        },
        devDependencies: {
          "@angular-devkit/architect": "^0.2102.1",
          "@angular-devkit/build-angular": "^21.2.1",
          "@angular/cli": "^21.2.1",
          "@angular/compiler-cli": "^21.2.1",
          typescript: "~5.9.3",
        },
      },
      null,
      2,
    ),
    "angular.json": JSON.stringify(
      {
        $schema: "./node_modules/@angular/cli/lib/config/schema.json",
        version: 1,
        newProjectRoot: "projects",
        projects: {
          "click-to-source-smoke-angular": {
            projectType: "application",
            root: "",
            sourceRoot: "src",
            prefix: "app",
            architect: {
              build: {
                builder: "@angular-devkit/build-angular:browser",
                options: {
                  outputPath: "dist/click-to-source-smoke-angular",
                  index: "src/index.html",
                  main: "src/main.ts",
                  polyfills: ["zone.js"],
                  tsConfig: "tsconfig.app.json",
                  assets: [],
                  styles: ["src/styles.css"],
                  scripts: [],
                },
                configurations: {
                  production: {
                    optimization: true,
                    outputHashing: "all",
                    sourceMap: false,
                    extractLicenses: true,
                  },
                  development: {
                    optimization: false,
                    extractLicenses: false,
                    sourceMap: true,
                    vendorChunk: true,
                    namedChunks: true,
                    buildOptimizer: false,
                  },
                },
                defaultConfiguration: "development",
              },
              serve: {
                builder: "@angular-devkit/build-angular:dev-server",
                configurations: {
                  production: {
                    buildTarget: "click-to-source-smoke-angular:build:production",
                  },
                  development: {
                    buildTarget: "click-to-source-smoke-angular:build:development",
                  },
                },
                defaultConfiguration: "development",
              },
            },
          },
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compileOnSave: false,
        compilerOptions: {
          outDir: "./dist/out-tsc",
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          skipLibCheck: true,
          isolatedModules: true,
          experimentalDecorators: true,
          importHelpers: true,
          target: "ES2022",
          module: "ES2022",
          useDefineForClassFields: false,
          moduleResolution: "bundler",
          lib: ["ES2022", "dom"],
        },
        angularCompilerOptions: {
          strictTemplates: true,
          strictInjectionParameters: true,
        },
      },
      null,
      2,
    ),
    "tsconfig.app.json": JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          outDir: "./out-tsc/app",
          types: [],
        },
        files: ["src/main.ts"],
        include: ["src/**/*.d.ts"],
      },
      null,
      2,
    ),
    "src/index.html": [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="utf-8" />',
      "    <title>click-to-source Angular smoke test</title>",
      '    <base href="/" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
      "  </head>",
      "  <body>",
      "    <app-root></app-root>",
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/main.ts": [
      'import { bootstrapApplication } from "@angular/platform-browser";',
      'import { AppComponent } from "./app/app.component";',
      "",
      "bootstrapApplication(AppComponent).catch((error) => console.error(error));",
      "",
    ].join("\n"),
    "src/app/app.component.ts": [
      'import { Component, signal } from "@angular/core";',
      "",
      "@Component({",
      '  selector: "app-root",',
      "  standalone: true,",
      '  templateUrl: "./app.component.html",',
      '  styleUrl: "./app.component.css",',
      "})",
      "export class AppComponent {",
      "  readonly count = signal(0);",
      "",
      "  increment(): void {",
      "    this.count.update((value) => value + 1);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "src/app/app.component.html": [
      '<main class="app-shell">',
      "  <h1>Angular Smoke Test</h1>",
      "  <p>Ctrl+Click this paragraph to jump to app.component.html.</p>",
      '  <button type="button" (click)="increment()">Clicked {{ count() }} times</button>',
      "</main>",
      "",
    ].join("\n"),
    "src/app/app.component.css": [
      ".app-shell {",
      "  font-family: sans-serif;",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "",
    ].join("\n"),
    "src/styles.css": [
      "html, body {",
      "  margin: 0;",
      "  min-height: 100%;",
      "}",
      "",
      "body {",
      "  background: #f7f7f7;",
      "}",
      "",
    ].join("\n"),
  };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-angular-"));
  const appRoot = path.join(tempRoot, "angular-app");
  const port = await findFreePort();
  let child;

  try {
    const tarballName = packPackage(tempRoot);
    writeFiles(appRoot, createAngularFiles(tarballName));

    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(
      "node",
      [path.join("node_modules", "click-to-source", "dist", "cli.cjs"), "setup"],
      appRoot,
    );

    const mainFile = fs.readFileSync(path.join(appRoot, "src", "main.ts"), "utf8");
    const angularConfig = JSON.parse(fs.readFileSync(path.join(appRoot, "angular.json"), "utf8"));
    const serve = angularConfig.projects["click-to-source-smoke-angular"].architect.serve;

    assert(mainFile.includes('import "click-to-source/init";'), "Angular smoke setup did not add the init import.");
    assert(
      serve.builder === "click-to-source:dev-server",
      "Angular smoke setup did not replace the dev-server builder.",
    );
    assert(
      typeof serve.options === "object" && typeof serve.options.clickToSource === "object",
      "Angular smoke setup did not add clickToSource options.",
    );

    run(npmCommand, ["run", "build"], appRoot);

    const sourcePath = normalizePath(path.join(appRoot, "src", "app", "app.component.html"));
    for (const filePath of getFiles(path.join(appRoot, "dist"))) {
      const content = fs.readFileSync(filePath, "utf8");
      assert(
        !content.includes(sourcePath),
        `Angular smoke build leaked source locations: ${filePath}`,
      );
    }

    const logs = [];
    const devInvocation = createInvocation(npmCommand, [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    await waitForText(`http://127.0.0.1:${port}/`, child, logs, 120000);
    const bundleText = await waitForContent(
      `http://127.0.0.1:${port}/main.js`,
      (text) =>
        text.includes("data-click-to-source") &&
        text.includes("app.component.html:1:1"),
      child,
      logs,
      120000,
    );

    assert(
      bundleText.includes("app.component.html:4:3"),
      `Angular smoke dev bundle did not preserve button source metadata.\n${logs.join("")}`,
    );

    const response = await fetch(
      `http://127.0.0.1:${port}/__click_to_source/open?file=${encodeURIComponent("src/app/app.component.html")}&line=1&column=1&editor=vscode`,
    );
    const payload = await response.json();

    assert(
      response.ok && typeof payload.ok === "boolean",
      `Angular smoke open endpoint did not respond as expected.\n${logs.join("")}`,
    );

    console.log("Angular smoke test passed.");
  } finally {
    stopProcessTree(child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
