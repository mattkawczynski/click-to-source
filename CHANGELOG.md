# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- checked-in Vue, Svelte, Angular, Webpack React, and Rspack React example apps for manual validation.
- automated smoke coverage for packed-install Vite Vue, Vite Svelte, and Angular flows.
- runtime preview highlighting so holding the configured hotkey visibly outlines the hovered instrumented element before click.

### Fixed

- deferred runtime initialization until `data-click-to-source` exists in the DOM, which fixes Angular and other late-rendered app boots where instrumentation appears after `click-to-source/init` runs.
- Webpack and Rspack integration defaults so production builds do not inject source markers.
- test execution stability by switching the TypeScript test runner from Node's experimental strip-types path to `tsx`.

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
