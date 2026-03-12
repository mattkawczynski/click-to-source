import test from "node:test";
import assert from "node:assert/strict";
import { ConfigManager } from "../src/config.ts";

class FakeStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("ConfigManager strips legacy repo-action settings from stored config", () => {
  const originalWindow = (globalThis as any).window;
  const storage = new FakeStorage();

  storage.setItem(
    "__click_to_source_config",
    JSON.stringify({
      action: "copyRepo",
      runtimeMode: "browserSafe",
      browserSafeAction: "copyIssue",
      repoBaseUrl: "https://github.com/acme/app",
      repoProvider: "github",
      hotkey: "alt",
      includeSelectors: ["button"],
    }),
  );

  (globalThis as any).window = {
    localStorage: storage,
  };

  try {
    const manager = new ConfigManager();
    const config = manager.getConfig();

    assert.equal(config.action, "open");
    assert.equal(config.hotkey, "alt");
    assert.deepEqual(config.includeSelectors, ["button"]);

    const persisted = JSON.parse(storage.getItem("__click_to_source_config") || "{}");
    assert.equal(persisted.action, "open");
    assert.equal("runtimeMode" in persisted, false);
    assert.equal("repoBaseUrl" in persisted, false);
    assert.equal("repoProvider" in persisted, false);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});
