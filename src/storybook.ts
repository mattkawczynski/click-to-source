import { createRequire } from "module";
import {
  clickToSourceReact,
  clickToSourceSvelte,
  clickToSourceVue,
  type ClickToSourceViteOptions,
} from "./vite-plugin.ts";
import {
  withClickToSource,
  type ClickToSourceFramework,
  type ClickToSourceWebpackOptions,
} from "./webpack.ts";

const require = createRequire(import.meta.url);

type StorybookFramework = "react" | "vue" | "svelte";
type StorybookBuilder = "vite" | "webpack" | "auto";
type StorybookConfig = Record<string, any>;

export interface ClickToSourceStorybookOptions
  extends Omit<ClickToSourceViteOptions, "framework">,
    Omit<ClickToSourceWebpackOptions, "framework"> {
  framework?: StorybookFramework;
  builder?: StorybookBuilder;
}

function inferBuilder(config: StorybookConfig): Exclude<StorybookBuilder, "auto"> {
  const framework =
    typeof config.framework === "string"
      ? config.framework
      : config.framework?.name || "";

  return framework.includes("vite") ? "vite" : "webpack";
}

function resolveConsumerModule(id: string): string {
  return require.resolve(id, { paths: [process.cwd()] });
}

function loadConsumerModule<T>(id: string): T {
  return require(resolveConsumerModule(id)) as T;
}

function hasPluginNamed(plugins: unknown[], names: string[]): boolean {
  return plugins.some((plugin) => {
    const name = (plugin as { name?: string })?.name;
    return typeof name === "string" && names.includes(name);
  });
}

function getVitePlugins(
  framework: StorybookFramework,
  options: ClickToSourceStorybookOptions
) {
  if (framework === "react") {
    const reactModule = loadConsumerModule<Record<string, unknown>>("@vitejs/plugin-react");
    const reactFactory = (reactModule.default || reactModule) as (
      options?: Record<string, unknown>
    ) => unknown;

    return [reactFactory(), ...clickToSourceReact(options)];
  }

  if (framework === "vue") {
    return clickToSourceVue(options);
  }

  if (framework === "svelte") {
    return clickToSourceSvelte(options);
  }

  return clickToSourceReact(options);
}

function getWebpackFramework(framework: StorybookFramework): ClickToSourceFramework {
  return framework === "vue"
    ? "vue"
    : framework === "svelte"
    ? "svelte"
    : "react";
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

export function withClickToSourceStorybook(
  config: StorybookConfig,
  options: ClickToSourceStorybookOptions = {}
): StorybookConfig {
  const framework = options.framework || "react";
  const builder =
    options.builder && options.builder !== "auto"
      ? options.builder
      : inferBuilder(config);
  const previewEntry = resolveLocalModule("./storybook-preview");
  const userPreviewAnnotations = config.previewAnnotations;

  async function resolvePreviewAnnotations(baseEntries: string[] = []): Promise<string[]> {
    const resolved =
      typeof userPreviewAnnotations === "function"
        ? (await userPreviewAnnotations(baseEntries)) || baseEntries
        : Array.isArray(userPreviewAnnotations)
        ? userPreviewAnnotations
        : baseEntries;

    return resolved.includes(previewEntry) ? resolved : [...resolved, previewEntry];
  }

  if (builder === "vite") {
    const userViteFinal = config.viteFinal;

    return {
      ...config,
      previewAnnotations: resolvePreviewAnnotations,
      async viteFinal(baseConfig: StorybookConfig, context: unknown) {
        const resolved =
          typeof userViteFinal === "function"
            ? (await userViteFinal(baseConfig, context)) || baseConfig
            : baseConfig;

        resolved.plugins = Array.isArray(resolved.plugins)
          ? resolved.plugins
          : [];
        if (
          framework === "react" &&
          hasPluginNamed(resolved.plugins, ["vite:react-babel", "vite:react-refresh"])
        ) {
          resolved.plugins.push(...clickToSourceReact(options));
        } else {
          resolved.plugins.push(...getVitePlugins(framework, options));
        }
        return resolved;
      },
    };
  }

  const userWebpackFinal = config.webpackFinal;
  return {
    ...config,
    previewAnnotations: resolvePreviewAnnotations,
    async webpackFinal(baseConfig: StorybookConfig, context: unknown) {
      const resolved =
        typeof userWebpackFinal === "function"
          ? (await userWebpackFinal(baseConfig, context)) || baseConfig
          : baseConfig;

      return withClickToSource(resolved, {
        ...options,
        framework: getWebpackFramework(framework),
      });
    },
  };
}

export default withClickToSourceStorybook;
