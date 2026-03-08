declare module "@angular-devkit/architect" {
  export interface BuilderContext {
    [key: string]: unknown;
  }

  export function createBuilder<T extends object>(
    handler: (options: T, context: BuilderContext) => unknown
  ): unknown;
}

declare module "@angular-devkit/build-angular" {
  import type { Configuration } from "webpack";
  import type { BuilderContext } from "@angular-devkit/architect";

  export interface DevServerBuilderOptions {
    [key: string]: unknown;
  }

  export function executeDevServerBuilder(
    options: DevServerBuilderOptions,
    context: BuilderContext,
    transforms?: {
      webpackConfiguration?: (config: Configuration) => Configuration;
    }
  ): unknown;
}
