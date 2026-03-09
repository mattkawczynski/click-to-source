import test from "node:test";
import assert from "node:assert/strict";
import { ClickToSourceLocator } from "../src/locator.ts";
import { configManager } from "../src/config.ts";
import { DATA_ATTR, HIGHLIGHT_CLASS, PREVIEW_CLASS } from "../src/constants.ts";

class FakeClassList {
  private values = new Set<string>();

  add(...tokens: string[]): void {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens: string[]): void {
    tokens.forEach((token) => this.values.delete(token));
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }
}

class FakeElement {
  public parentElement: FakeElement | null = null;
  public children: FakeElement[] = [];
  public classList = new FakeClassList();
  private attributes = new Map<string, string>();
  public readonly tagName: string;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  closest(selector: string): FakeElement | null {
    let current: FakeElement | null = this;

    while (current) {
      if (matchesSelector(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }
}

class FakeStyleElement extends FakeElement {
  public id = "";
  public textContent = "";

  constructor() {
    super("style");
  }
}

class FakeDocument {
  public readonly head = new FakeElement("head");
  private listeners = new Map<string, Set<(event: any) => void>>();
  private elementsById = new Map<string, FakeStyleElement>();
  private hoverTarget: FakeElement | null = null;

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(type: string, event: any): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  createElement(tagName: string): FakeElement {
    if (tagName === "style") {
      const style = new FakeStyleElement();
      Object.defineProperty(style, "id", {
        get: () => styleId.get(style) ?? "",
        set: (value: string) => {
          styleId.set(style, value);
          this.elementsById.set(value, style);
        },
        configurable: true,
        enumerable: true,
      });
      return style;
    }

    return new FakeElement(tagName);
  }

  getElementById(id: string): FakeStyleElement | null {
    return this.elementsById.get(id) ?? null;
  }

  elementFromPoint(): FakeElement | null {
    return this.hoverTarget;
  }

  setHoverTarget(element: FakeElement | null): void {
    this.hoverTarget = element;
  }
}

const styleId = new WeakMap<FakeStyleElement, string>();

class FakeStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (selector.startsWith("#")) {
    return element.getAttribute("id") === selector.slice(1);
  }

  const attrMatch = selector.match(/^\[(.+)\]$/);
  if (attrMatch) {
    return element.getAttribute(attrMatch[1]) !== null;
  }

  return false;
}

test("holding the configured hotkey previews the hovered source element", () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalElement = (globalThis as any).Element;

  const document = new FakeDocument();
  const windowListeners = new Map<string, Set<() => void>>();

  try {
    (globalThis as any).Element = FakeElement;
    (globalThis as any).document = document;
    (globalThis as any).window = {
      localStorage: new FakeStorage(),
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

    configManager.reset();
    configManager.set("hotkey", "alt");

    const root = new FakeElement("main");
    const target = root.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");
    document.setHoverTarget(target);

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      document.dispatchEvent("mousemove", {
        target,
        clientX: 10,
        clientY: 20,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        shiftKey: false,
      });

      assert.equal(target.classList.contains(PREVIEW_CLASS), false);

      document.dispatchEvent("keydown", { key: "Alt" });

      assert.equal(target.classList.contains(PREVIEW_CLASS), true);
      assert.ok(document.getElementById("__click-to-source-highlight-styles"));

      document.dispatchEvent("keyup", { key: "Alt" });

      assert.equal(target.classList.contains(PREVIEW_CLASS), false);
    } finally {
      locator.destroy();
    }
  } finally {
    configManager.reset();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Element = originalElement;
  }
});

test("ctrl+click still flashes the target element", async () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalElement = (globalThis as any).Element;
  const originalFetch = globalThis.fetch;

  const document = new FakeDocument();
  const openedUrls: string[] = [];

  try {
    (globalThis as any).Element = FakeElement;
    (globalThis as any).document = document;
    (globalThis as any).window = {
      localStorage: new FakeStorage(),
      addEventListener() {},
      removeEventListener() {},
      open(url: string) {
        openedUrls.push(url);
      },
    };

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    configManager.reset();

    const target = new FakeElement("button");
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      document.dispatchEvent("click", {
        target,
        button: 0,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });

      assert.equal(target.classList.contains(HIGHLIGHT_CLASS), true);

      await new Promise((resolve) => setTimeout(resolve, 250));

      assert.equal(target.classList.contains(HIGHLIGHT_CLASS), false);
      assert.equal(openedUrls[0], "vscode://file/src/App.tsx:10:3");
    } finally {
      locator.destroy();
    }
  } finally {
    configManager.reset();
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Element = originalElement;
  }
});
