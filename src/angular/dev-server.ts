import { createRequire } from "module";
import type { IncomingMessage, ServerResponse } from "http";
import { createBuilder } from "@angular-devkit/architect";
import {
  executeDevServerBuilder,
  type DevServerBuilderOptions,
} from "@angular-devkit/build-angular";
import type { Configuration, RuleSetRule } from "webpack";
import { DEFAULT_SERVER_PATH } from "../constants";
import { createOpenRequestHandler } from "../server/open-handler";

const require = createRequire(import.meta.url);

export interface ClickToSourceAngularOptions extends DevServerBuilderOptions {
  clickToSource?: {
    enabled?: boolean;
    path?: string;
    editor?: string;
    allowRemote?: boolean;
    allowOutsideWorkspace?: boolean;
  };
}

type DevServerApp = {
  use: (
    handler: (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void
    ) => void
  ) => void;
};

type DevServerConfig = {
  setupMiddlewares?: (
    middlewares: unknown[],
    devServer?: { app?: DevServerApp }
  ) => unknown[];
  [key: string]: unknown;
};

function resolveLocalModulePath(basePath: string): string {
  const candidates = [basePath, `${basePath}.cjs`, `${basePath}.js`, `${basePath}.mjs`];
  for (const candidate of candidates) {
    try {
      return require.resolve(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`click-to-source: could not resolve local module '${basePath}'.`);
}

function hasTemplateLoader(rules: RuleSetRule[], loaderPath: string): boolean {
  return rules.some((rule) => {
    const use = (rule as any).use;
    if (!use) return false;
    const items = Array.isArray(use) ? use : [use];
    return items.some((item) => {
      const loader = typeof item === "string" ? item : item?.loader;
      return loader === loaderPath;
    });
  });
}

function applyClickToSourceWebpackConfig(
  config: Configuration,
  options: ClickToSourceAngularOptions
): Configuration {
  const configWithDevServer = config as Configuration & {
    devServer?: DevServerConfig;
  };
  const loaderPath = resolveLocalModulePath("./template-loader");

  const rules = (configWithDevServer.module?.rules || []) as RuleSetRule[];
  if (!hasTemplateLoader(rules, loaderPath)) {
    rules.unshift({
      test: /\.html$/,
      enforce: "pre",
      exclude: /node_modules/,
      use: [{ loader: loaderPath }],
    });
  }

  configWithDevServer.module = {
    ...(configWithDevServer.module || {}),
    rules,
  };

  const serverPath = options.clickToSource?.path || DEFAULT_SERVER_PATH;
  const handler = createOpenRequestHandler({
    path: serverPath,
    editor: options.clickToSource?.editor,
    allowRemote: options.clickToSource?.allowRemote,
    allowOutsideWorkspace: options.clickToSource?.allowOutsideWorkspace,
  });

  const originalSetup = configWithDevServer.devServer?.setupMiddlewares;
  configWithDevServer.devServer = {
    ...(configWithDevServer.devServer || {}),
    setupMiddlewares: (
      middlewares: unknown[],
      devServer?: { app?: DevServerApp }
    ) => {
      if (devServer?.app) {
        devServer.app.use((req, res, next) => handler(req, res, next));
      }
      return typeof originalSetup === "function"
        ? originalSetup(middlewares, devServer)
        : middlewares;
    },
  };

  return configWithDevServer;
}

const builder = createBuilder<ClickToSourceAngularOptions>((options, context) => {
  const enabled = options.clickToSource?.enabled !== false;
  if (!enabled) {
    return executeDevServerBuilder(options, context);
  }

  return executeDevServerBuilder(options, context, {
    webpackConfiguration: (config) =>
      applyClickToSourceWebpackConfig(config, options),
  });
});

export default builder;
