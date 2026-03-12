import { transformAsync } from "@babel/core";
import { createRequire } from "module";
import clickToSourceBabelPlugin from "./babel-plugin.ts";

const require = createRequire(import.meta.url);

type LoaderContext = {
  async: () => (error: Error | null, source?: string, map?: unknown) => void;
  cacheable?: (value?: boolean) => void;
  getOptions?: () => { cwd?: string; enabled?: boolean };
  resourcePath: string;
  rootContext?: string;
  sourceMap?: boolean;
};

async function transformSource(
  source: string,
  context: LoaderContext
): Promise<{ code: string; map?: unknown }> {
  const options = context.getOptions?.() || {};
  const cwd = options.cwd || context.rootContext || process.cwd();
  const nextBabelPreset = require.resolve("next/babel", { paths: [cwd] });

  const result = await transformAsync(source, {
    filename: context.resourcePath,
    babelrc: false,
    configFile: false,
    compact: false,
    retainLines: true,
    sourceMaps: Boolean(context.sourceMap),
    sourceFileName: context.resourcePath,
    presets: [nextBabelPreset],
    plugins: [[clickToSourceBabelPlugin, { enabled: options.enabled !== false }]],
  });

  return {
    code: result?.code || source,
    map: result?.map,
  };
}

export default function nextLoader(this: LoaderContext, source: string): void {
  const callback = this.async();
  this.cacheable?.(true);

  transformSource(source, this)
    .then(({ code, map }) => callback(null, code, map))
    .catch((error) => {
      const message =
        error instanceof Error
          ? error
          : new Error("click-to-source: Next.js transform failed.");
      callback(message);
    });
}
