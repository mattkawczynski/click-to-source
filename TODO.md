# TODO

This is the current maturity roadmap for `click-to-source`.

Current automated end-to-end coverage is centered on Vite React.
Everything else should be treated as implementation-in-progress until the items below are completed.

## P0 Validation Gaps

- [ ] Add a Vite Vue smoke test that installs the packed tarball, runs dev, and verifies `data-click-to-source` plus source line accuracy.
- [ ] Add a Vite Svelte smoke test with the same checks.
- [ ] Add an Angular runtime smoke test that verifies template injection in a real dev server, not just config patching.
- [ ] Add a Webpack React example and smoke test.
- [ ] Add a Rspack React example and smoke test.
- [ ] Verify editor opening across VS Code, Cursor, and WebStorm on at least one supported machine for each editor.
- [ ] Add a monorepo/outside-workspace smoke test using `allowOutsideWorkspace: true`.

## P1 Source Accuracy

- [ ] Add regression fixtures for multiline JSX, fragments, conditionals, loops, render props, and wrapped component libraries such as MUI.
- [ ] Assert both line and column accuracy in tests where possible.
- [ ] Verify line accuracy survives React Refresh, TypeScript syntax, and nested transforms.
- [ ] Add a production assertion for Vue, Svelte, Angular, Webpack, and Rspack that confirms source markers are not leaked into production bundles.

## P1 Setup And UX

- [ ] Expand CLI setup coverage for Vue, Svelte, Webpack, and Rspack projects.
- [ ] Improve CLI detection/error messages when a project shape cannot be patched safely.
- [ ] Document a manual setup path for each integration with minimal examples that are known to work.
- [ ] Add screenshots or a short GIF that shows the actual Ctrl+Click workflow.

## P2 Repository Maturity

- [ ] Add `CONTRIBUTING.md` with support policy, testing expectations, and release checklist.
- [ ] Add issue templates for bug reports and environment details.
- [ ] Define a support matrix in CI so every claimed integration has at least one automated example.
- [ ] Add a lightweight benchmark or sanity check to keep transform overhead visible.
