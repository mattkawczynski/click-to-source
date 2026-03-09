# click-to-source

[![npm version](https://img.shields.io/npm/v/click-to-source)](https://www.npmjs.com/package/click-to-source)
[![CI](https://img.shields.io/github/actions/workflow/status/mattkawczynski/click-to-source/ci.yml?branch=main&label=ci)](https://github.com/mattkawczynski/click-to-source/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/click-to-source)](LICENSE)

Hold your configured hotkey to preview an element, then click to open its source in your editor.

Works by injecting a `data-click-to-source` attribute at build time, then using a runtime hover/click handler to preview and open the file at the right line and column.

## Validation Status

Currently validated in automated tests:

1. Vite React dev/build flow, including source line accuracy
2. Vite Vue dev/build flow
3. Vite Svelte dev/build flow
4. Angular dev-server template injection for external HTML templates
5. CLI setup for React, Vue, Svelte, and Angular project shapes
6. Runtime hotkey preview highlighting and delayed initialization when instrumented DOM appears after boot
7. Open-file endpoint security and Windows editor launching

Manually validated across the checked-in examples:

1. React example
2. Vue example
3. Svelte example
4. Angular example
5. Webpack React example
6. Rspack React example

Implemented, but not yet validated end-to-end in CI:

1. Webpack
2. Rspack
3. Editor behavior outside the current VS Code-focused coverage
4. Monorepo and `allowOutsideWorkspace` scenarios

## Integrations

1. Vite React with `react()` plus `clickToSourceReact()`
2. Vite Vue
3. Vite Svelte
4. Webpack and Rspack integrations
5. Angular dev-server integration
6. VS Code, Cursor, and WebStorm launch targets

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
2. Patch `vite.config.*` or `angular.json` when detected.

If it cannot safely patch your config, it prints manual steps.

Then start your dev server, hold the configured hotkey to preview a rendered element, and click to open it.

Expected behavior:

1. The DOM includes `data-click-to-source="path:line:column"` on elements.
2. Holding the configured hotkey previews the hovered element with a visible outline.
3. Clicking while the configured hotkey is held opens the matching file in your editor.

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

### React (Babel)

```json
// .babelrc
{
  "plugins": ["click-to-source/babel"]
}
```

```ts
// entry file
import "click-to-source/init";
```

### Vue (vue-loader)

```js
// webpack.config.js
const { withClickToSource } = require("click-to-source/webpack");

module.exports = withClickToSource({
  // your existing config
});
```

### Svelte (svelte-loader)

```js
// webpack.config.js
const { withClickToSource } = require("click-to-source/webpack");

module.exports = withClickToSource({
  // your existing config
});
```

## Rspack

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

Each example is intended to build locally and reflect the currently supported setup shape.
All six examples were manually validated locally.
Webpack and Rspack are not yet covered by the automated smoke suite.

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
}
```

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
2. Runtime: Holding the configured hotkey previews the hovered instrumented element, and clicking opens your editor at that location.
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
`npm run test:smoke` validates packed-install flows for temporary Vite React, Vue, Svelte, and Angular apps.
Webpack and Rspack currently rely on unit coverage plus manual example validation.

The package is live on npm as `click-to-source`.
Repository docs:

1. `CHANGELOG.md`: released changes
2. `RELEASING.md`: maintainer release process
3. `TODO.md`: validation gaps and roadmap

## License

MIT
