const path = require("node:path");
const { rspack } = require("@rspack/core");
const { withClickToSource } = require("click-to-source/rspack");

module.exports = (_, argv = {}) =>
  withClickToSource(
    {
      mode: argv.mode || "development",
      entry: "./src/index.jsx",
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
        clean: true,
        publicPath: "/",
      },
      resolve: {
        extensions: [".js", ".jsx"],
      },
      module: {
        rules: [
          {
            test: /\.[jt]sx?$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader",
              options: {
                presets: [
                  ["@babel/preset-env", { targets: "defaults" }],
                  ["@babel/preset-react", { runtime: "automatic" }],
                ],
              },
            },
          },
          {
            test: /\.css$/,
            use: ["style-loader", "css-loader"],
          },
        ],
      },
      plugins: [
        new rspack.HtmlRspackPlugin({
          templateContent: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>click-to-source Rspack React example</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
        }),
      ],
      devtool:
        (argv.mode || "development") === "production"
          ? "source-map"
          : "eval-source-map",
      devServer: {
        historyApiFallback: true,
      },
    },
    { framework: "react" }
  );
