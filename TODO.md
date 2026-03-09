# TODO

This is the current maturity roadmap for `click-to-source`.

Current automated end-to-end coverage includes Vite React, Vue, Svelte, and Angular.
Current manual example coverage includes React, Vue, Svelte, Angular, Webpack React, and Rspack React.
The highest-risk gaps are now the remaining integrations and broader environment coverage.

## P0 Validation Gaps

- [ ] Add an automated smoke test for `examples/webpack-react-example`.
- [ ] Add an automated smoke test for `examples/rspack-react-example`.
- [ ] Verify editor opening across VS Code, Cursor, and WebStorm on at least one supported machine for each editor.
- [ ] Add a monorepo/outside-workspace smoke test using `allowOutsideWorkspace: true`.
- [ ] Add a regression test for Angular inline templates so support status is explicit instead of implied.

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
- [ ] Remove the Node 22 experimental warning from the Vue and Svelte Vite integrations by avoiding CommonJS loading of ESM-only framework plugins.

## P2 Repository Maturity

- [ ] Add `CONTRIBUTING.md` with support policy, testing expectations, and release checklist.
- [ ] Add issue templates for bug reports and environment details.
- [ ] Define a support matrix in CI so every claimed integration has at least one automated example.
- [ ] Add a lightweight benchmark or sanity check to keep transform overhead visible.
