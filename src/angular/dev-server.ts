import { createRequire } from "module";
import type { IncomingMessage, ServerResponse } from "http";
import type { createBuilder } from "@angular-devkit/architect";
import type {
  executeDevServerBuilder,
  DevServerBuilderOptions,
} from "@angular-devkit/build-angular";
import type { Configuration } from "webpack";
import { DEFAULT_SERVER_PATH } from "../constants";
import { createOpenRequestHandler } from "../server/open-handler";
import { instrumentAngularTemplate } from "./instrument-template";

const require = createRequire(import.meta.url);
const angularArchitect = loadConsumerModule<{
  createBuilder: typeof createBuilder;
}>("@angular-devkit/architect");
const buildAngular = loadConsumerModule<{
  executeDevServerBuilder: typeof executeDevServerBuilder;
}>("@angular-devkit/build-angular");

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

function resolveConsumerModule(id: string): string {
  return require.resolve(id, { paths: [process.cwd()] });
}

function loadConsumerModule<T>(id: string): T {
  return require(resolveConsumerModule(id)) as T;
}

function patchAngularHostResourceInstrumentation(): void {
  const hostModule = loadConsumerModule<{
    augmentHostWithResources?: (
      host: {
        readResource?: (fileName: string) => Promise<string> | string;
      },
      resourceLoader: unknown,
      options?: unknown
    ) => void;
    __clickToSourcePatched?: boolean;
  }>("@ngtools/webpack/src/ivy/host");

  if (hostModule.__clickToSourcePatched) {
    return;
  }

  const original = hostModule.augmentHostWithResources;
  if (typeof original !== "function") {
    throw new Error(
      "click-to-source: could not patch Angular resource loading."
    );
  }

  hostModule.augmentHostWithResources = (host, resourceLoader, options) => {
    original(host, resourceLoader, options);

    const baseReadResource = host.readResource;
    if (typeof baseReadResource !== "function") {
      return;
    }

    host.readResource = async (fileName: string) => {
      const result = await Promise.resolve(baseReadResource.call(host, fileName));
      if (
        typeof result === "string" &&
        (fileName.endsWith(".html") || fileName.endsWith(".svg"))
      ) {
        return instrumentAngularTemplate(result, fileName);
      }
      return result;
    };
  };

  hostModule.__clickToSourcePatched = true;
}

function applyClickToSourceWebpackConfig(
  config: Configuration,
  options: ClickToSourceAngularOptions
): Configuration {
  const configWithDevServer = config as Configuration & {
    devServer?: DevServerConfig;
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

const builder = angularArchitect.createBuilder<ClickToSourceAngularOptions>(
  (options, context) => {
    const enabled = options.clickToSource?.enabled !== false;
    if (!enabled) {
      return buildAngular.executeDevServerBuilder(options, context);
    }

    patchAngularHostResourceInstrumentation();

    return buildAngular.executeDevServerBuilder(options, context, {
      webpackConfiguration: (config) =>
        applyClickToSourceWebpackConfig(config, options),
    });
  }
);

export default builder;
