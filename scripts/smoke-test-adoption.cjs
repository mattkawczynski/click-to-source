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
  fetchScriptsFromHtml,
} = require("./smoke-helpers.cjs");

function assertNoMarkers(rootDir, sourcePathPattern, name) {
  for (const filePath of getFiles(rootDir)) {
    if (!/\.(?:html|js|cjs|mjs|css)$/i.test(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    assert(
      !sourcePathPattern.test(content),
      `${name}: production output still contains source markers: ${filePath}`,
    );
  }
}

function nextFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-next",
        private: true,
        scripts: {
          dev: `next dev --hostname 127.0.0.1 --port ${port}`,
          build: "next build",
        },
        dependencies: {
          "@babel/runtime": "^7.28.4",
          "click-to-source": `file:../${tarballName}`,
          next: "^15.5.2",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@types/node": "^24.6.0",
          "@types/react": "^18.3.12",
          "@types/react-dom": "^18.3.1",
          typescript: "^5.9.3",
        },
      },
      null,
      2,
    ),
    "next.config.mjs": [
      'import withClickToSourceNext from "click-to-source/next";',
      "",
      "export default withClickToSourceNext({",
      "  reactStrictMode: true,",
      "});",
      "",
    ].join("\n"),
    "tsconfig.json": [
      "{",
      '  "compilerOptions": {',
      '    "target": "ES2020",',
      '    "lib": ["dom", "dom.iterable", "es2020"],',
      '    "allowJs": true,',
      '    "skipLibCheck": true,',
      '    "strict": true,',
      '    "forceConsistentCasingInFileNames": true,',
      '    "noEmit": true,',
      '    "esModuleInterop": true,',
      '    "module": "esnext",',
      '    "moduleResolution": "bundler",',
      '    "resolveJsonModule": true,',
      '    "isolatedModules": true,',
      '    "jsx": "preserve",',
      '    "incremental": true,',
      '    "plugins": [{ "name": "next" }]',
      "  },",
      '  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],',
      '  "exclude": ["node_modules"]',
      "}",
      "",
    ].join("\n"),
    "next-env.d.ts": [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      "",
    ].join("\n"),
    "app/click-to-source-client.tsx": [
      '"use client";',
      "",
      'import "click-to-source/next-init";',
      "",
      "export default function ClickToSourceClient() {",
      "  return null;",
      "}",
      "",
    ].join("\n"),
    "app/layout.tsx": [
      'import type { ReactNode } from "react";',
      'import ClickToSourceClient from "./click-to-source-client";',
      "",
      "export default function RootLayout({ children }: { children: ReactNode }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>",
      "        <ClickToSourceClient />",
      "        {children}",
      "      </body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "app/page.tsx": [
      "export default function HomePage() {",
      '  const items = ["Catalog", "Checkout"] as const;',
      "",
      "  return (",
      '    <main className="page-shell">',
      "      <h1>Next App Router Smoke</h1>",
      "      <p>Open this App Router page source.</p>",
      "      <ul>",
      "        {items.map((item) => (",
      "          <li key={item}>{item}</li>",
      "        ))}",
      "      </ul>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "pages/_app.tsx": [
      'import type { AppProps } from "next/app";',
      'import "click-to-source/next-init";',
      "",
      "export default function App({ Component, pageProps }: AppProps) {",
      "  return <Component {...pageProps} />;",
      "}",
      "",
    ].join("\n"),
    "pages/legacy.tsx": [
      "export default function LegacyPage() {",
      '  const details = ["Search", "Pricing"] as const;',
      "",
      "  return (",
      '    <main className="legacy-shell">',
      "      <h1>Next Pages Router Smoke</h1>",
      "      <p>Open this Pages Router page source.</p>",
      "      <div>",
      "        {details.map((detail) => (",
      "          <span key={detail}>{detail}</span>",
      "        ))}",
      "      </div>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "pages/api/__click_to_source/open.ts": [
      'import type { NextApiRequest, NextApiResponse } from "next";',
      'import { createOpenRequestHandler } from "click-to-source/server";',
      "",
      "const handler = createOpenRequestHandler({",
      '  path: "/api/__click_to_source/open",',
      "});",
      "",
      "export default function open(req: NextApiRequest, res: NextApiResponse) {",
      "  handler(req, res);",
      "}",
      "",
    ].join("\n"),
  };
}

function nuxtFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-nuxt",
        private: true,
        scripts: {
          dev: `nuxt dev --host 127.0.0.1 --port ${port}`,
          build: "nuxt build",
        },
        dependencies: {
          "click-to-source": `file:../${tarballName}`,
          nuxt: "^4.1.1",
          vue: "^3.5.0",
        },
      },
      null,
      2,
    ),
    "nuxt.config.ts": [
      'import { defineNuxtConfig } from "nuxt/config";',
      'import clickToSourceNuxt from "click-to-source/nuxt";',
      "",
      "export default defineNuxtConfig({",
      "  devtools: { enabled: false },",
      "  modules: [clickToSourceNuxt()],",
      "});",
      "",
    ].join("\n"),
    "app.vue": [
      "<template>",
      '  <main class="nuxt-shell">',
      "    <h1>Nuxt Smoke</h1>",
      "    <p>Open this Nuxt page source.</p>",
      '    <button type="button" @click="count += 1">Clicked {{ count }} times</button>',
      "  </main>",
      "</template>",
      "",
      '<script setup lang="ts">',
      'const count = ref(0);',
      "</script>",
      "",
      "<style scoped>",
      ".nuxt-shell {",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "</style>",
      "",
    ].join("\n"),
  };
}

function astroFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-astro",
        private: true,
        scripts: {
          dev: `astro dev --host 127.0.0.1 --port ${port}`,
          build: "astro build",
        },
        dependencies: {
          "@astrojs/react": "^4.4.0",
          astro: "^5.13.5",
          "click-to-source": `file:../${tarballName}`,
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
      },
      null,
      2,
    ),
    "astro.config.mjs": [
      'import { defineConfig } from "astro/config";',
      'import react from "@astrojs/react";',
      'import clickToSourceAstro from "click-to-source/astro";',
      "",
      "export default defineConfig({",
      "  integrations: [react(), clickToSourceAstro({ framework: \"react\" })],",
      "});",
      "",
    ].join("\n"),
    "src/pages/index.astro": [
      "---",
      'import DemoCard from "../components/DemoCard";',
      "---",
      "",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="utf-8" />',
      '    <meta name="viewport" content="width=device-width" />',
      '    <title>Astro Smoke</title>',
      "  </head>",
      "  <body>",
      '    <DemoCard client:load />',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/components/DemoCard.tsx": [
      "export default function DemoCard() {",
      '  const items = ["Preview", "Share"] as const;',
      "",
      "  return (",
      '    <main className="astro-shell">',
      "      <h1>Astro Smoke</h1>",
      "      <p>Open this Astro React island source.</p>",
      "      <ul>",
      "        {items.map((item) => (",
      "          <li key={item}>{item}</li>",
      "        ))}",
      "      </ul>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
  };
}

function storybookFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-storybook",
        private: true,
        scripts: {
          dev: `storybook dev --ci --host 127.0.0.1 --port ${port}`,
          build: "storybook build",
        },
        dependencies: {
          "click-to-source": `file:../${tarballName}`,
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^5.1.0",
          "@storybook/react-vite": "^9.1.5",
          storybook: "^9.1.5",
          typescript: "^5.9.3",
          vite: "^6.4.1",
        },
      },
      null,
      2,
    ),
    ".storybook/main.ts": [
      'import type { StorybookConfig } from "@storybook/react-vite";',
      'import { withClickToSourceStorybook } from "click-to-source/storybook";',
      "",
      "const config: StorybookConfig = withClickToSourceStorybook(",
      "  {",
      '    stories: ["../src/**/*.stories.@(ts|tsx)"],',
      '    framework: "@storybook/react-vite",',
      '    addons: [],',
      "  },",
      '  { framework: "react" },',
      ");",
      "",
      "export default config;",
      "",
    ].join("\n"),
    ".storybook/preview.ts": [
      'import type { Preview } from "@storybook/react-vite";',
      "",
      "const preview: Preview = {};",
      "",
      "export default preview;",
      "",
    ].join("\n"),
    "src/Button.tsx": [
      'import type { ButtonHTMLAttributes, ReactNode } from "react";',
      "",
      "type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {",
      "  children: ReactNode;",
      "};",
      "",
      "export function Button({ children, ...props }: ButtonProps) {",
      "  return (",
      '    <button type="button" className="story-button" {...props}>',
      "      {children}",
      "    </button>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "src/Button.stories.tsx": [
      'import type { Meta, StoryObj } from "@storybook/react-vite";',
      'import { Button } from "./Button";',
      "",
      "const meta = {",
      '  title: "CTA/Button",',
      "  component: Button,",
      '} satisfies Meta<typeof Button>;',
      "",
      "export default meta;",
      'type Story = StoryObj<typeof meta>;',
      "",
      "export const Primary: Story = {",
      "  args: {",
      '    children: "Storybook Smoke",',
      "  },",
      "};",
      "",
    ].join("\n"),
  };
}

