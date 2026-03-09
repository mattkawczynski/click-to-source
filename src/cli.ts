import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export type Framework = "react" | "vue" | "svelte" | "angular" | "unknown";
export type Bundler = "vite" | "webpack" | "rspack" | "angular" | "unknown";
type Logger = (message: string) => void;

export interface SetupResult {
  framework: Framework;
  bundler: Bundler;
  entryFile: string | null;
  entryUpdated: boolean;
  configUpdated: boolean;
}

function log(message: string): void {
  console.log(`[click-to-source] ${message}`);
}

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function detectFramework(deps: Record<string, string>): Framework {
  if (deps["@angular/core"]) return "angular";
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps.svelte || deps["@sveltejs/kit"]) return "svelte";
  return "unknown";
}

export function detectBundler(deps: Record<string, string>): Bundler {
  if (deps.vite) return "vite";
  if (deps["@angular/cli"]) return "angular";
  if (deps["@rspack/core"]) return "rspack";
  if (deps.webpack) return "webpack";
  return "unknown";
}

export function findEntryFile(root: string, framework: Framework): string | null {
  const candidates: string[] = [];

  if (framework === "angular") {
    candidates.push("src/main.ts");
  }

  candidates.push(
    "src/main.tsx",
    "src/main.ts",
    "src/index.tsx",
    "src/index.ts",
    "src/app.tsx",
    "src/app.ts",
    "src/main.jsx",
    "src/main.js",
    "src/index.jsx",
    "src/index.js"
  );

  for (const rel of candidates) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function ensureImport(filePath: string, statement: string): boolean {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(statement)) return false;

  const lines = content.split(/\r?\n/);
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith("import")) {
    insertAt += 1;
  }
  lines.splice(insertAt, 0, statement);
  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
}

export function findViteConfig(root: string): string | null {
  const candidates = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
  ];
  for (const file of candidates) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function patchViteConfig(
  filePath: string,
  framework: Framework,
  logger: Logger = log
): boolean {
  const content = fs.readFileSync(filePath, "utf8");
  const isCjs =
    filePath.endsWith(".cjs") ||
    content.includes("module.exports") ||
    content.includes("require(");

  const pluginName =
    framework === "react"
      ? "clickToSourceReact"
      : framework === "vue"
      ? "clickToSourceVue"
      : framework === "svelte"
      ? "clickToSourceSvelte"
      : "clickToSource";

  let updated = content;

  if (!updated.includes("click-to-source/vite")) {
    if (isCjs) {
      const requireLine = `const { ${pluginName} } = require("click-to-source/vite");`;
      updated = `${requireLine}\n${updated}`;
    } else {
      const importLine = `import { ${pluginName} } from "click-to-source/vite";`;
      updated = `${importLine}\n${updated}`;
    }
  }

  if (framework === "vue" || framework === "svelte") {
    const replacementName =
      framework === "vue" ? "clickToSourceVue" : "clickToSourceSvelte";
    const originalName = framework === "vue" ? "vue" : "svelte";
    const callInfo = findCallExpression(updated, originalName);

    if (callInfo) {
      const args = callInfo.args.trim();
      const replacement =
        args.length > 0
          ? `${replacementName}({ ${framework}: ${args} })`
          : `${replacementName}()`;
      updated =
        updated.slice(0, callInfo.start) +
        replacement +
        updated.slice(callInfo.end);
      updated = removeUnusedFrameworkImport(updated, framework);
    }
  }

  const alreadyHasPlugin = updated.includes(`${pluginName}(`);
  const pluginsRegex = /plugins\s*:\s*\[/;
  if (!alreadyHasPlugin) {
    if (pluginsRegex.test(updated)) {
      updated = updated.replace(
        pluginsRegex,
        (match) => `${match}\n    ${pluginName}(),`
      );
    } else {
      logger(
        "Could not find plugins array in Vite config. Please add the plugin manually."
      );
      return false;
    }
  }

  fs.writeFileSync(filePath, updated);
  return true;
}

function findCallExpression(
  source: string,
  callee: string
): { start: number; end: number; args: string } | null {
  const match = new RegExp(`\\b${callee}\\s*\\(`).exec(source);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const openParen = source.indexOf("(", start);
  if (openParen === -1) return null;

  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char as '"' | "'" | "`";
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          end: index + 1,
          args: source.slice(openParen + 1, index),
        };
      }
    }
  }

  return null;
}

