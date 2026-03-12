import { createRequire } from "module";
import {
  clickToSourceReact,
  clickToSourceSvelte,
  clickToSourceVue,
  type ClickToSourceViteOptions,
} from "./vite-plugin.ts";

const require = createRequire(import.meta.url);

export type ClickToSourceAstroFramework = "react" | "vue" | "svelte";

export interface ClickToSourceAstroOptions
  extends Omit<ClickToSourceViteOptions, "framework"> {
  framework?: ClickToSourceAstroFramework | "auto";
}

function hasPackage(pkg: string): boolean {
  try {
    require.resolve(pkg, { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
}

function resolveFramework(
  framework: ClickToSourceAstroOptions["framework"]
): ClickToSourceAstroFramework {
  if (framework && framework !== "auto") {
    return framework;
  }

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

export function clickToSourceAstro(options: ClickToSourceAstroOptions = {}) {
  return {
    name: "click-to-source",
    hooks: {
      "astro:config:setup"(astro: {
        updateConfig: (value: Record<string, unknown>) => void;
        injectScript: (stage: "page", content: string) => void;
      }) {
        const framework = resolveFramework(options.framework);
        const vitePlugins =
          framework === "vue"
            ? clickToSourceVue(options)
            : framework === "svelte"
            ? clickToSourceSvelte(options)
            : clickToSourceReact(options);

        astro.updateConfig({
          vite: {
            plugins: vitePlugins,
          },
        });
        astro.injectScript("page", 'import "click-to-source/init";');
      },
    },
  };
}

export default clickToSourceAstro;
