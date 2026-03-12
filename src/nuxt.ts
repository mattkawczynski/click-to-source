import MagicString from "magic-string";
import { createRequire } from "module";
import type { Plugin } from "vite";
import { ElementTypes, NodeTypes, baseParse, type ElementNode, type TemplateChildNode } from "@vue/compiler-core";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { DEFAULT_SERVER_PATH } from "./constants.ts";
import { DATA_ATTR } from "./constants.ts";
import { createOpenRequestHandler } from "./server/open-handler.ts";
import type { PathMapping } from "./path-mapping.ts";

const require = createRequire(import.meta.url);

function resolveLocalModule(
  basePath: string,
  options: { preferEsm?: boolean } = {}
): string {
  const candidates = options.preferEsm
    ? [`${basePath}.mjs`, basePath, `${basePath}.js`, `${basePath}.cjs`]
    : [basePath, `${basePath}.cjs`, `${basePath}.js`, `${basePath}.mjs`];
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

function visitVueChildren(
  children: TemplateChildNode[],
  visitor: (node: ElementNode) => void
): void {
  for (const child of children) {
    if (child.type !== NodeTypes.ELEMENT) {
      continue;
    }

    const element = child as ElementNode;
    visitor(element);

    const nested = (element.children || []) as TemplateChildNode[];
    if (nested.length > 0) {
      visitVueChildren(nested, visitor);
    }
  }
}

function findTagInsertOffset(source: string, startOffset: number): number | null {
  let quote: '"' | "'" | null = null;

  for (let index = startOffset; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }

    if (char === "/" && next === ">") {
      return index;
    }
  }

  return null;
}

function createVueSfcSourcePlugin(): Plugin {
  return {
    name: "click-to-source-nuxt-vue-transform",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const [filePath] = id.split("?", 1);
      if (!filePath.endsWith(".vue")) {
        return null;
      }

      const parsed = parseSfc(code, { filename: filePath });
      const template = parsed.descriptor.template;
      if (!template?.content) {
        return null;
      }

      const ast = baseParse(template.content, { comments: false });
      const templateStart = template.loc.start.offset;
      const normalizedFile = filePath.replace(/\\/g, "/");
      const magic = new MagicString(code);
      let changed = false;

      visitVueChildren(ast.children as TemplateChildNode[], (element) => {
        if (element.tagType === ElementTypes.TEMPLATE) {
          return;
        }

        const hasAttribute = element.props.some(
          (prop) => prop.type === NodeTypes.ATTRIBUTE && prop.name === DATA_ATTR
        );
        if (hasAttribute) {
          return;
        }

        const insertOffset = findTagInsertOffset(code, templateStart + element.loc.start.offset);
        if (insertOffset == null) {
          return;
        }

        const line = element.loc.start.line || 1;
        const column = element.loc.start.column || 1;
        magic.appendLeft(
          insertOffset,
          ` ${DATA_ATTR}="${normalizedFile}:${line}:${column}"`
        );
        changed = true;
      });

      if (!changed) {
        return null;
      }

      return {
        code: magic.toString(),
        map: magic.generateMap({ hires: true, source: filePath }),
      };
    },
  };
}

function createNuxtBasePlugin(options: ClickToSourceNuxtOptions): Plugin {
  const handler = createOpenRequestHandler({
    path: options.serverPath || DEFAULT_SERVER_PATH,
    editor: options.editor,
    allowRemote: options.allowRemote,
    allowOutsideWorkspace: options.allowOutsideWorkspace,
    pathMappings: options.pathMappings,
  });

  return {
    name: "click-to-source",
    apply: "serve",
    config() {
      return {
        define: {
          __CLICK_TO_SOURCE_DEV__: true,
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => handler(req, res, next));
    },
  };
}

export interface ClickToSourceNuxtOptions {
  serverPath?: string;
  editor?: string;
  allowRemote?: boolean;
  allowOutsideWorkspace?: boolean;
  pathMappings?: PathMapping[];
}

type NuxtModuleOptions = {
  dev?: boolean;
  plugins?: Array<string | { src?: string; mode?: string }>;
};

export function clickToSourceNuxt(options: ClickToSourceNuxtOptions = {}) {
  const { createVueClickToSourceTransform } = loadLocalModule<{
    createVueClickToSourceTransform: () => unknown;
  }>("./vue");
  const sourceTransform = createVueClickToSourceTransform();
  const vueSfcSourcePlugin = createVueSfcSourcePlugin();

  return function clickToSourceNuxtModule(
    _moduleOptions: unknown,
    nuxt: {
      options: NuxtModuleOptions;
      hook: (name: string, callback: (config: Record<string, any>) => void) => void;
    }
  ): void {
    const nuxtOptions = nuxt.options;
    const isDev = nuxtOptions.dev === true;

    if (!isDev) {
      return;
    }

    nuxt.hook("vite:extendConfig", (viteConfig) => {
      const vitePlugins = Array.isArray(viteConfig.plugins) ? viteConfig.plugins : [];
      if (!vitePlugins.some((plugin: { name?: string }) => plugin?.name === "click-to-source")) {
        vitePlugins.push(createNuxtBasePlugin(options));
      }
      if (!vitePlugins.some((plugin: { name?: string }) => plugin?.name === "click-to-source-nuxt-vue-transform")) {
        vitePlugins.push(vueSfcSourcePlugin);
      }
      viteConfig.plugins = vitePlugins;

      const vueOptions = viteConfig.vue && typeof viteConfig.vue === "object" ? viteConfig.vue : {};
      const template = vueOptions.template && typeof vueOptions.template === "object"
        ? vueOptions.template
        : {};
      const compilerOptions = template.compilerOptions && typeof template.compilerOptions === "object"
        ? template.compilerOptions
        : {};
      const nodeTransforms = Array.isArray(compilerOptions.nodeTransforms)
        ? [...compilerOptions.nodeTransforms]
        : [];

      if (!nodeTransforms.includes(sourceTransform)) {
        nodeTransforms.push(sourceTransform);
      }

      viteConfig.vue = {
        ...vueOptions,
        template: {
          ...template,
          compilerOptions: {
            ...compilerOptions,
            nodeTransforms,
          },
        },
      };
    });

    const pluginPath = resolveLocalModule("./nuxt-plugin", { preferEsm: true });
    const plugins = Array.isArray(nuxtOptions.plugins) ? nuxtOptions.plugins : [];
    const alreadyRegistered = plugins.some((plugin: string | { src?: string }) => {
      if (typeof plugin === "string") {
        return plugin === pluginPath;
      }

      return plugin?.src === pluginPath;
    });

    if (!alreadyRegistered) {
      plugins.push({
        src: pluginPath,
        mode: "client",
      });
      nuxtOptions.plugins = plugins;
    }
  };
}

export default clickToSourceNuxt;
