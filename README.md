# click-to-source

Ctrl+Click any UI element in development to open its source in your editor.

Works by injecting a `data-click-to-source` attribute at build time, then using a runtime click handler to open the file at the right line and column.

## What It Supports

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

## Quick Start (CLI)

```bash
npx click-to-source setup
```

This will:
1. Add `import "click-to-source/init";` to your entry file.
2. Patch `vite.config.*` or `angular.json` when detected.

If it cannot safely patch your config, it prints manual steps.

## Local Package Test

Before publishing, test the exact package that npm will install:

```bash
npm run pack:local
```

This creates a tarball like `click-to-source-1.0.1.tgz`.

In another app:

```bash
npm install -D ../path/to/click-to-source-1.0.1.tgz
```

Then run the setup helper:

```bash
npx click-to-source setup
```

For a Vite React app, the helper should:
1. Add `import "click-to-source/init";` to your entry file.
2. Add `clickToSourceReact()` to `vite.config.*`.

To verify it is working:
1. Start your app in dev mode.
2. Inspect the DOM and confirm elements include `data-click-to-source="path:line:column"`.
3. Ctrl+Click an element and confirm your editor opens at the matching source location.

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
          "builder": "click-to-source/angular:dev-server",
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
2. Runtime: A click handler finds the closest element with that attribute, then opens your editor at that location.
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

## Publishing

Once `npm run verify` passes:

```bash
git push origin main --follow-tags
```

This repository is set up for npm trusted publishing through GitHub Actions.
The publish workflow runs on `v*` tags and can also be triggered manually.

Recommended release flow:

```bash
npm version patch
git push origin main --follow-tags
```

Before the first publish:
1. Create the GitHub repository.
2. Configure npm trusted publishing for that repository and the `Publish` workflow.
3. Confirm the package name `click-to-source` is still available on npm.

For the full release checklist, see `RELEASING.md`.

After publishing, users install the package with:

```bash
npm install -D click-to-source
```

Then run the setup helper:

```bash
npx click-to-source setup
```

If you switch to a public scoped package later, update the workflow publish command to `npm publish --access public --provenance`.

## Development

```bash
npm run verify
```

`npm run test` currently uses Node 22's `--experimental-strip-types` support.

## License

MIT