async function runNextCase(tempRoot, tarballName) {
  const port = await findFreePort();
  const appRoot = path.join(tempRoot, "next-app");
  const appPage = normalizePath(path.join(appRoot, "app", "page.tsx"));
  const pagesRoute = normalizePath(path.join(appRoot, "pages", "legacy.tsx"));
  let child;

  try {
    writeFiles(appRoot, nextFiles(port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(npmCommand, ["run", "build"], appRoot);
    assertNoMarkers(path.join(appRoot, ".next"), /(app\/page\.tsx|pages\/legacy\.tsx):\d+:\d+/, "next");

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const homeHtml = await waitForContent(
      `http://127.0.0.1:${port}/`,
      (text) => text.includes("data-click-to-source") && text.includes("Next App Router Smoke"),
      child,
      logs,
      180000,
    );
    assert(homeHtml.includes(`${appPage}:5:5`), `next: app router page did not include expected source line.\n${logs.join("")}`);

    const legacyHtml = await waitForContent(
      `http://127.0.0.1:${port}/legacy`,
      (text) => text.includes("data-click-to-source") && text.includes("Next Pages Router Smoke"),
      child,
      logs,
      180000,
    );
    assert(legacyHtml.includes(`${pagesRoute}:5:5`), `next: pages router page did not include expected source line.\n${logs.join("")}`);

    const response = await fetch(
      `http://127.0.0.1:${port}/api/__click_to_source/open?file=${encodeURIComponent("app/page.tsx")}&line=5&column=5&editor=vscode`,
    );
    const payload = await response.json();
    assert(response.ok && typeof payload.ok === "boolean", `next: open endpoint did not respond.\n${logs.join("")}`);
  } finally {
    stopProcessTree(child);
  }
}

async function runNuxtCase(tempRoot, tarballName) {
  const port = await findFreePort();
  const appRoot = path.join(tempRoot, "nuxt-app");
  const sourceFile = normalizePath(path.join(appRoot, "app.vue"));
  let child;

  try {
    writeFiles(appRoot, nuxtFiles(port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(npmCommand, ["run", "build"], appRoot);
    const buildDir = fs.existsSync(path.join(appRoot, ".output")) ? path.join(appRoot, ".output") : path.join(appRoot, ".nuxt");
    assertNoMarkers(buildDir, /app\.vue:\d+:\d+/, "nuxt");

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const html = await waitForText(
      `http://127.0.0.1:${port}/`,
      child,
      logs,
      180000,
    );
    assert(html.includes("Nuxt Smoke"), `nuxt: root HTML did not render as expected.\n${logs.join("")}`);
    const entryAsync = await waitForText(
      `http://127.0.0.1:${port}/_nuxt/node_modules/nuxt/dist/app/entry.async.js`,
      child,
      logs,
      180000,
    );
    const entryMatch = entryAsync.match(/import\("([^\"]*entry\.js[^\"]*)"\)/);
    assert(entryMatch, `nuxt: could not locate the client entry script.\n${logs.join("")}\n${entryAsync}`);
    const entryModule = await waitForText(
      new URL(entryMatch[1], `http://127.0.0.1:${port}/`).href,
      child,
      logs,
      180000,
    );
    const pluginsMatch = entryModule.match(/import plugins from "([^\"]*plugins\.client\.mjs[^\"]*)"/);
    assert(
      pluginsMatch,
      `nuxt: client entry did not reference plugins.client.mjs.\n${logs.join("")}\n${entryModule}`,
    );
    const pluginsClient = await waitForText(
      new URL(pluginsMatch[1], `http://127.0.0.1:${port}/`).href,
      child,
      logs,
      180000,
    );
    assert(
      pluginsClient.includes("nuxt-plugin.mjs"),
      `nuxt: client plugin graph did not include click-to-source.\n${logs.join("")}\n${pluginsClient}`,
    );
    const moduleText = await waitForText(
      `http://127.0.0.1:${port}/_nuxt/@fs/${sourceFile}`,
      child,
      logs,
      180000,
    );
    assert(
      moduleText.includes("data-click-to-source"),
      `nuxt: transformed module did not inject data-click-to-source.\n${logs.join("")}`,
    );
    assert(
      /app\.vue:2:\d+/.test(moduleText),
      `nuxt: transformed module did not include the expected source line.\n${logs.join("")}\n${moduleText}`,
    );

  } finally {
    stopProcessTree(child);
  }
}

async function runAstroCase(tempRoot, tarballName) {
  const port = await findFreePort();
  const appRoot = path.join(tempRoot, "astro-app");
  const sourceFile = normalizePath(path.join(appRoot, "src", "components", "DemoCard.tsx"));
  let child;

  try {
    writeFiles(appRoot, astroFiles(port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(npmCommand, ["run", "build"], appRoot);
    assertNoMarkers(path.join(appRoot, "dist"), /DemoCard\.tsx:\d+:\d+/, "astro");

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const html = await waitForContent(
      `http://127.0.0.1:${port}/`,
      (text) => text.includes("data-click-to-source") && text.includes("Astro Smoke"),
      child,
      logs,
      180000,
    );
    assert(html.includes(`${sourceFile}:5:5`), `astro: island output did not include expected source line.\n${logs.join("")}`);

    const response = await fetch(
      `http://127.0.0.1:${port}/__click_to_source/open?file=${encodeURIComponent("src/components/DemoCard.tsx")}&line=5&column=5&editor=vscode`,
    );
    const payload = await response.json();
    assert(response.ok && typeof payload.ok === "boolean", `astro: open endpoint did not respond.\n${logs.join("")}`);
  } finally {
    stopProcessTree(child);
  }
}

async function runStorybookCase(tempRoot, tarballName) {
  const port = await findFreePort();
  const appRoot = path.join(tempRoot, "storybook-app");
  const sourceFile = normalizePath(path.join(appRoot, "src", "Button.tsx"));
  let child;

  try {
    writeFiles(appRoot, storybookFiles(port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(npmCommand, ["run", "build"], appRoot);
    assertNoMarkers(path.join(appRoot, "storybook-static"), /Button\.tsx:\d+:\d+/, "storybook");

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const iframeHtml = await waitForText(
      `http://127.0.0.1:${port}/iframe.html?id=cta-button--primary&viewMode=story`,
      child,
      logs,
      180000,
    );
    assert(
      iframeHtml.includes("storybook-root"),
      `storybook: iframe did not render as expected.\n${logs.join("")}`,
    );
    const moduleText = await waitForText(
      `http://127.0.0.1:${port}/src/Button.tsx`,
      child,
      logs,
      180000,
    );

    assert(
      moduleText.includes("data-click-to-source"),
      `storybook: transformed module did not inject data-click-to-source.\n${logs.join("")}`,
    );
    assert(
      /Button\.tsx:9:\d+/.test(moduleText),
      `storybook: transformed module did not include the expected source line.\n${logs.join("")}\n${moduleText}`,
    );

    const response = await fetch(
      `http://127.0.0.1:${port}/__click_to_source/open?file=${encodeURIComponent("src/Button.tsx")}&line=9&column=5&editor=vscode`,
    );
    const payload = await response.json();
    assert(response.ok && typeof payload.ok === "boolean", `storybook: open endpoint did not respond.\n${logs.join("")}`);
  } finally {
    stopProcessTree(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-adoption-"));

  try {
    const tarballName = packPackage(tempRoot);
    await runNextCase(tempRoot, tarballName);
    await runNuxtCase(tempRoot, tarballName);
    await runAstroCase(tempRoot, tarballName);
    await runStorybookCase(tempRoot, tarballName);
    console.log("Adoption smoke tests passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
