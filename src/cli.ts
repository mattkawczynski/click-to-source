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

type ManualSetupTarget =
  | { kind: "vite"; framework: Framework; filePath?: string }
  | { kind: "bundler"; bundler: "webpack" | "rspack"; filePath?: string }
  | { kind: "angular" }
  | { kind: "entry"; framework: Framework };

function log(message: string): void {
  console.log(`[click-to-source] ${message}`);
}

function formatManualSetupHint(
  title: string,
  steps: string[]
): string {
  return [title, ...steps.map((step, index) => `${index + 1}. ${step}`)].join(
    "\n"
  );
}

function getEntryCandidates(framework: Framework): string[] {
  if (framework === "angular") {
    return ["src/main.ts"];
  }

  return ["src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts"];
}

function getVitePluginName(framework: Framework): string {
  return framework === "react"
    ? "clickToSourceReact"
    : framework === "vue"
    ? "clickToSourceVue"
    : framework === "svelte"
    ? "clickToSourceSvelte"
    : "clickToSource";
}

function getViteManualSnippet(framework: Framework): string {
  if (framework === "react") {
    return 'plugins: [react(), clickToSourceReact()]';
  }

  return `plugins: [${getVitePluginName(framework)}()]`;
}

function getManualSetupHint(target: ManualSetupTarget): string {
  if (target.kind === "entry") {
    return formatManualSetupHint("Manual entry setup:", [
      'Add `import "click-to-source/init";` to your app bootstrap file.',
      `Start with one of: ${getEntryCandidates(target.framework)
        .map((candidate) => `\`${candidate}\``)
        .join(", ")}.`,
      "Compare the exact bootstrap shape with the README Manual Setup section.",
    ]);
  }

  if (target.kind === "vite") {
    const fileLabel = target.filePath ? `\`${path.basename(target.filePath)}\`` : "`vite.config.*`";
    const pluginName = getVitePluginName(target.framework);

    return formatManualSetupHint("Manual Vite setup:", [
      `Open ${fileLabel} and import \`${pluginName}\` from \`click-to-source/vite\`.`,
      `Add \`${getViteManualSnippet(target.framework)}\` to the Vite plugins list.`,
      'Add `import "click-to-source/init";` to your entry file if it is not present already.',
      "Compare the result with the README Manual Setup section for your framework.",
    ]);
  }

  if (target.kind === "bundler") {
    const importPath =
      target.bundler === "webpack"
        ? "click-to-source/webpack"
        : "click-to-source/rspack";
    const configName = target.filePath
      ? `\`${path.basename(target.filePath)}\``
      : `\`${target.bundler}.config.*\``;

    return formatManualSetupHint(`Manual ${target.bundler} setup:`, [
      `Open ${configName} and import \`withClickToSource\` from \`${importPath}\`.`,
      "Wrap the exported config with `withClickToSource(...)` and preserve your existing `mode` handling for production builds.",
      'Add `import "click-to-source/init";` to your entry file if it is not present already.',
      "Compare the result with the README Manual Setup section for your bundler.",
    ]);
  }

  return formatManualSetupHint("Manual Angular setup:", [
    'Update `angular.json` so the `serve.builder` value is `click-to-source:dev-server`.',
    'Keep `src/main.ts` importing `click-to-source/init`.',
    "Compare the final shape with the README Manual Setup section for Angular.",
  ]);
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

export function findBundlerConfig(
  root: string,
  bundler: "webpack" | "rspack"
): string | null {
  const baseName = bundler === "webpack" ? "webpack.config" : "rspack.config";
  const candidates = [
    `${baseName}.js`,
    `${baseName}.cjs`,
    `${baseName}.mjs`,
    `${baseName}.ts`,
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
      const hasNonInlinePluginsField = /(^|[,{]\s*)plugins\s*(?::|,)/m.test(
        updated
      );
      const reason = hasNonInlinePluginsField
        ? "Vite config has a `plugins` field, but it is not declared as an inline array, so automatic patching would be unsafe."
        : "Could not find a `plugins` array in the Vite config.";
      logger(
        `${reason}\n${getManualSetupHint({
          kind: "vite",
          framework,
          filePath,
        })}`
      );
      return false;
    }
  }

  fs.writeFileSync(filePath, updated);
  return true;
}

export function patchBundlerConfig(
  filePath: string,
  bundler: "webpack" | "rspack",
  logger: Logger = log
): boolean {
  const content = fs.readFileSync(filePath, "utf8");
  const isCjs =
    filePath.endsWith(".cjs") ||
    content.includes("module.exports") ||
    content.includes("require(");
  const importPath =
    bundler === "webpack"
      ? "click-to-source/webpack"
      : "click-to-source/rspack";

  let updated = content;

  if (!updated.includes(importPath)) {
    const importLine = isCjs
      ? `const { withClickToSource } = require("${importPath}");`
      : `import { withClickToSource } from "${importPath}";`;
    updated = `${importLine}\n${updated}`;
  }

  if (updated.includes("withClickToSource(")) {
    fs.writeFileSync(filePath, updated);
    return true;
  }

  const wrappedModuleExport = wrapObjectExport(updated, "module.exports = ");
  if (wrappedModuleExport) {
    fs.writeFileSync(filePath, wrappedModuleExport);
    return true;
  }

  const wrappedDefaultExport = wrapObjectExport(updated, "export default ");
  if (wrappedDefaultExport) {
    fs.writeFileSync(filePath, wrappedDefaultExport);
    return true;
  }

  logger(
    `Could not safely patch ${path.basename(filePath)} because the exported config is not a plain object literal.\n${getManualSetupHint({
      kind: "bundler",
      bundler,
      filePath,
    })}`
  );
  return false;
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

function wrapObjectExport(
  source: string,
  assignment: string
): string | null {
  const assignmentIndex = source.indexOf(assignment);
  if (assignmentIndex === -1) return null;

  const openBraceIndex = source.indexOf("{", assignmentIndex + assignment.length);
  if (openBraceIndex === -1) return null;

  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
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

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const objectLiteral = source.slice(openBraceIndex, index + 1);
        const wrappedFactory = `(_env, argv) => {
  const config = ${objectLiteral};
  if (config.mode == null && argv?.mode) {
    config.mode = argv.mode;
  }
  return withClickToSource(config);
}`;
        return `${source.slice(0, assignmentIndex + assignment.length)}${wrappedFactory}${source.slice(index + 1)}`;
      }
    }
  }

  return null;
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
    logger(
      `Could not find an entry file automatically.\n${getManualSetupHint({
        kind: "entry",
        framework,
      })}`
    );
  }

  let configUpdated = false;
  if (bundler === "vite") {
    const viteConfig = findViteConfig(root);
    if (!viteConfig) {
      logger(
        `Vite detected but no vite.config.* file was found.\n${getManualSetupHint({
          kind: "vite",
          framework,
        })}`
      );
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
      logger(
        `Angular detected but angular.json could not be updated safely.\n${getManualSetupHint({
          kind: "angular",
        })}`
      );
    }
  } else if (bundler === "webpack" || bundler === "rspack") {
    const bundlerConfig = findBundlerConfig(root, bundler);
    if (!bundlerConfig) {
      logger(
        `${bundler} detected but no ${bundler}.config.* file was found.\n${getManualSetupHint({
          kind: "bundler",
          bundler,
        })}`
      );
    } else {
      configUpdated = patchBundlerConfig(bundlerConfig, bundler, logger);
      if (configUpdated) {
        logger(
          `Updated ${path.relative(root, bundlerConfig)} with withClickToSource().`
        );
      }
    }
  } else {
    logger(
      "Detected a project shape that click-to-source cannot patch automatically.\n" +
        getManualSetupHint({
          kind: "entry",
          framework,
        }) +
        "\nRead the README Manual Setup section for the integration that matches your build tool."
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
