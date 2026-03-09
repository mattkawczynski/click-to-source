import test from "node:test";
import assert from "node:assert/strict";
import {
  configManager,
  destroyClickToSource,
  initClickToSource,
} from "../src/index.ts";
import { DATA_ATTR, GLOBAL_INIT_KEY } from "../src/constants.ts";

class FakeStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class FakeDocument {
  public readonly documentElement = {};
  private listeners = new Map<string, Set<(event: any) => void>>();
  public hasSourceAttributes = false;

  querySelector(selector: string): object | null {
    if (selector === `[${DATA_ATTR}]`) {
      return this.hasSourceAttributes ? {} : null;
    }

    return null;
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeMutationObserver {
  public static instances: FakeMutationObserver[] = [];
  private readonly callback: () => void;
  public disconnected = false;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback();
  }
}

test("initClickToSource waits for late-rendered source attributes before starting", () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalMutationObserver = (globalThis as any).MutationObserver;

  const document = new FakeDocument();
  const windowListeners = new Map<string, Set<() => void>>();

  try {
    FakeMutationObserver.instances = [];
    (globalThis as any).document = document;
    (globalThis as any).window = {
      localStorage: new FakeStorage(),
      setInterval() {
        throw new Error("setInterval fallback should not be used when MutationObserver is available.");
      },
      clearInterval() {},
      addEventListener(type: string, listener: () => void) {
        if (!windowListeners.has(type)) {
          windowListeners.set(type, new Set());
        }
        windowListeners.get(type)?.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        windowListeners.get(type)?.delete(listener);
      },
    };
    (globalThis as any).MutationObserver = FakeMutationObserver;

    configManager.reset();
    configManager.set("showButton", false);

    initClickToSource();

    assert.equal(document.listenerCount("click"), 0);
    assert.equal((globalThis as any).window[GLOBAL_INIT_KEY], undefined);
    assert.equal(FakeMutationObserver.instances.length, 1);

    document.hasSourceAttributes = true;
    FakeMutationObserver.instances[0].trigger();

    assert.equal(document.listenerCount("click"), 1);
    assert.equal(document.listenerCount("mousemove"), 1);
    assert.equal((globalThis as any).window[GLOBAL_INIT_KEY], true);
    assert.equal(FakeMutationObserver.instances[0].disconnected, true);
  } finally {
    destroyClickToSource();
    configManager.reset();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).MutationObserver = originalMutationObserver;
  }
});
