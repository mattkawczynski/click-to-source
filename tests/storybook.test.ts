import test from "node:test";
import assert from "node:assert/strict";
import { withClickToSourceStorybook } from "../src/storybook.ts";

test("withClickToSourceStorybook augments Vite-based Storybook configs", async () => {
  const config = withClickToSourceStorybook(
    {
      framework: "@storybook/react-vite",
      previewAnnotations(entries: string[]) {
        return [...entries, "existing-preview"];
      },
      async viteFinal(base: Record<string, unknown>) {
        return {
          ...base,
          plugins: [...((base.plugins as unknown[]) || []), { name: "existing-plugin" }],
        };
      },
    },
    { framework: "react" }
  );

  const resolved = await config.viteFinal({ plugins: [] }, {});
  const previewEntries = await config.previewAnnotations([]);

  assert.ok(Array.isArray(resolved.plugins));
  assert.ok(resolved.plugins.some((plugin: any) => plugin.name === "existing-plugin"));
  assert.ok(resolved.plugins.some((plugin: any) => plugin.name === "click-to-source"));
  assert.ok(previewEntries.includes("existing-preview"));
  assert.ok(previewEntries.some((entry) => /storybook-preview/.test(String(entry))));
});

test("withClickToSourceStorybook augments webpack-based Storybook configs", async () => {
  const config = withClickToSourceStorybook(
    {
      framework: "@storybook/react-webpack5",
    },
    { framework: "react", builder: "webpack" }
  );

  const resolved = await config.webpackFinal(
    {
      module: {
        rules: [
          {
            test: /\.[jt]sx?$/,
            use: [{ loader: "babel-loader", options: { plugins: [] } }],
          },
        ],
      },
    },
    {}
  );
  const previewEntries = await config.previewAnnotations([]);

  const babelRule = resolved.module.rules[0];
  const babelLoader = babelRule.use[0];
  assert.ok(Array.isArray(babelLoader.options.plugins));
  assert.ok(previewEntries.some((entry) => /storybook-preview/.test(String(entry))));
});
