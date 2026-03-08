# Releasing

## Preconditions

1. The GitHub repository exists at `git@github.com:mattkawczynski/click-to-source.git`.
2. npm trusted publishing is configured for that repository.
3. `npm run verify` passes locally.

## Local Validation

```bash
npm run verify
npm run pack:local
```

Use the generated tarball to test the exact package contents in another app:

```bash
npm install -D ../path/to/click-to-source-1.0.1.tgz
```

## Release Flow

1. Update the version:

```bash
npm version patch
```

2. Push the commit and tag:

```bash
git push origin main --follow-tags
```

3. GitHub Actions publishes the package from the `v*` tag.

Manual fallback:

1. Open the `Publish` workflow in GitHub Actions.
2. Run it against `main`.

## Trusted Publishing Setup

In npm:

1. Open package settings.
2. Add a trusted publisher for the GitHub repository.
3. Select the `publish.yml` workflow.

The workflow uses `id-token: write` and runs `npm publish --provenance`.

## Notes

1. `npm run verify` uses `npm pack --dry-run`. It validates package contents but does not create a reusable tarball.
2. `npm run pack:local` creates a real tarball and always rebuilds first via `prepack`.
