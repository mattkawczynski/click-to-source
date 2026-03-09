/**
 * click-to-source - Main entry point
 * Hold the configured hotkey and click any UI element to open its source
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
let pendingInitCleanup: (() => void) | null = null;

function hasSourceAttributes(): boolean {
  return !!document.querySelector(`[${DATA_ATTR}]`);
}

function clearPendingInit(): void {
  pendingInitCleanup?.();
  pendingInitCleanup = null;
}

function scheduleDeferredInit(): void {
  if (pendingInitCleanup) {
    return;
  }

  const retry = () => {
    if (!hasSourceAttributes()) {
      return;
    }

    clearPendingInit();
    initClickToSource();
  };

  if (typeof MutationObserver === "function" && document.documentElement) {
    const observer = new MutationObserver(retry);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [DATA_ATTR],
    });
    pendingInitCleanup = () => observer.disconnect();
    retry();
    return;
  }

  const interval = window.setInterval(retry, 50);
  pendingInitCleanup = () => window.clearInterval(interval);
}

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
  if (!isDev && !hasSourceAttributes()) {
    scheduleDeferredInit();
    return;
  }

  // Check if already initialized
  if ((window as any)[GLOBAL_INIT_KEY]) return;
  (window as any)[GLOBAL_INIT_KEY] = true;
  clearPendingInit();

  locator = new ClickToSourceLocator();
  locator.start();

  if (configManager.getConfig().showButton) {
    ui = new ClickToSourceUI();
  }

  console.log(
    "[click-to-source] Initialized - hold the configured hotkey and click elements to open source"
  );
}

export function destroyClickToSource(): void {
  clearPendingInit();
  locator?.destroy();
  locator = null;
  ui?.destroy();
  ui = null;
  if (typeof window !== "undefined") {
    delete (window as any)[GLOBAL_INIT_KEY];
  }
}
