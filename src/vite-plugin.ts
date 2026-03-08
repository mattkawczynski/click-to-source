import type { Plugin } from "vite";
import { createRequire } from "module";
import { DEFAULT_SERVER_PATH } from "./constants";
import { createOpenRequestHandler } from "./server/open-handler";
import clickToSourceBabelPlugin from "./babel-plugin";

const require = createRequire(import.meta.url);

export type ClickToSourceFramework = "react" | "vue" | "svelte" | "auto";

export interface ClickToSourceViteOptions {
  framework?: ClickToSourceFramework;
  serverPath?: string;
  editor?: string;
  allowRemote?: boolean;
  allowOutsideWorkspace?: boolean;
  react?: Record<string, unknown>;
  vue?: Record<string, unknown>;
  svelte?: Record<string, unknown>;
}

function shouldEnableDevTransforms(): boolean {
  return process.env.NODE_ENV !== "production";
}

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

function resolveConsumerModule(id: string): string {
  return require.resolve(id, { paths: [process.cwd()] });
}

function loadConsumerModule<T>(id: string): T {
  return require(resolveConsumerModule(id)) as T;
}

function hasPackage(pkg: string): boolean {
  try {
    resolveConsumerModule(pkg);
    return true;
  } catch {
    return false;
  }
}

function resolveFramework(framework: ClickToSourceFramework): ClickToSourceFramework {
  if (framework !== "auto") return framework;

  if (hasPackage("@vitejs/plugin-react")) {
    return "react";
  }
  if (hasPackage("@vitejs/plugin-vue")) {
    return "vue";
  }
  if (hasPackage("@sveltejs/vite-plugin-svelte")) {
    return "svelte";
  }

  return "react";
}

function createReactPlugin(): Plugin[] {
  type ReactBabelOptions = {
    plugins?: unknown[];
  };

  return [
    {
      name: "click-to-source-react-babel",
      apply: "serve",
      api: {
        reactBabel(babelOptions: ReactBabelOptions) {
          if (!shouldEnableDevTransforms()) return;

          const plugins = Array.isArray(babelOptions.plugins)
            ? babelOptions.plugins
            : (babelOptions.plugins = []);
          const alreadyRegistered = plugins.some((plugin) => {
            if (Array.isArray(plugin)) {
              return plugin[0] === clickToSourceBabelPlugin;
            }
            return plugin === clickToSourceBabelPlugin;
          });

          if (!alreadyRegistered) {
            plugins.push([clickToSourceBabelPlugin, { enabled: true }]);
          }
        },
      },
    } as Plugin,
  ];
}

function createVuePlugin(options: ClickToSourceViteOptions): Plugin[] {
  const { createVueClickToSourceTransform } = loadLocalModule<{
    createVueClickToSourceTransform: () => unknown;
  }>("./vue");
  let vueModule: Record<string, unknown>;
  try {
    vueModule = loadConsumerModule<Record<string, unknown>>(
      "@vitejs/plugin-vue"
    );
  } catch (error) {
    throw new Error(
      "click-to-source: @vitejs/plugin-vue is required for Vue support."
    );
  }
  const vueFactory = (vueModule.default || vueModule) as (
    options?: Record<string, unknown>
  ) => Plugin;

  const vueOptions = options.vue || {};
  const template = (vueOptions as any).template || {};
  const compilerOptions = template.compilerOptions || {};
  const nodeTransforms = Array.isArray(compilerOptions.nodeTransforms)
    ? [...compilerOptions.nodeTransforms]
    : [];

  if (shouldEnableDevTransforms()) {
    nodeTransforms.push(createVueClickToSourceTransform());
  }

  return [
    vueFactory({
      ...vueOptions,
      template: {
        ...template,
        compilerOptions: {
          ...compilerOptions,
          nodeTransforms,
        },
      },
    }),
  ];
}

function createSveltePlugin(options: ClickToSourceViteOptions): Plugin[] {
  const { clickToSourceSveltePreprocess } = loadLocalModule<{
    clickToSourceSveltePreprocess: () => unknown;
  }>("./svelte");
  let svelteModule: Record<string, unknown>;
  try {
    svelteModule = loadConsumerModule<Record<string, unknown>>(
      "@sveltejs/vite-plugin-svelte"
    );
  } catch (error) {
    throw new Error(
      "click-to-source: @sveltejs/vite-plugin-svelte is required for Svelte support."
    );
  }
  const svelteFactory = (
    svelteModule.svelte ||
    svelteModule.default ||
    svelteModule
  ) as (options?: Record<string, unknown>) => Plugin;

  const svelteOptions = options.svelte || {};
  const preprocess = (svelteOptions as any).preprocess;
  const preprocessList = Array.isArray(preprocess)
    ? [...preprocess]
    : preprocess
    ? [preprocess]
    : [];

  if (shouldEnableDevTransforms()) {
    preprocessList.push(clickToSourceSveltePreprocess());
  }

  return [
    svelteFactory({
      ...svelteOptions,
      preprocess: preprocessList,
    }),
  ];
}

export function clickToSource(
  options: ClickToSourceViteOptions = {}
): Plugin[] {
  const serverPath = options.serverPath || DEFAULT_SERVER_PATH;
  const framework = resolveFramework(options.framework || "auto");
  const handler = createOpenRequestHandler({
    path: serverPath,
    editor: options.editor,
    allowRemote: options.allowRemote,
    allowOutsideWorkspace: options.allowOutsideWorkspace,
  });

  const base: Plugin = {
    name: "click-to-source",
    apply: "serve",
    config() {
      return {
        define: {
          __CLICK_TO_SOURCE_DEV__: true,
        },
      };
    },
    configResolved(resolvedConfig) {
      if (framework !== "react") return;
      const hasReactPlugin = resolvedConfig.plugins.some(
        (plugin) =>
          plugin.name === "vite:react-babel" ||
          plugin.name === "vite:react-refresh"
      );

      if (!hasReactPlugin) {
        throw new Error(
          "click-to-source: clickToSourceReact() requires @vitejs/plugin-react in your Vite config. Use plugins: [react(), clickToSourceReact()]."
        );
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => handler(req, res, next));
    },
  };

  const plugins: Plugin[] = [base];

  if (framework === "react") {
    plugins.push(...createReactPlugin());
  } else if (framework === "vue") {
    plugins.push(...createVuePlugin(options));
  } else if (framework === "svelte") {
    plugins.push(...createSveltePlugin(options));
  }

  return plugins;
}

export function clickToSourceReact(
  options: Omit<ClickToSourceViteOptions, "framework"> = {}
): Plugin[] {
  return clickToSource({ ...options, framework: "react" });
}

export function clickToSourceVue(
  options: Omit<ClickToSourceViteOptions, "framework"> = {}
): Plugin[] {
  return clickToSource({ ...options, framework: "vue" });
}

export function clickToSourceSvelte(
  options: Omit<ClickToSourceViteOptions, "framework"> = {}
): Plugin[] {
  return clickToSource({ ...options, framework: "svelte" });
}

export default clickToSource;
