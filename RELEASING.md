# Maintainer Release Guide

This file is for maintainers.
It stays public because open-source release procedures are easier to audit when they live in the repo.

## Current State

1. The package is already live on npm as `click-to-source`.
2. GitHub Actions trusted publishing is configured.
3. Releases are triggered by pushing a `v*` tag.

## Preconditions

Before cutting a release:

1. `main` is green in GitHub Actions.
2. `CHANGELOG.md` is updated for the next version.
3. `npm run verify` passes locally.
4. `npm run test:smoke` passes locally.
5. If the release changes runtime behavior or an environment that is not in smoke coverage, manually exercise the relevant checked-in example or external test app.

## Local Validation

```bash
npm run verify
npm run test:smoke
npm run pack:local
```

Manual validation is still expected for:

1. Real installed-machine editor behavior for Cursor and WebStorm.
2. WSL, devcontainer, or Codespaces path translation.
3. Any integration that is still outside smoke coverage.

If the change touches packaging or setup, install the tarball into a separate app before releasing:

```bash
npm install -D ../path/to/click-to-source-<version>.tgz
```

## Release Flow

1. Bump the version:

```bash
npm version patch
```

2. Push the commit and tag:

```bash
git push origin main --follow-tags
```

3. GitHub Actions publishes from the `v*` tag.

## Post-Release Checks

1. Confirm the publish workflow succeeded.
2. Confirm the package version is live:

```bash
npm view click-to-source version
```

3. Smoke-test the published package in a clean app:

```bash
npm install -D click-to-source
npx click-to-source setup
```

## Notes

1. `npm run verify` uses `npm pack --dry-run`. It validates package contents but does not create a reusable tarball.
2. `npm run pack:local` creates a real tarball and rebuilds first via `prepack`.
3. `npm run test:smoke` validates packed-install flows for temporary Vite React, React TSX, Vue, Svelte, Angular, Webpack, Rspack, pnpm workspace, Turbo monorepo, and Nx monorepo apps.
4. Remaining integration gaps are tracked in `TODO.md`.
