# Changelog

All notable changes to this project will be documented in this file.

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
