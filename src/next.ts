import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export interface ClickToSourceNextOptions {
  enabled?: boolean;
  include?: string[];
}

type NextConfig = Record<string, any>;

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

function resolveNextInclude(root: string, include?: string[]): string[] {
  const candidates = include && include.length > 0 ? include : ["app", "pages", "src", "components"];

  return candidates
    .map((segment) => path.resolve(root, segment))
    .filter((candidate) => fs.existsSync(candidate));
}

function hasNextLoader(config: NextConfig): boolean {
  const rules = config?.module?.rules;
  if (!Array.isArray(rules)) {
    return false;
  }

  return rules.some((rule) => {
    const uses = Array.isArray(rule?.use) ? rule.use : rule?.use ? [rule.use] : [];
    return uses.some((use: { loader?: unknown }) =>
      use?.loader && String(use.loader).includes("click-to-source")
    );
  });
}

export function withClickToSourceNext(
  nextConfig: NextConfig = {},
  options: ClickToSourceNextOptions = {}
): NextConfig {
  const userWebpack = nextConfig.webpack;

  return {
    ...nextConfig,
    webpack(config: NextConfig, context: { dev?: boolean; dir?: string }) {
      const resolved = typeof userWebpack === "function"
        ? userWebpack(config, context) || config
        : config;

      if (!context?.dev || options.enabled === false || hasNextLoader(resolved)) {
        return resolved;
      }

      const projectRoot = context.dir || process.cwd();
      const include = resolveNextInclude(projectRoot, options.include);

      resolved.module = resolved.module || {};
      resolved.module.rules = Array.isArray(resolved.module.rules)
        ? resolved.module.rules
        : [];

      resolved.module.rules.unshift({
        test: /\.[jt]sx?$/,
        include,
        exclude: /node_modules/,
        enforce: "pre",
        use: [
          {
            loader: resolveLocalModule("./next-loader"),
            options: {
              cwd: projectRoot,
              enabled: true,
            },
          },
        ],
      });

      return resolved;
    },
  };
}

export default withClickToSourceNext;
