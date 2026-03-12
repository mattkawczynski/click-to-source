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
  stopProcessTree,
  writeFiles,
  packPackage,
} = require("./smoke-helpers.cjs");

const PNPM_VERSION = "9.15.0";

async function cleanupTempRoot(root) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!error || error.code !== "EBUSY") {
        throw error;
      }
      if (attempt === 9) {
        console.warn(`Workspace smoke cleanup skipped for locked temp dir: ${root}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

function toImportPath(fromDir, toFile) {
  const relative = path.relative(fromDir, toFile).replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function createWorkspaceFiles(spec, port, tarballName) {
  const sharedFile = "packages/shared/SharedMessage.jsx";
  const appSrcDir = path.posix.join(spec.appDir.replace(/\\/g, "/"), "src");
  const relativeSharedImport = toImportPath(appSrcDir, sharedFile);
  const relativeTarball = toImportPath(spec.appDir.replace(/\\/g, "/"), tarballName);

  const files = {
    "package.json": JSON.stringify(spec.rootPackage(port), null, 2),
    [`${spec.appDir}/package.json`]: JSON.stringify(
      {
        name: spec.packageName,
        private: true,
        type: "module",
        scripts: {
          dev: `vite --host 127.0.0.1 --port ${port}`,
          build: "vite build",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.7.0",
          "click-to-source": `file:${relativeTarball}`,
          vite: "^6.4.1",
        },
      },
      null,
      2,
    ),
    [`${spec.appDir}/index.html`]: [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `    <title>${spec.name} workspace smoke test</title>`,
      "  </head>",
      "  <body>",
      '    <div id="root"></div>',
      '    <script type="module" src="/src/main.jsx"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    [`${spec.appDir}/src/main.jsx`]: [
      'import React from "react";',
      'import ReactDOM from "react-dom/client";',
      'import App from "./App";',
      'import "click-to-source/init";',
      "",
      'ReactDOM.createRoot(document.getElementById("root")).render(',
      "  <React.StrictMode>",
      "    <App />",
      "  </React.StrictMode>",
      ");",
      "",
    ].join("\n"),
    [`${spec.appDir}/src/App.jsx`]: [
      `import { SharedMessage } from "${relativeSharedImport}";`,
      "",
      "export default function App() {",
      "  return (",
      '    <main className="app-shell">',
      `      <h1>${spec.name} Workspace Smoke Test</h1>`,
      "      <SharedMessage />",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    [`${spec.appDir}/vite.config.js`]: [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      'import { clickToSourceReact } from "click-to-source/vite";',
      "",
      "export default defineConfig({",
      "  plugins: [",
      "    react(),",
      "    clickToSourceReact({ allowOutsideWorkspace: true }),",
      "  ],",
      "});",
      "",
    ].join("\n"),
    "packages/shared/package.json": JSON.stringify(
      {
        name: "@acme/shared",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
    [sharedFile]: [
      "export function SharedMessage() {",
      "  return (",
      '    <section className="shared-card">',
      "      <p>Shared package element</p>",
      "    </section>",
      "  );",
      "}",
      "",
    ].join("\n"),
  };

  return { ...files, ...spec.extraFiles(port) };
}

function assertWorkspaceSetup(repoRoot, spec) {
  const appRoot = path.join(repoRoot, spec.appDir);
  const mainFile = fs.readFileSync(path.join(appRoot, "src", "main.jsx"), "utf8");
  const viteConfig = fs.readFileSync(path.join(appRoot, "vite.config.js"), "utf8");

  assert(
    mainFile.includes('import "click-to-source/init";'),
    `${spec.name}: init import missing from entry file.`,
  );
  assert(
    viteConfig.includes("clickToSourceReact({ allowOutsideWorkspace: true })"),
    `${spec.name}: Vite config is missing allowOutsideWorkspace support.`,
  );
}

function buildCommandForSpec(spec, phase, port) {
  switch (spec.tool) {
    case "pnpm":
      if (phase === "install") {
        return {
          command: "npx",
          args: ["--yes", `pnpm@${PNPM_VERSION}`, "install", "--no-frozen-lockfile"],
          cwdType: "repo",
        };
      }
      if (phase === "build") {
        return {
          command: "npx",
          args: ["--yes", `pnpm@${PNPM_VERSION}`, "--filter", spec.packageName, "build"],
          cwdType: "repo",
        };
      }
      return {
        command: "npx",
        args: ["--yes", `pnpm@${PNPM_VERSION}`, "--filter", spec.packageName, "dev"],
        cwdType: "repo",
      };

    case "turbo":
      if (phase === "install") {
        return {
          command: "npx",
          args: ["--yes", `pnpm@${PNPM_VERSION}`, "install", "--no-frozen-lockfile"],
          cwdType: "repo",
        };
      }
      if (phase === "build") {
        return {
          command: "npx",
          args: [
            "--yes",
            `pnpm@${PNPM_VERSION}`,
            "exec",
            "turbo",
            "run",
            "build",
            "--filter",
            spec.packageName,
          ],
          cwdType: "repo",
        };
      }
      return {
        command: "npx",
        args: [
          "--yes",
          `pnpm@${PNPM_VERSION}`,
          "exec",
          "turbo",
          "run",
          "dev",
          "--filter",
          spec.packageName,
        ],
        cwdType: "repo",
      };

    case "nx":
      if (phase === "install") {
        return {
          command: npmCommand,
          args: ["install", "--no-fund", "--no-audit"],
          cwdType: "repo",
        };
      }
      if (phase === "build") {
        return {
          command: "npx",
          args: ["nx", "run", `${spec.projectName}:build`],
          cwdType: "repo",
        };
      }
      return {
        command: "npx",
        args: ["nx", "run", `${spec.projectName}:dev`],
        cwdType: "repo",
      };

    default:
      throw new Error(`Unknown workspace tool: ${spec.tool}`);
  }
}

function runPhase(repoRoot, appRoot, spec, phase) {
  const command = buildCommandForSpec(spec, phase);
  const cwd = command.cwdType === "repo" ? repoRoot : appRoot;
  run(command.command, command.args, cwd);
}

function startDev(repoRoot, appRoot, spec) {
  const command = buildCommandForSpec(spec, "dev");
  const cwd = command.cwdType === "repo" ? repoRoot : appRoot;
  const invocation = createInvocation(command.command, command.args);
  return spawn(invocation.command, invocation.args, {
    cwd,
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function runWorkspaceSmokeCase(tempRoot, tarballName, spec) {
  const repoRoot = path.join(tempRoot, spec.dir);
  const appRoot = path.join(repoRoot, spec.appDir);
  const sharedSource = path.join(repoRoot, "packages", "shared", "SharedMessage.jsx");
  const normalizedSharedSource = normalizePath(sharedSource);
  let child;

  try {
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.copyFileSync(path.join(tempRoot, tarballName), path.join(repoRoot, tarballName));
    writeFiles(repoRoot, createWorkspaceFiles(spec, spec.port, tarballName));
    runPhase(repoRoot, appRoot, spec, "install");
    assertWorkspaceSetup(repoRoot, spec);
    runPhase(repoRoot, appRoot, spec, "build");

    for (const filePath of getFiles(path.join(appRoot, "dist"))) {
      const content = fs.readFileSync(filePath, "utf8");
      assert(
        !content.includes(normalizedSharedSource),
        `${spec.name}: production output should not leak outside-workspace source locations: ${filePath}`,
      );
    }

    const logs = [];
    child = startDev(repoRoot, appRoot, spec);
    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const transformedShared = await waitForText(
      `http://127.0.0.1:${spec.port}/@fs/${normalizedSharedSource}`,
      child,
      logs,
      120000,
    );

    assert(
      transformedShared.includes("data-click-to-source"),
      `${spec.name}: shared module was not instrumented.\n${logs.join("")}`,
    );
    assert(
      /SharedMessage\.jsx:3:\d+/.test(transformedShared),
      `${spec.name}: shared module source metadata was unexpected.\n${logs.join("")}\n${transformedShared}`,
    );

    const response = await fetch(
      `http://127.0.0.1:${spec.port}/__click_to_source/open?file=${encodeURIComponent(normalizedSharedSource)}&line=3&column=5&editor=vscode`,
    );
    const payload = await response.json();

    assert(
      response.ok && typeof payload.ok === "boolean",
      `${spec.name}: open endpoint did not allow outside-workspace source.\n${logs.join("")}`,
    );
  } finally {
    stopProcessTree(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-monorepo-"));

  try {
    const tarballName = packPackage(tempRoot);
    const specs = [
      {
        name: "pnpm-workspace",
        dir: "pnpm-workspace",
        tool: "pnpm",
        packageName: "@acme/app",
        appDir: "packages/app",
        port: await findFreePort(),
        rootPackage() {
          return {
            name: "click-to-source-smoke-pnpm",
            private: true,
            packageManager: `pnpm@${PNPM_VERSION}`,
          };
        },
        extraFiles() {
          return {
            "pnpm-workspace.yaml": ["packages:", '  - "packages/*"', ""].join("\n"),
          };
        },
      },
      {
        name: "turbo-monorepo",
        dir: "turbo-monorepo",
        tool: "turbo",
        packageName: "@acme/web",
        appDir: "packages/web",
        port: await findFreePort(),
        rootPackage() {
          return {
            name: "click-to-source-smoke-turbo",
            private: true,
            packageManager: `pnpm@${PNPM_VERSION}`,
            devDependencies: {
              turbo: "^2.8.15",
            },
          };
        },
        extraFiles() {
          return {
            "pnpm-workspace.yaml": ["packages:", '  - "packages/*"', ""].join("\n"),
            "turbo.json": JSON.stringify(
              {
                $schema: "https://turbo.build/schema.json",
                tasks: {
                  build: {
                    dependsOn: ["^build"],
                    outputs: ["dist/**"],
                  },
                  dev: {
                    cache: false,
                    persistent: true,
                  },
                },
              },
              null,
              2,
            ),
          };
        },
      },
      {
        name: "nx-workspace",
        dir: "nx-workspace",
        tool: "nx",
        projectName: "web",
        packageName: "@acme/web",
        appDir: "apps/web",
        port: await findFreePort(),
        rootPackage() {
          return {
            name: "click-to-source-smoke-nx",
            private: true,
            workspaces: ["apps/*", "packages/*"],
            devDependencies: {
              nx: "^22.5.4",
            },
          };
        },
        extraFiles() {
          return {
            "nx.json": JSON.stringify(
              {
                $schema: "./node_modules/nx/schemas/nx-schema.json",
                workspaceLayout: {
                  appsDir: "apps",
                  libsDir: "packages",
                },
              },
              null,
              2,
            ),
            "apps/web/project.json": JSON.stringify(
              {
                name: "web",
                root: "apps/web",
                sourceRoot: "apps/web/src",
                projectType: "application",
                targets: {
                  build: {
                    executor: "nx:run-commands",
                    options: {
                      cwd: "apps/web",
                      command: "npm run build",
                    },
                  },
                  dev: {
                    executor: "nx:run-commands",
                    options: {
                      cwd: "apps/web",
                      command: "npm run dev",
                    },
                  },
                },
              },
              null,
              2,
            ),
          };
        },
      },
    ];

    for (const spec of specs) {
      await runWorkspaceSmokeCase(tempRoot, tarballName, spec);
    }

    console.log("Workspace smoke tests passed.");
  } finally {
    await cleanupTempRoot(tempRoot);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
