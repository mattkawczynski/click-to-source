/**
 * Auto-initialization entry point
 * Import this to automatically set up click-to-source
 *
 * Usage:
 * import 'click-to-source/init';
 */

import { initClickToSource } from "./index";

// Auto-initialize when this module is imported
if (typeof window !== "undefined") {
  // Initialize in next tick to ensure DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initClickToSource();
    });
  } else {
    initClickToSource();
  }
}
