const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { execFileSync, spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npmCommand = "npm";

function quoteWindowsArg(value) {
  if (!/[\s"]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function createInvocation(command, args) {
  if (!isWindows) {
    return { command, args };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")],
  };
}

function run(command, args, cwd) {
  const invocation = createInvocation(command, args);

  try {
    return execFileSync(invocation.command, invocation.args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout) : "";
    const stderr = error.stderr ? String(error.stderr) : "";
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForText(url, child, logs, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(
        `Dev server exited before becoming ready.\n${logs.join("")}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}.\n${logs.join("")}`);
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (isWindows) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } catch {}
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-"));
  const appRoot = path.join(tempRoot, "consumer-app");
  const srcRoot = path.join(appRoot, "src");
  let child;

  try {
    const port = await findFreePort();
    run(npmCommand, ["pack", "--pack-destination", tempRoot], repoRoot);
    const tarballName = fs
      .readdirSync(tempRoot)
      .find((entry) => entry.endsWith(".tgz"));

    assert(tarballName, "npm pack did not produce a tarball name.");

    fs.mkdirSync(srcRoot, { recursive: true });

    fs.writeFileSync(
      path.join(appRoot, "package.json"),
      JSON.stringify(
        {
          name: "click-to-source-smoke-app",
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
            "click-to-source": `file:../${tarballName}`,
            vite: "^6.4.1",
          },
        },
        null,
        2,
      ),
    );

    fs.writeFileSync(
      path.join(appRoot, "index.html"),
      [
        "<!doctype html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        "    <title>click-to-source smoke test</title>",
        "  </head>",
        "  <body>",
        '    <div id="root"></div>',
        '    <script type="module" src="/src/main.jsx"></script>',
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(srcRoot, "main.jsx"),
      [
        'import React from "react";',
        'import ReactDOM from "react-dom/client";',
        'import App from "./App";',
        "",
        'ReactDOM.createRoot(document.getElementById("root")).render(',
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>",
        ");",
        "",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(srcRoot, "App.jsx"),
      [
        "export default function App() {",
        "  return (",
        '    <main className="app-shell">',
        "      <h1>Smoke Test</h1>",
        '      <button type="button">Inspect me</button>',
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(appRoot, "vite.config.js"),
      [
        'import { defineConfig } from "vite";',
        'import react from "@vitejs/plugin-react";',
        "",
        "export default defineConfig({",
        "  plugins: [react()],",
        "});",
        "",
      ].join("\n"),
    );

    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(
      "node",
      [path.join("node_modules", "click-to-source", "dist", "cli.cjs"), "setup"],
      appRoot,
    );

    const mainFile = fs.readFileSync(path.join(srcRoot, "main.jsx"), "utf8");
    const viteConfig = fs.readFileSync(
      path.join(appRoot, "vite.config.js"),
      "utf8",
    );

    assert(
      mainFile.includes('import "click-to-source/init";'),
      "Smoke test setup did not add the init import.",
    );
    assert(
      viteConfig.includes(
        'import { clickToSourceReact } from "click-to-source/vite";',
      ),
      "Smoke test setup did not add the Vite plugin import.",
    );
    assert(
      viteConfig.includes("clickToSourceReact()"),
      "Smoke test setup did not add clickToSourceReact().",
    );

    run(npmCommand, ["run", "build"], appRoot);

    for (const filePath of getFiles(path.join(appRoot, "dist"))) {
      const content = fs.readFileSync(filePath, "utf8");
      assert(
        !content.includes("src/App.jsx"),
        `Production output should not leak source locations: ${filePath}`,
      );
    }

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const transformedModule = await waitForText(
      `http://127.0.0.1:${port}/src/App.jsx`,
      child,
      logs,
    );

    assert(
      transformedModule.includes("data-click-to-source"),
      `Dev transform did not inject data-click-to-source.\n${logs.join("")}`,
    );

    const response = await fetch(
      `http://127.0.0.1:${port}/__click_to_source/open?file=src/App.jsx&line=1&column=1&editor=vscode`,
    );
    const payload = await response.json();

    assert(
      response.ok && typeof payload.ok === "boolean",
      `Open endpoint did not respond as expected.\n${logs.join("")}`,
    );

    console.log("Smoke test passed.");
  } finally {
    stopProcessTree(child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
