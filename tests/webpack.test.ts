import test from "node:test";
import assert from "node:assert/strict";
import { withClickToSource } from "../src/webpack.ts";

test("withClickToSource adds the Babel plugin in development mode", () => {
  const config = {
    mode: "development",
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          use: [
            {
              loader: "babel-loader",
              options: {
                plugins: [],
              },
            },
          ],
        },
      ],
    },
    devServer: {},
  };

  const result = withClickToSource(config);
  const babelOptions = result.module?.rules?.[0]?.use?.[0]?.options;

  assert.ok(Array.isArray(babelOptions.plugins));
  assert.equal(babelOptions.plugins.length, 1);
  assert.equal(result.devServer?.setupMiddlewares instanceof Function, true);
});

test("withClickToSource does not instrument production mode by default", () => {
  const config = {
    mode: "production",
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          use: [
            {
              loader: "babel-loader",
              options: {
                plugins: [],
              },
            },
          ],
        },
      ],
    },
    devServer: {},
  };

  const result = withClickToSource(config);
  const babelOptions = result.module?.rules?.[0]?.use?.[0]?.options;

  assert.deepEqual(babelOptions.plugins, []);
  assert.equal(result.devServer?.setupMiddlewares, undefined);
});
