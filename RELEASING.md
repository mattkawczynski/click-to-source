# Releasing

`click-to-source@1.0.3` has already been published manually.
The remaining setup is for future releases.

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
npm install -D ../path/to/click-to-source-<version>.tgz
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

## Trusted Publishing Setup

Trusted publishing means npm trusts one specific GitHub Actions workflow to publish the package.
That workflow gets short-lived credentials from GitHub when it runs, so you do not store a long-lived npm token in GitHub secrets.

Configure it once in npm:

1. Open package settings.
2. Add a trusted publisher for the GitHub repository.
3. Select the `publish.yml` workflow.

This repo already has the workflow side in place:

1. `.github/workflows/publish.yml` requests `id-token: write`.
2. The workflow runs on `v*` tags.
3. The publish step uses `npm publish --provenance --access public`.

Once that npm-side trust is configured, future releases become:

```bash
npm version patch
git push origin main --follow-tags
```

## Notes

1. `npm run verify` uses `npm pack --dry-run`. It validates package contents but does not create a reusable tarball.
2. `npm run pack:local` creates a real tarball and always rebuilds first via `prepack`.
3. The first public release was published manually. Trusted publishing is for the next releases.
