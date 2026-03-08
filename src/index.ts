/**
 * click-to-source - Main entry point
 * Ctrl+Click any UI element to open its source in VSCode
 */

import { configManager } from "./config";
import { ClickToSourceLocator } from "./locator";
import { ClickToSourceUI } from "./ui";
import { DATA_ATTR, GLOBAL_INIT_KEY } from "./constants";

export { configManager, type ClickToSourceConfig } from "./config";
export { ClickToSourceLocator } from "./locator";
export { ClickToSourceUI } from "./ui";

declare const __CLICK_TO_SOURCE_DEV__: boolean | undefined;

let locator: ClickToSourceLocator | null = null;
let ui: ClickToSourceUI | null = null;

/**
 * Initialize click-to-source
 * This is called automatically when using the Vite plugin
 */
export function initClickToSource(): void {
  if (typeof window === "undefined") {
    return;
  }

  const isDev =
    typeof __CLICK_TO_SOURCE_DEV__ !== "undefined"
      ? __CLICK_TO_SOURCE_DEV__
      : typeof process !== "undefined"
      ? process.env.NODE_ENV === "development"
      : false;

  // Only initialize in development, unless we can detect injected attributes
  if (!isDev) {
    const hasAttributes = document.querySelector(`[${DATA_ATTR}]`);
    if (!hasAttributes) return;
  }

  // Check if already initialized
  if ((window as any)[GLOBAL_INIT_KEY]) return;
  (window as any)[GLOBAL_INIT_KEY] = true;

  locator = new ClickToSourceLocator();
  locator.start();

  if (configManager.getConfig().showButton) {
    ui = new ClickToSourceUI();
  }

  console.log(
    "[click-to-source] Initialized - Ctrl+Click elements to open in VSCode"
  );
}

export function destroyClickToSource(): void {
  locator?.destroy();
  locator = null;
  ui?.destroy();
  ui = null;
  if (typeof window !== "undefined") {
    delete (window as any)[GLOBAL_INIT_KEY];
  }
}
