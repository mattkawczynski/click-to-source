# TODO

This is the current maturity roadmap for `click-to-source`.

Current automated end-to-end coverage includes Vite React, a TSX-heavy Vite React fixture, a real MUI Vite React fixture, Vue, Svelte, Webpack React, a Webpack TSX accuracy fixture, Rspack React, Angular, Next.js App Router and Pages Router, Nuxt, Astro React islands, Storybook React/Vite, and real pnpm/Turbo/Nx monorepo cases.
Current manual example coverage includes React, Vue, Svelte, Angular, Webpack React, and Rspack React, with new checked-in examples for Next.js, Nuxt, Astro, and Storybook still needing a human pass before release.
The highest-risk gaps are now environment breadth, the remaining partial integrations, and polishing the local-development workflow.

## P0 Validation Gaps

- [x] Add an automated smoke test for the Webpack React example shape.
- [x] Add an automated smoke test for the Rspack React example shape.
- [ ] Verify editor opening on real installed machines for Cursor and WebStorm. Launch-argument and PATH resolution coverage exists, but not a real-machine pass yet.
- [x] Add a monorepo/outside-workspace smoke test using `allowOutsideWorkspace: true`.
- [x] Add a regression test for Angular inline templates so support status is explicit instead of implied.

## P0 Adoption Multipliers

- [x] Add Next.js dev support, covering both App Router and Pages Router.
- [x] Add Nuxt dev support.
- [x] Add Astro dev support.
- [x] Add Storybook integration so component-library teams can use this without a separate app shell.
- [x] Add path translation support for common remote/dev environments such as WSL, dev containers, and Codespaces.
- [x] Validate the plugin in a real pnpm workspace and a real Turbo/Nx monorepo.

## P1 Source Accuracy

- [x] Extend regression fixtures to fragments, render props, wrapped components, and broader TSX-specific syntax. Multiline JSX, conditionals, and loops are covered now too.
- [x] Expand exact line-and-column assertions beyond the previous Vite React and open-handler coverage.
- [x] Add real third-party component-library fixtures such as MUI or Headless UI instead of only representative wrapped-component coverage.
- [x] Verify line accuracy with TypeScript-heavy syntax and nested transforms outside the current Vite React/React Refresh path.
- [x] Add a production assertion for Vue, Svelte, Angular, Webpack, and Rspack that confirms source markers are not leaked into production bundles.

## P1 Setup And UX

- [x] Expand CLI setup coverage for Vue, Svelte, Webpack, and Rspack projects.
- [x] Improve CLI detection/error messages when a project shape cannot be patched safely.
- [x] Document a manual setup path for each integration with minimal examples that are known to work.
- [ ] Add screenshots or a short GIF that shows the actual Ctrl+Click workflow.
- [ ] Remove the Node 22 experimental warning from the Vue and Svelte Vite integrations by avoiding CommonJS loading of ESM-only framework plugins.
- [x] Add a first-run hint/toast so users immediately understand the current hotkey and preview behavior.
- [x] Show the resolved file path and line in a small tooltip while hovering with the hotkey held.
- [x] Add include/exclude selectors so teams can ignore noisy wrapper nodes and focus on meaningful targets.
- [x] Add a "copy source path" action in the floating UI for cases where opening the editor is not the desired action.

## P1 Local Dev Scope

- [x] Keep an explicit read-only inspect preset in the UI.
- [x] Remove repo-link and browser-safe features from the product surface so the package stays honest about being a localhost/dev-server tool.
- [ ] Explore support for MDX, docs sites, and component demo environments when they are running true instrumented dev builds.
- [ ] Decide whether a future "share mode" should exist as a separate opt-in product path instead of overloading the local-dev runtime.

## P2 Repository Maturity

- [ ] Add `CONTRIBUTING.md` with support policy, testing expectations, and release checklist.
- [ ] Add issue templates for bug reports and environment details.
- [ ] Define a support matrix in CI so every claimed integration and partial integration note is enforced explicitly.
- [ ] Add a lightweight benchmark or sanity check to keep transform overhead visible.

## P2 Remaining Integration Gaps

- [ ] Add a dedicated Nuxt local open endpoint instead of relying on the browser editor-scheme fallback.
- [ ] Add Next.js Turbopack support or explicitly block it with a clearer runtime/setup warning.
- [ ] Extend Astro beyond the current React-island path to Vue and Svelte islands.
- [ ] Add instrumentation for raw `.astro` template markup.
- [ ] Smoke-test Storybook webpack builder, not just the React/Vite path.

## P2 Popularity And Ecosystem

- [ ] Publish short demo videos/GIFs for React, Vue, Angular, Webpack, and Rspack instead of only static docs.
- [ ] Add a comparison table in the README that clearly shows what works today, what is experimental, and what is planned.
- [ ] Collect a small set of real-world example repos to prove the tool outside the local demo apps.
- [ ] Add a public "why this exists" section in the README so the value is obvious in the first screenful.
- [ ] Expose a stable low-level API so other tools can build on top of the source-locator behavior instead of forking it.
- [ ] Add funding metadata and a sponsor badge once there is a real GitHub Sponsors, Buy Me a Coffee, or Ko-fi URL to link.
