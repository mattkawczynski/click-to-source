const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { execFileSync } = require("node:child_process");

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

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
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
    if (child && child.exitCode !== null) {
      throw new Error(`Dev server exited before becoming ready.\n${logs.join("")}`);
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

async function waitForContent(url, predicate, child, logs, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child && child.exitCode !== null) {
      throw new Error(`Dev server exited before becoming ready.\n${logs.join("")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (predicate(text)) {
          return text;
        }
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for matching content from ${url}.\n${logs.join("")}`);
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

function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
}

function packPackage(tempRoot) {
  run(npmCommand, ["pack", "--pack-destination", tempRoot], repoRoot);
  const tarballName = fs.readdirSync(tempRoot).find((entry) => entry.endsWith(".tgz"));
  assert(tarballName, "npm pack did not produce a tarball name.");
  return tarballName;
}

async function fetchScriptsFromHtml(baseUrl, html, child, logs, timeoutMs = 30000) {
  const matches = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)];
  assert(matches.length > 0, `No script tags found in HTML from ${baseUrl}.`);

  let combined = "";
  for (const match of matches) {
    const scriptUrl = new URL(match[1], baseUrl).href;
    combined += await waitForText(scriptUrl, child, logs, timeoutMs);
  }

  return combined;
}

module.exports = {
  repoRoot,
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
  fetchScriptsFromHtml,
};
