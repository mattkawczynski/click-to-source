const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  isWindows,
  npmCommand,
  createInvocation,
  run,
  assert,
  getFiles,
  normalizePath,
  findFreePort,
  waitForText,
  stopProcessTree,
  writeFiles,
  packPackage,
  fetchScriptsFromHtml,
} = require("./smoke-helpers.cjs");

function assertNoInstrumentationMarkers(distRoot, sourcePath, spec) {
  const sourceMarker = /App\.[jt]sx?:\d+:\d+/;

  for (const filePath of getFiles(distRoot)) {
    if (!/\.(?:html|js|cjs|mjs|css)$/i.test(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    assert(
      !sourceMarker.test(content),
      `${spec.name}: production output still contains source line markers: ${filePath}`,
    );
    assert(
      !content.includes(sourcePath),
      `${spec.name}: production output still contains source file markers: ${filePath}`,
    );
  }
}

function createWebpackFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-webpack",
        private: true,
        scripts: {
          dev: `webpack serve --mode development --host 127.0.0.1 --port ${port}`,
          build: "webpack --mode production",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@babel/core": "^7.0.0",
          "@babel/preset-env": "^7.0.0",
          "@babel/preset-react": "^7.0.0",
          "babel-loader": "^9.0.0",
          "click-to-source": `file:../${tarballName}`,
          "css-loader": "^7.0.0",
          "html-webpack-plugin": "^5.0.0",
          "style-loader": "^4.0.0",
          webpack: "^5.0.0",
          "webpack-cli": "^6.0.0",
          "webpack-dev-server": "^5.0.0",
        },
      },
      null,
      2,
    ),
    "src/index.jsx": [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'import App from "./App";',
      'import "./styles.css";',
      "",
      'createRoot(document.getElementById("root")).render(<App />);',
      "",
    ].join("\n"),
    "src/App.jsx": [
      "export default function App() {",
      "  return (",
      '    <main className="app-shell">',
      "      <h1>Webpack Smoke Test</h1>",
      '      <button type="button">Inspect me</button>',
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "src/styles.css": [
      ".app-shell {",
      "  font-family: sans-serif;",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "",
    ].join("\n"),
    "webpack.config.cjs": [
      'const path = require("node:path");',
      'const HtmlWebpackPlugin = require("html-webpack-plugin");',
      "",
      "module.exports = {",
      '  entry: "./src/index.jsx",',
      "  output: {",
      '    path: path.resolve(__dirname, "dist"),',
      '    filename: "bundle.js",',
      "    clean: true,",
      '    publicPath: "/",',
      "  },",
      "  resolve: {",
      '    extensions: [".js", ".jsx"],',
      "  },",
      "  module: {",
      "    rules: [",
      "      {",
      '        test: /\\.[jt]sx?$/,',
      "        exclude: /node_modules/,",
      "        use: {",
      '          loader: "babel-loader",',
      "          options: {",
      "            presets: [",
      '              ["@babel/preset-env", { targets: "defaults" }],',
      '              ["@babel/preset-react", { runtime: "automatic" }],',
      "            ],",
      "          },",
      "        },",
      "      },",
      "      {",
      '        test: /\\.css$/,',
      '        use: ["style-loader", "css-loader"],',
      "      },",
      "    ],",
      "  },",
      "  plugins: [",
      "    new HtmlWebpackPlugin({",
      '      title: "click-to-source Webpack smoke test",',
      "    }),",
      "  ],",
      "  devServer: {",
      "    historyApiFallback: true,",
      "  },",
      "};",
      "",
    ].join("\n"),
  };
}

function createWebpackTsxFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-webpack-tsx",
        private: true,
        scripts: {
          dev: `webpack serve --mode development --host 127.0.0.1 --port ${port}`,
          build: "webpack --mode production",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@babel/core": "^7.0.0",
          "@babel/preset-env": "^7.0.0",
          "@babel/preset-react": "^7.0.0",
          "@babel/preset-typescript": "^7.0.0",
          "babel-loader": "^9.0.0",
          "click-to-source": `file:../${tarballName}`,
          "css-loader": "^7.0.0",
          "html-webpack-plugin": "^5.0.0",
          "style-loader": "^4.0.0",
          webpack: "^5.0.0",
          "webpack-cli": "^6.0.0",
          "webpack-dev-server": "^5.0.0",
        },
      },
      null,
      2,
    ),
    "src/index.tsx": [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'import App from "./App";',
      'import "./styles.css";',
      "",
      'createRoot(document.getElementById("root")!).render(<App />);',
      "",
    ].join("\n"),
    "src/App.tsx": [
      'import React from "react";',
      "",
      "type Item = {",
      "  id: string;",
      "  label: string;",
      "  disabled?: boolean;",
      "};",
      "",
      "const items = [",
      '  { id: "a", label: "Alpha" },',
      '  { id: "b", label: "Beta", disabled: true },',
      "] as const satisfies readonly Item[];",
      "",
      "function Toolbar<T extends Item>({",
      "  items,",
      "  onSelect,",
      "}: {",
      "  items: readonly T[];",
      "  onSelect: (item: T) => void;",
      "}) {",
      "  return (",
      "    <>",
      "      {items.map((item) => (",
      "        <button",
      "          key={item.id}",
      '          type="button"',
      "          disabled={item.disabled ?? false}",
      "          onClick={() => onSelect(item)}",
      "        >",
      "          {item.label.toUpperCase()}",
      "        </button>",
      "      ))}",
      "    </>",
      "  );",
      "}",
      "",
      "export default function App() {",
      "  const [activeId, setActiveId] = React.useState<string | null>(",
      "    items[0]?.id ?? null,",
      "  );",
      "",
      "  return (",
      '    <main className="app-shell">',
      "      <h1>Webpack TSX Accuracy</h1>",
      "      <Toolbar",
      "        items={items}",
      "        onSelect={(item) => setActiveId(item.id)}",
      "      />",
      '      <p>{activeId ?? "none"}</p>',
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "src/styles.css": [
      ".app-shell {",
      "  font-family: sans-serif;",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "",
    ].join("\n"),
    "webpack.config.cjs": [
      'const path = require("node:path");',
      'const HtmlWebpackPlugin = require("html-webpack-plugin");',
      "",
      "module.exports = {",
      '  entry: "./src/index.tsx",',
      "  output: {",
      '    path: path.resolve(__dirname, "dist"),',
      '    filename: "bundle.js",',
      "    clean: true,",
      '    publicPath: "/",',
      "  },",
      "  resolve: {",
      '    extensions: [".js", ".jsx", ".ts", ".tsx"],',
      "  },",
      "  module: {",
      "    rules: [",
      "      {",
      '        test: /\\.[jt]sx?$/,',
      "        exclude: /node_modules/,",
      "        use: {",
      '          loader: "babel-loader",',
      "          options: {",
      "            presets: [",
      '              ["@babel/preset-env", { targets: "defaults" }],',
      '              ["@babel/preset-react", { runtime: "automatic" }],',
      '              ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],',
      "            ],",
      "          },",
      "        },",
      "      },",
      "      {",
      '        test: /\\.css$/,',
      '        use: ["style-loader", "css-loader"],',
      "      },",
      "    ],",
      "  },",
      "  plugins: [",
      "    new HtmlWebpackPlugin({",
      '      title: "click-to-source Webpack TSX smoke test",',
      "    }),",
      "  ],",
      "  devServer: {",
      "    historyApiFallback: true,",
      "  },",
      "};",
      "",
    ].join("\n"),
  };
}

