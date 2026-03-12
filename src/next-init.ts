import { configManager } from "./config";
import { initClickToSource } from "./index";

const NEXT_SERVER_PATH = "/api/__click_to_source/open";

if (typeof window !== "undefined") {
  configManager.updateConfig({
    serverPath: NEXT_SERVER_PATH,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initClickToSource();
    });
  } else {
    initClickToSource();
  }
}

