# click-to-source

[![npm version](https://img.shields.io/npm/v/click-to-source)](https://www.npmjs.com/package/click-to-source)
[![npm downloads](https://img.shields.io/npm/dm/click-to-source)](https://www.npmjs.com/package/click-to-source)
[![CI](https://img.shields.io/github/actions/workflow/status/mattkawczynski/click-to-source/ci.yml?branch=main&label=ci)](https://github.com/mattkawczynski/click-to-source/actions/workflows/ci.yml)
[![Validated](https://img.shields.io/badge/validated-vite%20%7C%20webpack%20%7C%20rspack%20%7C%20angular%20%7C%20next%20%7C%20nuxt%20%7C%20astro%20%7C%20storybook-0b7285)](#validation-status)
[![License](https://img.shields.io/npm/l/click-to-source)](LICENSE)

Hold your configured hotkey to preview an element, then click to run the configured source action.

Works by injecting a `data-click-to-source` attribute at build time, then using a runtime hover/click handler to preview and act on the file at the right line and column.

This package is intentionally a local-development tool. Standard UAT and production builds should not ship `data-click-to-source` metadata.

## Validation Status

Currently validated in automated tests:

1. Vite React dev/build flow, including exact source line assertions across JSX, TSX, fragments, render props, wrapped components, loops, conditionals, and a real MUI fixture
2. Vite Vue dev/build flow
3. Vite Svelte dev/build flow
4. Webpack React dev/build flow, including a TypeScript/Babel line-accuracy fixture outside the Vite React Refresh path
5. Rspack React dev/build flow
6. Angular dev-server template injection for external HTML templates, plus an explicit inline-template regression case
7. CLI setup for React, Vue, Svelte, Angular, Webpack, and Rspack project shapes, including framework-specific manual fallback guidance when automatic patching is unsafe
8. Runtime hotkey preview highlighting with an animated dashed border, tooltip rendering, open/copy/inspect action modes, selector filters, and delayed initialization when instrumented DOM appears after boot
9. Open-file endpoint security, path mappings, Windows editor launching, and launch-candidate coverage for VS Code, Cursor, and WebStorm
10. pnpm workspace, Turbo monorepo, and Nx monorepo flows with `allowOutsideWorkspace: true`
11. Next.js webpack-backed dev/build flow, covering both App Router and Pages Router with the checked-in `next-init` bootstrap and a local API route for the open endpoint
12. Nuxt 4 dev/build flow for Vue SFC templates, with browser-side editor URL fallback for local editor opening
13. Astro 5 dev/build flow for React islands
14. Storybook React/Vite dev/build flow

Manually validated across the checked-in examples:

1. React example
2. Vue example
3. Svelte example
4. Angular example
5. Webpack React example
6. Rspack React example

Implemented, but not yet validated end-to-end in CI:

1. Real installed-editor behavior for Cursor and WebStorm on a supported machine
2. Path translation in actual WSL, devcontainer, and Codespaces environments
3. Angular inline template instrumentation
4. Next.js Turbopack dev mode
5. Astro support for Vue or Svelte islands
6. Raw `.astro` template markup instrumentation
7. Storybook webpack builder beyond config-level coverage

## Integrations

1. Vite React with `react()` plus `clickToSourceReact()`
2. Vite Vue
3. Vite Svelte
4. Webpack and Rspack integrations, validated today with React/Babel loader pipelines
5. Angular dev-server integration
6. Next.js webpack-mode integration for App Router and Pages Router
7. Nuxt module integration
8. Astro React-island integration
9. Storybook React/Vite integration
10. VS Code, Cursor, and WebStorm launch targets

## Install

```bash
npm install -D click-to-source
```

## Quick Start

```bash
npx click-to-source setup
```

This will:

1. Add `import "click-to-source/init";` to your entry file.
2. Patch `vite.config.*`, `webpack.config.*`, `rspack.config.*`, or `angular.json` when detected.

If it cannot safely patch your config, it prints manual steps.

Then start your dev server, hold the configured hotkey to preview a rendered element, and click to open, copy, or inspect it.

Expected behavior:

1. The DOM includes `data-click-to-source="path:line:column"` on elements.
2. Holding the configured hotkey previews the hovered element with a visible outline.
3. A tooltip shows the resolved file and line while the hotkey is held.
4. Clicking while the configured hotkey is held uses the current action: open, copy source, or inspect.

## Manual Setup

If `npx click-to-source setup` cannot safely patch your project, use one of these minimal shapes.
These are the known-good setups reflected by the checked-in example apps and smoke tests.

### Vite React

Known-good example: `examples/react-example`

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { clickToSourceReact } from "click-to-source/vite";

export default defineConfig({
  plugins: [react(), clickToSourceReact()],
});
```

```ts
// src/main.tsx
import "click-to-source/init";
```

### Vite Vue

Known-good example: `examples/vue-example`

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { clickToSourceVue } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceVue()],
});
```

```ts
// src/main.ts
import "click-to-source/init";
```

### Vite Svelte

Known-good example: `examples/svelte-example`

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { clickToSourceSvelte } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceSvelte()],
});
```

```ts
// src/main.ts
import "click-to-source/init";
```

### Webpack React (Babel)

Known-good example: `examples/webpack-react-example`

```js
// webpack.config.cjs
const { withClickToSource } = require("click-to-source/webpack");

module.exports = (_env, argv = {}) =>
  withClickToSource({
    mode: argv.mode || "development",
    // your existing webpack config
  });
```

```ts
// src/index.tsx or src/index.jsx
import "click-to-source/init";
```

### Rspack React (Babel)

Known-good example: `examples/rspack-react-example`

```js
// rspack.config.cjs
const { withClickToSource } = require("click-to-source/rspack");

module.exports = (_env, argv = {}) =>
  withClickToSource({
    mode: argv.mode || "development",
    // your existing rspack config
  });
```

```ts
// src/index.tsx or src/index.jsx
import "click-to-source/init";
```

### Angular

Known-good example: `examples/angular-example`

```json
// angular.json
{
  "projects": {
    "your-app": {
      "architect": {
        "serve": {
          "builder": "click-to-source:dev-server"
        }
      }
    }
  }
}
```

```ts
// src/main.ts
import "click-to-source/init";
```

For Angular, the validated path today is external HTML templates in dev mode. Inline templates are still explicitly unsupported.

### Next.js

Known-good example: `examples/next-example`

```ts
// next.config.mjs
import withClickToSourceNext from "click-to-source/next";

export default withClickToSourceNext({
  reactStrictMode: true,
});
```

```tsx
// app/click-to-source-client.tsx
"use client";

import "click-to-source/next-init";

export default function ClickToSourceClient() {
  return null;
}
```

```ts
// pages/api/__click_to_source/open.ts
import { createOpenRequestHandler } from "click-to-source/server";

const handler = createOpenRequestHandler({
  path: "/api/__click_to_source/open",
});

export default handler;
```

Notes:

1. The validated path today is standard `next dev`, not `next dev --turbo`.
2. The runtime helper for Next is `click-to-source/next-init`, not the generic `init` entry.
3. The checked-in example covers both App Router and Pages Router.

### Nuxt

Known-good example: `examples/nuxt-example`

```ts
// nuxt.config.ts
import { defineNuxtConfig } from "nuxt/config";
import clickToSourceNuxt from "click-to-source/nuxt";

export default defineNuxtConfig({
  modules: [clickToSourceNuxt()],
});
```

Notes:

1. The validated path today is Nuxt 4 with Vue SFC templates.
2. Open action currently relies on the editor URL-scheme fallback in the browser rather than a dedicated local endpoint.

### Astro

Known-good example: `examples/astro-example`

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import clickToSourceAstro from "click-to-source/astro";

export default defineConfig({
  integrations: [react(), clickToSourceAstro({ framework: "react" })],
});
```

Notes:

1. The validated path today is React islands.
2. Raw `.astro` template markup is still not instrumented.

### Storybook

Known-good example: `examples/storybook-react-example`

```ts
// .storybook/main.ts
import { withClickToSourceStorybook } from "click-to-source/storybook";

export default withClickToSourceStorybook(
  {
    framework: "@storybook/react-vite",
    stories: ["../src/**/*.stories.@(ts|tsx)"],
  },
  { framework: "react" }
);
```

Notes:

1. The validated path today is `@storybook/react-vite`.
2. `withClickToSourceStorybook()` injects the runtime preview entry automatically.
3. Webpack-builder Storybook support exists at the config-wrapper level, but it is not smoke-validated yet.

## Vite

### React

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { clickToSourceReact } from "click-to-source/vite";

export default defineConfig({
  plugins: [
    react(),
    clickToSourceReact({
      // Optional: allow opening files outside project root (monorepos).
      allowOutsideWorkspace: false,
      // Optional: allow requests from non-localhost clients.
      allowRemote: false,
    }),
  ],
});
```

`clickToSourceReact()` is additive for Vite React. Keep your normal `react()` plugin.

```ts
// main.tsx
import "click-to-source/init";
```

The React, Vue, and Svelte paths below are all validated in automated smoke tests.

### Vue

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { clickToSourceVue } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceVue()],
});
```

```ts
// main.ts
import "click-to-source/init";
```

### Svelte

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { clickToSourceSvelte } from "click-to-source/vite";

export default defineConfig({
  plugins: [clickToSourceSvelte()],
});
```

```ts
// main.ts
import "click-to-source/init";
```

## Webpack

The validated manual path today is React with `babel-loader`.
`vue-loader` and `svelte-loader` hooks exist in the wrapper, but they are not yet covered by the checked-in smoke suite.

### React (Babel)

```js
// webpack.config.cjs
const { withClickToSource } = require("click-to-source/webpack");

module.exports = (_env, argv = {}) =>
  withClickToSource({
    mode: argv.mode || "development",
    // your existing config with babel-loader
  });
```

```ts
// entry file
import "click-to-source/init";
```

If your React pipeline already uses `babel-loader`, `withClickToSource()` adds the Babel plugin for development automatically.

## Rspack

The validated manual path today is React with `babel-loader`.

```js
// rspack.config.js
const { withClickToSource } = require("click-to-source/rspack");

module.exports = withClickToSource({
  // your existing config
});
```

## Angular (dev server)

This uses a custom dev-server builder to inject `data-click-to-source` into templates.

```json
// angular.json (serve builder)
{
  "projects": {
    "your-app": {
      "architect": {
        "serve": {
          "builder": "click-to-source:dev-server",
          "options": {
            "clickToSource": {
              "enabled": true
            }
          }
        }
      }
    }
  }
}
```

```ts
// src/main.ts
import "click-to-source/init";
```

Notes:

1. External HTML templates are supported. Inline templates may not include `data-click-to-source`.
2. This is dev-only. Production builds are unaffected.

## Examples

Checked-in example apps live in:

1. `examples/react-example`
2. `examples/vue-example`
3. `examples/svelte-example`
4. `examples/angular-example`
5. `examples/webpack-react-example`
6. `examples/rspack-react-example`
7. `examples/next-example`
8. `examples/nuxt-example`
9. `examples/astro-example`
10. `examples/storybook-react-example`

Each example is intended to build locally and reflect the currently supported setup shape.
React, Vue, Svelte, Angular, Webpack, and Rspack were manually validated locally.
Next.js, Nuxt, Astro, and Storybook are covered by the automated adoption smoke suite and still worth a manual pass before release.

## Configuration

```ts
import { configManager } from "click-to-source";

configManager.updateConfig({
  hotkey: "alt",
  position: "tr",
  theme: "dark",
  enabled: true,
});
```

Config options:

```ts
interface ClickToSourceConfig {
  enabled: boolean;
  hotkey: "ctrl" | "alt" | "meta" | "shift";
  position: "tl" | "tr" | "bl" | "br";
  theme: "light" | "dark" | "auto";
  showButton: boolean;
  serverPath: string;
  serverBaseUrl?: string;
  openIn: "vscode" | "cursor" | "webstorm";
  pathMappings: Array<{ from: string; to: string }>;
  action: "open" | "copy" | "inspect";
  includeSelectors: string[];
  excludeSelectors: string[];
}
```

`pathMappings` affect browser fallback, copy mode, and tooltip display. Server-side path mapping is configured on the build-tool integration itself.

## Action Modes

The floating UI supports three actions:

1. `open`: open the editor at the resolved file, line, and column
2. `copy`: copy the resolved `file:line:column`
3. `inspect`: show the resolved source without opening anything

`click-to-source` is a localhost/dev-server tool. It does not try to support standard UAT or production deployments by embedding repository links into shipped builds.

If you want shared source links on UAT or production later, that needs a separate product mode with explicit dev-safe metadata rules. The current package does not claim that.

## Server Security Defaults

The open-file endpoint is locked down by default:

1. Only `GET` is accepted.
2. Only loopback requests (`127.0.0.1` / `::1`) are accepted.
3. Cross-origin browser requests are blocked.
4. Paths outside `process.cwd()` are blocked.

For monorepos or remote-device workflows, you can opt in:

```ts
clickToSourceReact({
  allowOutsideWorkspace: true,
  allowRemote: true,
  pathMappings: [
    { from: "/workspaces/my-app", to: "C:/Users/mateu/dev/my-app" },
  ],
});
```

Angular builder options:

```json
{
  "clickToSource": {
    "enabled": true,
    "allowOutsideWorkspace": false,
    "allowRemote": false
  }
}
```

## How It Works

1. Build time: A framework-specific transform injects `data-click-to-source="path:line:column"` into element tags.
2. Runtime: Holding the configured hotkey previews the hovered instrumented element, shows a tooltip with the resolved source location, and clicking runs the current action for that location.
3. Dev server: A lightweight endpoint triggers `code --goto` (or other editors).

## Troubleshooting

If clicking does nothing:

1. Confirm the build transform is enabled (Vite plugin or Babel plugin).
2. Ensure `import "click-to-source/init";` is in your entry file.
3. Check that your editor command is available on PATH (e.g., `code --version`).
4. If source files are outside your app root, set `allowOutsideWorkspace: true` in plugin options.
5. If you are testing the dev endpoint manually, include the editor in the query string, for example:

```text
/__click_to_source/open?file=src/App.tsx&line=10&column=3&editor=vscode
```

## Development

```bash
npm run verify
npm run test:smoke
```

`npm run test` runs through `tsx` so the TypeScript tests are executed without Node's experimental strip-types mode.
`npm run test:smoke` validates packed-install flows for temporary Vite React, Vite React TSX, Vite React with MUI, Vue, Svelte, Angular, Webpack, Webpack TSX, Rspack, Next.js, Nuxt, Astro, Storybook, pnpm workspace, Turbo monorepo, and Nx monorepo apps.

The package is live on npm as `click-to-source`.
Repository docs:

1. `CHANGELOG.md`: released changes
2. `RELEASING.md`: maintainer release process
3. `TODO.md`: validation gaps and roadmap

## License

MIT
