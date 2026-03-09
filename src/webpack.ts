import type { Configuration, RuleSetRule } from "webpack";
import { createRequire } from "module";
import type { IncomingMessage, ServerResponse } from "http";
import { DEFAULT_SERVER_PATH } from "./constants.ts";
import { createOpenRequestHandler } from "./server/open-handler.ts";
import clickToSourceBabelPlugin from "./babel-plugin.ts";

const require = createRequire(import.meta.url);

export type ClickToSourceFramework = "react" | "vue" | "svelte" | "auto";

export interface ClickToSourceWebpackOptions {
  framework?: ClickToSourceFramework;
  enabled?: boolean;
  serverPath?: string;
  editor?: string;
  allowRemote?: boolean;
  allowOutsideWorkspace?: boolean;
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

function resolveLocalModule(basePath: string): string {
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

function loadLocalModule<T>(basePath: string): T {
  return require(resolveLocalModule(basePath)) as T;
}

function walkRules(rules: RuleSetRule[], visitor: (rule: RuleSetRule) => void) {
  rules.forEach((rule) => {
    visitor(rule);
    const nested = (rule as any).oneOf || (rule as any).rules;
    if (Array.isArray(nested)) {
      walkRules(nested, visitor);
    }
  });
}

function normalizeUse(use: any): Array<any> {
  if (!use) return [];
  if (Array.isArray(use)) return use;
  return [use];
}

function addBabelPlugin(options: any) {
  if (!options || typeof options !== "object") return;
  const plugins = Array.isArray(options.plugins) ? options.plugins : [];
  const hasPlugin = plugins.some((plugin: any) =>
    Array.isArray(plugin) ? plugin[0] === clickToSourceBabelPlugin : plugin === clickToSourceBabelPlugin
  );
  if (!hasPlugin) {
    plugins.push([clickToSourceBabelPlugin, {}]);
  }
  options.plugins = plugins;
}

function addVueTransform(options: any) {
  if (!options || typeof options !== "object") return;
  const { createVueClickToSourceTransform } = loadLocalModule<{
    createVueClickToSourceTransform: () => unknown;
  }>("./vue");
  options.compilerOptions = options.compilerOptions || {};
  const nodeTransforms = Array.isArray(options.compilerOptions.nodeTransforms)
    ? options.compilerOptions.nodeTransforms
    : [];
  nodeTransforms.push(createVueClickToSourceTransform());
  options.compilerOptions.nodeTransforms = nodeTransforms;
}

function addSveltePreprocess(options: any) {
  if (!options || typeof options !== "object") return;
  const { clickToSourceSveltePreprocess } = loadLocalModule<{
    clickToSourceSveltePreprocess: () => unknown;
  }>("./svelte");
  const preprocess = options.preprocess;
  const preprocessList = Array.isArray(preprocess)
    ? preprocess
    : preprocess
    ? [preprocess]
    : [];
  preprocessList.push(clickToSourceSveltePreprocess());
  options.preprocess = preprocessList;
}

function shouldEnableTransforms(
  config: Configuration,
  explicitEnabled?: boolean
): boolean {
  if (typeof explicitEnabled === "boolean") {
    return explicitEnabled;
  }

  const mode = config.mode || process.env.NODE_ENV;
  return mode !== "production";
}

export function withClickToSource(
  config: Configuration,
  options: ClickToSourceWebpackOptions = {}
): Configuration {
  const configWithDevServer = config as Configuration & {
    devServer?: DevServerConfig;
  };
  const enabled = shouldEnableTransforms(configWithDevServer, options.enabled);
  const framework = options.framework || "auto";
  const rules = (configWithDevServer.module?.rules || []) as RuleSetRule[];

  if (enabled) {
    walkRules(rules, (rule) => {
      const loaderField = (rule as any).loader;
      const optionsField = (rule as any).options;

      if (
        loaderField &&
        (framework === "react" || framework === "auto") &&
        loaderField.includes("babel-loader")
      ) {
        addBabelPlugin(optionsField);
      }

      if (
        loaderField &&
        (framework === "vue" || framework === "auto") &&
        loaderField.includes("vue-loader")
      ) {
        addVueTransform(optionsField);
      }

      if (
        loaderField &&
        (framework === "svelte" || framework === "auto") &&
        loaderField.includes("svelte-loader")
      ) {
        addSveltePreprocess(optionsField);
      }

      const uses = normalizeUse((rule as any).use);
      uses.forEach((use) => {
        const loader = typeof use === "string" ? use : use?.loader;
        const opts = typeof use === "string" ? undefined : use?.options;

        if (!loader) return;

        if (
          (framework === "react" || framework === "auto") &&
          loader.includes("babel-loader")
        ) {
          addBabelPlugin(opts);
        }

        if (
          (framework === "vue" || framework === "auto") &&
          loader.includes("vue-loader")
        ) {
          addVueTransform(opts);
        }

        if (
          (framework === "svelte" || framework === "auto") &&
          loader.includes("svelte-loader")
        ) {
          addSveltePreprocess(opts);
        }
      });
    });
  }

  configWithDevServer.module = { ...(configWithDevServer.module || {}), rules };

  const serverPath = options.serverPath || DEFAULT_SERVER_PATH;
  const handler = createOpenRequestHandler({
    path: serverPath,
    editor: options.editor,
    allowRemote: options.allowRemote,
    allowOutsideWorkspace: options.allowOutsideWorkspace,
  });

  const originalSetup = configWithDevServer.devServer?.setupMiddlewares;
  if (enabled) {
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
  }

  return configWithDevServer;
}
