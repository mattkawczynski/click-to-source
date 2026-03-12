# Changelog

All notable changes to this project will be documented in this file.

## [1.0.9] - 2026-03-09

### Added

- checked-in Vue, Svelte, Angular, Webpack React, and Rspack React example apps for manual validation.
- checked-in Next.js, Nuxt, Astro, and Storybook example apps for the new adoption-multiplier integrations.
- automated smoke coverage for packed-install Vite Vue, Vite Svelte, and Angular flows.
- automated adoption smoke coverage for Next.js App Router and Pages Router, Nuxt, Astro, and Storybook.
- runtime preview highlighting so holding the configured hotkey visibly outlines the hovered instrumented element before click.
- TSX-heavy React smoke coverage for fragments, render props, wrapped components, and exact line assertions.
- real MUI smoke coverage for Vite React so third-party component-library props are validated with exact source lines.
- Webpack TSX smoke coverage so TypeScript-heavy line accuracy is exercised outside the Vite React Refresh path.
- workspace smoke coverage for pnpm, Turbo, and Nx monorepos with `allowOutsideWorkspace: true`.
- framework-specific manual setup documentation and CLI fallback guidance for React, Vue, Svelte, Angular, Webpack, and Rspack.
- `click-to-source/next`, `click-to-source/next-init`, `click-to-source/nuxt`, `click-to-source/astro`, and `click-to-source/storybook` integrations.

### Fixed

- deferred runtime initialization until `data-click-to-source` exists in the DOM, which fixes Angular and other late-rendered app boots where instrumentation appears after `click-to-source/init` runs.
- Webpack and Rspack integration defaults so production builds do not inject source markers.
- Next.js smoke coverage now uses the actual supported webpack-backed dev path rather than an invalid CLI flag.
- Nuxt integration now hooks into the live Vite config and keeps production builds clean.
- Nuxt integration now emits and registers an ESM client plugin so the runtime UI actually initializes in dev.
- Storybook React/Vite now adds the React Vite plugin where needed and injects the preview runtime automatically.
- test execution stability by switching the TypeScript test runner from Node's experimental strip-types path to `tsx`.
- Windows workspace smoke cleanup so locked temp dirs no longer fail otherwise-passing Nx validation.
- preview highlighting now uses a lightweight animated dashed border instead of a static outline.
- the runtime and docs are simplified back to the intended localhost/dev-server scope by removing repo-link and browser-safe feature paths.

## [1.0.7] - 2026-03-08

### Fixed

- corrected Vite React source locations by registering the JSX instrumentation inside `@vitejs/plugin-react`'s Babel hook, so React Refresh preamble lines no longer shift reported file positions.
- tightened the packed-install smoke test to assert the reported JSX source line in development mode.

## [1.0.6] - 2026-03-08

### Fixed

- made the packed-install smoke test invoke the installed CLI directly, avoiding cross-platform `npx` resolution issues in CI.

## [1.0.4] - 2026-03-08

### Added

- npm trusted publishing through GitHub Actions.
- automated release path using version tags and npm provenance.

### Changed

- published `click-to-source` to npm as a public package.

## [1.0.3] - 2026-03-08

### Changed

- normalized package metadata for npm publishing.
- cleaned release documentation for the live npm package.

## [1.0.2] - 2026-03-08

### Fixed

- regenerated the lockfile to work on both Windows and Linux.
- fixed Linux CI and release verification for packed builds.

## [1.0.1] - 2026-03-08

### Fixed

- made Vite React integration additive so `react()` and `clickToSourceReact()` work together.
- fixed Windows editor launching and fallback behavior.
- stabilized the setup helper and example app for real installs.
