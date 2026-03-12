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

function createPackageJson(name, port, dependencies, devDependencies) {
  return JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: {
        dev: `vite --host 127.0.0.1 --port ${port}`,
        build: "vite build",
      },
      dependencies,
      devDependencies,
    },
    null,
    2,
  );
}

function createReactFiles(port, tarballName) {
  return {
    "package.json": createPackageJson(
      "click-to-source-smoke-react",
      port,
      {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      {
        "@vitejs/plugin-react": "^4.7.0",
        "click-to-source": `file:../${tarballName}`,
        vite: "^6.4.1",
      },
    ),
    "index.html": [
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
    "src/main.jsx": [
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
    "src/App.jsx": [
      "export default function App() {",
      '  const items = ["One", "Two"];',
      "  const showFooter = true;",
      "",
      "  return (",
      '    <main className="app-shell">',
      "      <h1>React Smoke Test</h1>",
      "      <section",
      '        className="panel"',
      '        data-kind="primary"',
      "      >",
      "        {items.map((item) => (",
      '          <button key={item} type="button">',
      "            {item}",
      "          </button>",
      "        ))}",
      "      </section>",
      "      {showFooter ? (",
      "        <footer>",
      "          <span>Footer</span>",
      "        </footer>",
      "      ) : null}",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "vite.config.js": [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      "  plugins: [react()],",
      "});",
      "",
    ].join("\n"),
  };
}

function createReactTsxFiles(port, tarballName) {
  return {
    "package.json": createPackageJson(
      "click-to-source-smoke-react-tsx",
      port,
      {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      {
        "@vitejs/plugin-react": "^4.7.0",
        "click-to-source": `file:../${tarballName}`,
        vite: "^6.4.1",
      },
    ),
    "index.html": [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      "    <title>click-to-source TSX smoke test</title>",
      "  </head>",
      "  <body>",
      '    <div id="root"></div>',
      '    <script type="module" src="/src/main.tsx"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/main.tsx": [
      'import React from "react";',
      'import ReactDOM from "react-dom/client";',
      'import App from "./App";',
      "",
      'ReactDOM.createRoot(document.getElementById("root")!).render(',
      "  <React.StrictMode>",
      "    <App />",
      "  </React.StrictMode>",
      ");",
      "",
    ].join("\n"),
    "src/App.tsx": [
      'import React from "react";',
      "",
      "type SlotProps = {",
      "  children: (label: string) => React.ReactNode;",
      "};",
      "",
      "function RenderSlot({ children }: SlotProps) {",
      '  return <section className="slot-shell">{children("slot-label")}</section>;',
      "}",
      "",
      'function Typography(props: React.ComponentProps<"p">) {',
      "  return <p {...props} />;",
      "}",
      "",
      "function ButtonRow({ children }: { children: React.ReactNode }) {",
      '  return <div className="button-row">{children}</div>;',
      "}",
      "",
      "export default function App() {",
      '  const items = ["Alpha", "Beta"] as const;',
      "",
      "  return (",
      "    <>",
      '      <Typography className="headline">',
      "        TSX Accuracy Smoke",
      "      </Typography>",
      "      <RenderSlot>",
      "        {(label) => (",
      "          <ButtonRow>",
      "            {items.map((item) => (",
      "              <button",
      "                key={item}",
      '                data-item={item}',
      '                type="button"',
      "              >",
      "                {label} {item}",
      "              </button>",
      "            ))}",
      "          </ButtonRow>",
      "        )}",
      "      </RenderSlot>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "vite.config.ts": [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      "  plugins: [react()],",
      "});",
      "",
    ].join("\n"),
    "tsconfig.json": [
      "{",
      '  "compilerOptions": {',
      '    "target": "ES2020",',
      '    "useDefineForClassFields": true,',
      '    "module": "ESNext",',
      '    "moduleResolution": "Node",',
      '    "jsx": "react-jsx",',
      '    "strict": true,',
      '    "resolveJsonModule": true,',
      '    "isolatedModules": true,',
      '    "esModuleInterop": true,',
      '    "lib": ["ES2020", "DOM", "DOM.Iterable"],',
      '    "types": ["vite/client"]',
      "  },",
      '  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]',
      "}",
      "",
    ].join("\n"),
  };
}

function createReactMuiFiles(port, tarballName) {
  return {
    "package.json": createPackageJson(
      "click-to-source-smoke-react-mui",
      port,
      {
        "@emotion/react": "^11.14.0",
        "@emotion/styled": "^11.14.1",
        "@mui/material": "^7.3.9",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      {
        "@vitejs/plugin-react": "^4.7.0",
        "click-to-source": `file:../${tarballName}`,
        typescript: "^5.9.3",
        vite: "^6.4.1",
      },
    ),
    "index.html": [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      "    <title>click-to-source MUI smoke test</title>",
      "  </head>",
      "  <body>",
      '    <div id="root"></div>',
      '    <script type="module" src="/src/main.tsx"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/main.tsx": [
      'import React from "react";',
      'import ReactDOM from "react-dom/client";',
      'import App from "./App";',
      "",
      'ReactDOM.createRoot(document.getElementById("root")!).render(',
      "  <React.StrictMode>",
      "    <App />",
      "  </React.StrictMode>",
      ");",
      "",
    ].join("\n"),
    "src/App.tsx": [
      'import React from "react";',
      'import Button from "@mui/material/Button";',
      'import MenuItem from "@mui/material/MenuItem";',
      'import Stack from "@mui/material/Stack";',
      'import TextField from "@mui/material/TextField";',
      'import Typography from "@mui/material/Typography";',
      "",
      'type Language = "en" | "pl";',
      "",
      'const supportedLanguages = ["en", "pl"] as const satisfies readonly Language[];',
      "",
      "const languageLabels: Record<Language, string> = {",
      '  en: "English",',
      '  pl: "Polski",',
      "};",
      "",
      "function Section(props: { children: React.ReactNode }) {",
      "  return (",
      "    <Stack",
      '      component="section"',
      "      spacing={2}",
      "      sx={{ maxWidth: 360, p: 3 }}",
      "    >",
      "      {props.children}",
      "    </Stack>",
      "  );",
      "}",
      "",
      "export default function App() {",
      '  const [language, setLanguage] = React.useState<Language>("en");',
      "",
      "  return (",
      "    <Section>",
      '      <Typography variant="h4">MUI Accuracy Smoke</Typography>',
      "      <TextField",
      "        select",
      '        label="Language"',
      "        value={language}",
      "        onChange={(event) =>",
      "          setLanguage(event.target.value as Language)",
      "        }",
      "      >",
      "        {supportedLanguages.map((lang) => (",
      "          <MenuItem",
      "            key={lang}",
      "            value={lang}",
      "            selected={language === lang}",
      "          >",
      "            {languageLabels[lang]}",
      "          </MenuItem>",
      "        ))}",
      "      </TextField>",
      '      <Button variant="contained" type="button">',
      "        Save changes",
      "      </Button>",
      "    </Section>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "vite.config.ts": [
      'import { defineConfig } from "vite";',
      'import react from "@vitejs/plugin-react";',
      "",
      "export default defineConfig({",
      "  plugins: [react()],",
      "});",
      "",
    ].join("\n"),
    "tsconfig.json": [
      "{",
      '  "compilerOptions": {',
      '    "target": "ES2020",',
      '    "useDefineForClassFields": true,',
      '    "module": "ESNext",',
      '    "moduleResolution": "Node",',
      '    "jsx": "react-jsx",',
      '    "strict": true,',
      '    "resolveJsonModule": true,',
      '    "isolatedModules": true,',
      '    "esModuleInterop": true,',
      '    "lib": ["ES2020", "DOM", "DOM.Iterable"],',
      '    "types": ["vite/client"]',
      "  },",
      '  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]',
      "}",
      "",
    ].join("\n"),
  };
}

function createVueFiles(port, tarballName) {
  return {
    "package.json": createPackageJson(
      "click-to-source-smoke-vue",
      port,
      {
        vue: "^3.5.29",
      },
      {
        "@vitejs/plugin-vue": "^6.0.4",
        "click-to-source": `file:../${tarballName}`,
        typescript: "^5.9.3",
        vite: "^6.4.1",
      },
    ),
    "index.html": [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      "    <title>click-to-source Vue smoke test</title>",
      "  </head>",
      "  <body>",
      '    <div id="app"></div>',
      '    <script type="module" src="/src/main.ts"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/main.ts": [
      'import { createApp } from "vue";',
      'import App from "./App.vue";',
      "",
      'createApp(App).mount("#app");',
      "",
    ].join("\n"),
    "src/App.vue": [
      "<template>",
      '  <main class="app-shell">',
      "    <h1>Vue Smoke Test</h1>",
      "    <p>Ctrl+Click this paragraph to jump to App.vue.</p>",
      '    <button type="button" @click="count += 1">Clicked {{ count }} times</button>',
      "  </main>",
      "</template>",
      "",
      '<script setup lang="ts">',
      'import { ref } from "vue";',
      "",
      "const count = ref(0);",
      "</script>",
      "",
      "<style scoped>",
      ".app-shell {",
      "  font-family: sans-serif;",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "</style>",
      "",
    ].join("\n"),
    "vite.config.ts": [
      'import { defineConfig } from "vite";',
      'import vue from "@vitejs/plugin-vue";',
      "",
      "export default defineConfig({",
      '  plugins: [vue({ template: { transformAssetUrls: false } })],',
      "});",
      "",
    ].join("\n"),
    "tsconfig.json": [
      "{",
      '  "compilerOptions": {',
      '    "target": "ES2020",',
      '    "useDefineForClassFields": true,',
      '    "module": "ESNext",',
      '    "moduleResolution": "Node",',
      '    "strict": true,',
      '    "jsx": "preserve",',
      '    "resolveJsonModule": true,',
      '    "isolatedModules": true,',
      '    "esModuleInterop": true,',
      '    "lib": ["ES2020", "DOM", "DOM.Iterable"],',
      '    "types": ["vite/client"]',
      "  },",
      '  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]',
      "}",
      "",
    ].join("\n"),
  };
}

function createSvelteFiles(port, tarballName) {
  return {
    "package.json": createPackageJson(
      "click-to-source-smoke-svelte",
      port,
      {
        svelte: "^5.53.7",
      },
      {
        "@sveltejs/vite-plugin-svelte": "^6.2.4",
        "click-to-source": `file:../${tarballName}`,
        vite: "^6.4.1",
      },
    ),
    "index.html": [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      "    <title>click-to-source Svelte smoke test</title>",
      "  </head>",
      "  <body>",
      '    <div id="app"></div>',
      '    <script type="module" src="/src/main.js"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    "src/main.js": [
      'import { mount } from "svelte";',
      'import App from "./App.svelte";',
      "",
      "const app = mount(App, {",
      '  target: document.getElementById("app"),',
      "});",
      "",
      "export default app;",
      "",
    ].join("\n"),
    "src/App.svelte": [
      "<script>",
      "  let count = 0;",
      "</script>",
      "",
      '<main class="app-shell">',
      "  <h1>Svelte Smoke Test</h1>",
      "  <p>Ctrl+Click this paragraph to jump to App.svelte.</p>",
      '  <button type="button" on:click={() => count += 1}>Clicked {count} times</button>',
      "</main>",
      "",
      "<style>",
      "  .app-shell {",
      "    font-family: sans-serif;",
      "    display: grid;",
      "    gap: 12px;",
      "    padding: 24px;",
      "  }",
      "</style>",
      "",
    ].join("\n"),
    "vite.config.js": [
      'import { defineConfig } from "vite";',
      'import { svelte } from "@sveltejs/vite-plugin-svelte";',
      "",
      "export default defineConfig({",
      '  plugins: [svelte({ compilerOptions: { dev: true } })],',
      "});",
      "",
    ].join("\n"),
  };
}

async function runViteSmokeCase(tempRoot, tarballName, spec) {
  const appRoot = path.join(tempRoot, spec.dir);
  const sourcePath = normalizePath(path.join(appRoot, spec.sourceFile));
  let child;

  try {
    writeFiles(appRoot, spec.createFiles(spec.port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(
      "node",
      [path.join("node_modules", "click-to-source", "dist", "cli.cjs"), "setup"],
      appRoot,
    );

    spec.assertSetup(appRoot);

    run(npmCommand, ["run", "build"], appRoot);

    for (const filePath of getFiles(path.join(appRoot, "dist"))) {
      const content = fs.readFileSync(filePath, "utf8");
      assert(
        !content.includes(sourcePath),
        `${spec.name}: production output should not leak source locations: ${filePath}`,
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
      `http://127.0.0.1:${spec.port}/${spec.transformPath}`,
      child,
      logs,
      60000,
    );

    assert(
      transformedModule.includes("data-click-to-source"),
      `${spec.name}: dev transform did not inject data-click-to-source.\n${logs.join("")}`,
    );
    for (const pattern of spec.sourcePatterns) {
      assert(
        pattern.test(transformedModule),
        `${spec.name}: dev transform reported an unexpected source line.\n${logs.join("")}\n${transformedModule}`,
      );
    }

    const response = await fetch(
      `http://127.0.0.1:${spec.port}/__click_to_source/open?file=${encodeURIComponent(spec.sourceFile)}&line=1&column=1&editor=vscode`,
    );
    const payload = await response.json();

    assert(
      response.ok && typeof payload.ok === "boolean",
      `${spec.name}: open endpoint did not respond as expected.\n${logs.join("")}`,
    );
  } finally {
    stopProcessTree(child);
  }
}

function assertReactSetup(appRoot, mainFileName = "main.jsx", viteConfigName = "vite.config.js") {
  const mainFile = fs.readFileSync(path.join(appRoot, "src", mainFileName), "utf8");
  const viteConfig = fs.readFileSync(path.join(appRoot, viteConfigName), "utf8");

  assert(mainFile.includes('import "click-to-source/init";'), "React smoke setup did not add the init import.");
  assert(
    viteConfig.includes('import { clickToSourceReact } from "click-to-source/vite";'),
    "React smoke setup did not add the Vite plugin import.",
  );
  assert(viteConfig.includes("clickToSourceReact()"), "React smoke setup did not add clickToSourceReact().");
  assert(viteConfig.includes("react()"), "React smoke setup should preserve react().");
}

function assertVueSetup(appRoot) {
  const mainFile = fs.readFileSync(path.join(appRoot, "src", "main.ts"), "utf8");
  const viteConfig = fs.readFileSync(path.join(appRoot, "vite.config.ts"), "utf8");

  assert(mainFile.includes('import "click-to-source/init";'), "Vue smoke setup did not add the init import.");
  assert(
    viteConfig.includes('import { clickToSourceVue } from "click-to-source/vite";'),
    "Vue smoke setup did not add the Vite plugin import.",
  );
  assert(viteConfig.includes("clickToSourceVue({ vue:"), "Vue smoke setup did not preserve the existing vue() options.");
  assert(!viteConfig.includes("@vitejs/plugin-vue"), "Vue smoke setup should replace the original vue plugin import.");
}

function assertSvelteSetup(appRoot) {
  const mainFile = fs.readFileSync(path.join(appRoot, "src", "main.js"), "utf8");
  const viteConfig = fs.readFileSync(path.join(appRoot, "vite.config.js"), "utf8");

  assert(mainFile.includes('import "click-to-source/init";'), "Svelte smoke setup did not add the init import.");
  assert(
    viteConfig.includes('import { clickToSourceSvelte } from "click-to-source/vite";'),
    "Svelte smoke setup did not add the Vite plugin import.",
  );
  assert(viteConfig.includes("clickToSourceSvelte({ svelte:"), "Svelte smoke setup did not preserve the existing svelte() options.");
  assert(!viteConfig.includes("@sveltejs/vite-plugin-svelte"), "Svelte smoke setup should replace the original svelte plugin import.");
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-vite-"));

  try {
    const tarballName = packPackage(tempRoot);
    const specs = [
      {
        name: "react",
        dir: "react-app",
        port: await findFreePort(),
        createFiles: createReactFiles,
        assertSetup: (appRoot) => assertReactSetup(appRoot),
        sourceFile: "src/App.jsx",
        transformPath: "src/App.jsx",
        sourcePatterns: [
          /App\.jsx:6:5/,
          /App\.jsx:8:7/,
          /App\.jsx:13:11/,
          /App\.jsx:19:9/,
        ],
      },
      {
        name: "react-tsx",
        dir: "react-tsx-app",
        port: await findFreePort(),
        createFiles: createReactTsxFiles,
        assertSetup: (appRoot) => assertReactSetup(appRoot, "main.tsx", "vite.config.ts"),
        sourceFile: "src/App.tsx",
        transformPath: "src/App.tsx",
        sourcePatterns: [
          /App\.tsx:24:7/,
          /App\.tsx:27:7/,
          /App\.tsx:29:11/,
          /App\.tsx:31:15/,
        ],
      },
      {
        name: "react-mui",
        dir: "react-mui-app",
        port: await findFreePort(),
        createFiles: createReactMuiFiles,
        assertSetup: (appRoot) => assertReactSetup(appRoot, "main.tsx", "vite.config.ts"),
        sourceFile: "src/App.tsx",
        transformPath: "src/App.tsx",
        sourcePatterns: [
          /App\.tsx:19:\d+/,
          /App\.tsx:33:\d+/,
          /App\.tsx:34:\d+/,
          /App\.tsx:35:\d+/,
          /App\.tsx:44:\d+/,
          /App\.tsx:53:\d+/,
        ],
      },
      {
        name: "vue",
        dir: "vue-app",
        port: await findFreePort(),
        createFiles: createVueFiles,
        assertSetup: assertVueSetup,
        sourceFile: "src/App.vue",
        transformPath: "src/App.vue",
        sourcePatterns: [/App\.vue:2:\d+/],
      },
      {
        name: "svelte",
        dir: "svelte-app",
        port: await findFreePort(),
        createFiles: createSvelteFiles,
        assertSetup: assertSvelteSetup,
        sourceFile: "src/App.svelte",
        transformPath: "src/App.svelte",
        sourcePatterns: [/App\.svelte:5:\d+/],
      },
    ];

    for (const spec of specs) {
      await runViteSmokeCase(tempRoot, tarballName, spec);
    }

    console.log("Vite smoke tests passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