function removeUnusedFrameworkImport(source: string, framework: Framework): string {
  if (framework === "vue" && !/\bvue\s*\(/.test(source)) {
    return source.replace(
      /^\s*import\s+vue\s+from\s+["']@vitejs\/plugin-vue["'];?\r?\n?/m,
      ""
    );
  }

  if (framework === "svelte" && !/\bsvelte\s*\(/.test(source)) {
    return source.replace(
      /^\s*import\s+\{\s*svelte\s*\}\s+from\s+["']@sveltejs\/vite-plugin-svelte["'];?\r?\n?/m,
      ""
    );
  }

  return source;
}

export function patchAngularConfig(root: string): boolean {
  const angularPath = path.join(root, "angular.json");
  if (!fs.existsSync(angularPath)) return false;
  const config = readJson(angularPath);
  if (!config || !config.projects) return false;

  Object.values<any>(config.projects).forEach((project) => {
    if (!project.architect?.serve) return;
    project.architect.serve.builder = "click-to-source:dev-server";
    project.architect.serve.options = project.architect.serve.options || {};
    project.architect.serve.options.clickToSource =
      project.architect.serve.options.clickToSource || {};
  });

  fs.writeFileSync(angularPath, JSON.stringify(config, null, 2));
  return true;
}

export function runSetup(root = process.cwd(), logger: Logger = log): SetupResult {
  const pkg = readJson(path.join(root, "package.json"));
  if (!pkg) {
    throw new Error("No package.json found. Run this from your project root.");
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const framework = detectFramework(deps);
  const bundler = detectBundler(deps);

  const entryFile = findEntryFile(root, framework);
  let entryUpdated = false;
  if (entryFile) {
    entryUpdated = ensureImport(entryFile, `import "click-to-source/init";`);
    logger(
      entryUpdated
        ? `Added init import to ${path.relative(root, entryFile)}`
        : `Init import already present in ${path.relative(root, entryFile)}`
    );
  } else {
    logger("Could not find an entry file. Add `import \"click-to-source/init\";` manually.");
  }

  let configUpdated = false;
  if (bundler === "vite") {
    const viteConfig = findViteConfig(root);
    if (!viteConfig) {
      logger("Vite detected but no vite.config.* found. Add the plugin manually.");
    } else {
      configUpdated = patchViteConfig(viteConfig, framework, logger);
      if (configUpdated) {
        logger(`Updated ${path.relative(root, viteConfig)} with click-to-source plugin.`);
      }
    }
  } else if (bundler === "angular") {
    configUpdated = patchAngularConfig(root);
    if (configUpdated) {
      logger("Updated angular.json to use click-to-source dev-server builder.");
    } else {
      logger("Angular detected but could not update angular.json. Please add the builder manually.");
    }
  } else {
    logger(
      "Non-Vite/Angular bundler detected. Please configure click-to-source in your build tool."
    );
  }

  logger("Setup complete.");

  return {
    framework,
    bundler,
    entryFile,
    entryUpdated,
    configUpdated,
  };
}

export function runCli(
  argv = process.argv.slice(2),
  root = process.cwd(),
  logger: Logger = log
): number {
  const command = argv[0] || "setup";

  if (command === "setup") {
    try {
      runSetup(root, logger);
      return 0;
    } catch (error) {
      logger(
        error instanceof Error
          ? error.message
          : "Setup failed."
      );
      return 1;
    }
  }

  logger("Usage: click-to-source setup");
  return 1;
}

function isDirectExecution(argv = process.argv): boolean {
  const entry = argv[1];
  if (!entry) return false;

  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectExecution()) {
  process.exit(runCli());
}