function createRspackFiles(port, tarballName) {
  return {
    "package.json": JSON.stringify(
      {
        name: "click-to-source-smoke-rspack",
        private: true,
        scripts: {
          dev: `rspack serve --mode development --host 127.0.0.1 --port ${port}`,
          build: "rspack build --mode production",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@babel/core": "^7.0.0",
          "@babel/preset-env": "^7.0.0",
          "@babel/preset-react": "^7.0.0",
          "@rspack/cli": "^1.0.0",
          "@rspack/core": "^1.0.0",
          "babel-loader": "^9.0.0",
          "click-to-source": `file:../${tarballName}`,
          "css-loader": "^7.0.0",
          "style-loader": "^4.0.0",
        },
      },
      null,
      2,
    ),
    "src/index.jsx": [
      'import React from "react";',
      'import { createRoot } from "react-dom/client";',
      'import App from "./App";',
      'import "./styles.css";',
      "",
      'createRoot(document.getElementById("root")).render(<App />);',
      "",
    ].join("\n"),
    "src/App.jsx": [
      "export default function App() {",
      "  return (",
      '    <main className="app-shell">',
      "      <h1>Rspack Smoke Test</h1>",
      '      <button type="button">Inspect me</button>',
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "src/styles.css": [
      ".app-shell {",
      "  font-family: sans-serif;",
      "  display: grid;",
      "  gap: 12px;",
      "  padding: 24px;",
      "}",
      "",
    ].join("\n"),
    "rspack.config.cjs": [
      'const path = require("node:path");',
      'const { rspack } = require("@rspack/core");',
      "",
      "module.exports = {",
      '  entry: "./src/index.jsx",',
      "  output: {",
      '    path: path.resolve(__dirname, "dist"),',
      '    filename: "bundle.js",',
      "    clean: true,",
      '    publicPath: "/",',
      "  },",
      "  resolve: {",
      '    extensions: [".js", ".jsx"],',
      "  },",
      "  module: {",
      "    rules: [",
      "      {",
      '        test: /\\.[jt]sx?$/,',
      "        exclude: /node_modules/,",
      "        use: {",
      '          loader: "babel-loader",',
      "          options: {",
      "            presets: [",
      '              ["@babel/preset-env", { targets: "defaults" }],',
      '              ["@babel/preset-react", { runtime: "automatic" }],',
      "            ],",
      "          },",
      "        },",
      "      },",
      "      {",
      '        test: /\\.css$/,',
      '        use: ["style-loader", "css-loader"],',
      "      },",
      "    ],",
      "  },",
      "  plugins: [",
      "    new rspack.HtmlRspackPlugin({",
      '      title: "click-to-source Rspack smoke test",',
      "    }),",
      "  ],",
      "  devServer: {",
      "    historyApiFallback: true,",
      "  },",
      "};",
      "",
    ].join("\n"),
  };
}

function assertBundlerSetup(appRoot, bundler, entryFileName) {
  const entryFile = fs.readFileSync(path.join(appRoot, "src", entryFileName), "utf8");
  const configName = bundler === "webpack" ? "webpack.config.cjs" : "rspack.config.cjs";
  const configFile = fs.readFileSync(path.join(appRoot, configName), "utf8");
  const importPath =
    bundler === "webpack"
      ? 'require("click-to-source/webpack")'
      : 'require("click-to-source/rspack")';

  assert(entryFile.includes('import "click-to-source/init";'), `${bundler}: setup did not add init import.`);
  assert(configFile.includes(importPath), `${bundler}: setup did not add withClickToSource import.`);
  assert(configFile.includes("withClickToSource("), `${bundler}: setup did not wrap the config export.`);
}

async function runBundlerSmokeCase(tempRoot, tarballName, spec) {
  const appRoot = path.join(tempRoot, spec.dir);
  const sourcePath = normalizePath(path.join(appRoot, spec.sourceFile));
  let child;

  try {
    writeFiles(appRoot, spec.createFiles(spec.port, tarballName));
    run(npmCommand, ["install", "--no-fund", "--no-audit"], appRoot);
    run(
      "node",
      [path.join("node_modules", "click-to-source", "dist", "cli.cjs"), "setup"],
      appRoot,
    );

    assertBundlerSetup(appRoot, spec.bundler, spec.entryFile);

    run(npmCommand, ["run", "build"], appRoot);
    assertNoInstrumentationMarkers(path.join(appRoot, "dist"), sourcePath, spec);

    const logs = [];
    const devInvocation = createInvocation(npmCommand, ["run", "dev"]);
    child = spawn(devInvocation.command, devInvocation.args, {
      cwd: appRoot,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => logs.push(String(chunk)));
    child.stderr.on("data", (chunk) => logs.push(String(chunk)));

    const html = await waitForText(`http://127.0.0.1:${spec.port}/`, child, logs, 120000);
    const scripts = await fetchScriptsFromHtml(`http://127.0.0.1:${spec.port}/`, html, child, logs, 120000);

    assert(
      scripts.includes("data-click-to-source"),
      `${spec.name}: dev bundle did not inject data-click-to-source.\n${logs.join("")}`,
    );
    for (const pattern of spec.sourcePatterns) {
      assert(
        pattern.test(scripts),
        `${spec.name}: dev bundle reported an unexpected source line.\n${logs.join("")}\n${scripts}`,
      );
    }

    const response = await fetch(
      `http://127.0.0.1:${spec.port}/__click_to_source/open?file=${encodeURIComponent(spec.sourceFile)}&line=1&column=1&editor=vscode`,
    );
    const payload = await response.json();

    assert(
      response.ok && typeof payload.ok === "boolean",
      `${spec.name}: open endpoint did not respond as expected.\n${logs.join("")}`,
    );
  } finally {
    stopProcessTree(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts-smoke-bundlers-"));

  try {
    const tarballName = packPackage(tempRoot);
    const specs = [
      {
        name: "webpack",
        bundler: "webpack",
        dir: "webpack-app",
        port: await findFreePort(),
        createFiles: createWebpackFiles,
        entryFile: "index.jsx",
        sourceFile: "src/App.jsx",
        sourcePatterns: [/App\.jsx:3:\d+/],
      },
      {
        name: "webpack-tsx",
        bundler: "webpack",
        dir: "webpack-tsx-app",
        port: await findFreePort(),
        createFiles: createWebpackTsxFiles,
        entryFile: "index.tsx",
        sourceFile: "src/App.tsx",
        sourcePatterns: [
          /App\.tsx:24:\d+/,
          /App\.tsx:43:\d+/,
          /App\.tsx:44:\d+/,
          /App\.tsx:45:\d+/,
          /App\.tsx:49:\d+/,
        ],
      },
      {
        name: "rspack",
        bundler: "rspack",
        dir: "rspack-app",
        port: await findFreePort(),
        createFiles: createRspackFiles,
        entryFile: "index.jsx",
        sourceFile: "src/App.jsx",
        sourcePatterns: [/App\.jsx:3:\d+/],
      },
    ];

    for (const spec of specs) {
      await runBundlerSmokeCase(tempRoot, tarballName, spec);
    }

    console.log("Bundler smoke tests passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
