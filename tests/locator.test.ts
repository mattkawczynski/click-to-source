import test from "node:test";
import assert from "node:assert/strict";
import { ClickToSourceLocator } from "../src/locator.ts";
import { configManager } from "../src/config.ts";
import {
  DATA_ATTR,
  HIGHLIGHT_CLASS,
  PREVIEW_CLASS,
  TOAST_ID,
  TOOLTIP_ID,
} from "../src/constants.ts";

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
  public style: Record<string, string> = {};
  public textContent = "";
  public id = "";
  private attributes = new Map<string, string>();
  public readonly tagName: string;

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this,
    );
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    if (name === "id") {
      this.id = value;
    }
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    if (name === "id" && this.id) {
      return this.id;
    }
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

  matches(selector: string): boolean {
    return matchesSelector(this, selector);
  }

  focus(): void {}

  select(): void {}
}

class FakeDocument {
  public readonly head = new FakeElement("head");
  public readonly body = new FakeElement("body");
  public readonly documentElement = new FakeElement("html");
  private listeners = new Map<string, Set<(event: any) => void>>();
  private hoverTarget: FakeElement | null = null;

  constructor() {
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
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

  dispatchEvent(type: string, event: any): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  getElementById(id: string): FakeElement | null {
    return findById(this.documentElement, id);
  }

  elementFromPoint(): FakeElement | null {
    return this.hoverTarget;
  }

  setHoverTarget(element: FakeElement | null): void {
    this.hoverTarget = element;
  }

  execCommand(command: string): boolean {
    return command === "copy";
  }
}

class FakeStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function findById(root: FakeElement, id: string): FakeElement | null {
  if (root.id === id) {
    return root;
  }

  for (const child of root.children) {
    const match = findById(child, id);
    if (match) {
      return match;
    }
  }

  return null;
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  return selector
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .some((part) => matchesSelectorPart(element, part));
}

function matchesSelectorPart(element: FakeElement, selector: string): boolean {
  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  if (selector.startsWith(".")) {
    return element.classList.contains(selector.slice(1));
  }

  const attrMatch = selector.match(/^\[(.+)\]$/);
  if (attrMatch) {
    return element.getAttribute(attrMatch[1]) !== null;
  }

  return element.tagName === selector.toLowerCase();
}

function setupLocatorEnvironment() {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalElement = (globalThis as any).Element;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const originalFetch = globalThis.fetch;

  const document = new FakeDocument();
  const storage = new FakeStorage();
  const openedUrls: string[] = [];
  const copiedTexts: string[] = [];
  const windowListeners = new Map<string, Set<() => void>>();

  (globalThis as any).Element = FakeElement;
  (globalThis as any).document = document;
  (globalThis as any).window = {
    localStorage: storage,
    innerWidth: 1280,
    innerHeight: 720,
    location: {
      hostname: "127.0.0.1",
    },
    addEventListener(type: string, listener: () => void) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, new Set());
      }
      windowListeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      windowListeners.get(type)?.delete(listener);
    },
    open(url: string) {
      openedUrls.push(url);
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text: string) {
          copiedTexts.push(text);
        },
      },
    },
  });

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  return {
    document,
    openedUrls,
    copiedTexts,
    cleanup() {
      configManager.reset();
      globalThis.fetch = originalFetch;
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      (globalThis as any).Element = originalElement;
      if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
      } else {
        delete (globalThis as any).navigator;
      }
    },
  };
}

test("holding the configured hotkey previews the hovered source element and shows a tooltip", () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.set("hotkey", "alt");

    const root = env.document.body.appendChild(new FakeElement("main"));
    const target = root.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");
    env.document.setHoverTarget(target);

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("mousemove", {
        target,
        clientX: 10,
        clientY: 20,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        shiftKey: false,
      });

      assert.equal(target.classList.contains(PREVIEW_CLASS), false);

      env.document.dispatchEvent("keydown", { key: "Alt" });

      const tooltip = env.document.getElementById(TOOLTIP_ID);
      assert.equal(target.classList.contains(PREVIEW_CLASS), true);
      assert.ok(env.document.getElementById("__click-to-source-highlight-styles"));
      assert.ok(tooltip);
      assert.equal(tooltip?.style.display, "block");
      assert.match(tooltip?.textContent ?? "", /Open src\/App\.tsx:10:3/);

      env.document.dispatchEvent("keyup", { key: "Alt" });

      assert.equal(target.classList.contains(PREVIEW_CLASS), false);
      assert.equal(tooltip?.style.display, "none");
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("ctrl+click still flashes the target element and opens the fallback URL", async () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();

    const target = env.document.body.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("click", {
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

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(target.classList.contains(HIGHLIGHT_CLASS), true);

      await new Promise((resolve) => setTimeout(resolve, 250));

      assert.equal(target.classList.contains(HIGHLIGHT_CLASS), false);
      assert.equal(env.openedUrls[0], "vscode://file/src/App.tsx:10:3");
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("copy action copies the mapped source location instead of opening the editor", async () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.updateConfig({
      action: "copy",
      pathMappings: [{ from: "src", to: "C:/workspace/src" }],
    });

    const target = env.document.body.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("click", {
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

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.deepEqual(env.copiedTexts, ["C:/workspace/src/App.tsx:10:3"]);
      assert.equal(env.openedUrls.length, 0);
      assert.match(
        env.document.getElementById(TOAST_ID)?.textContent ?? "",
        /Copied C:\/workspace\/src\/App\.tsx:10:3/,
      );
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("inspect action does not open or copy and shows the source toast", async () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.set("action", "inspect");

    const target = env.document.body.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("click", {
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

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(env.openedUrls.length, 0);
      assert.equal(env.copiedTexts.length, 0);
      assert.match(
        env.document.getElementById(TOAST_ID)?.textContent ?? "",
        /Source src\/App\.tsx:10:3/,
      );
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("preview styles include the animated pulse border", () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();

    const target = env.document.body.appendChild(new FakeElement("button"));
    target.setAttribute(DATA_ATTR, "src/App.tsx:10:3");
    env.document.setHoverTarget(target);

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("mousemove", {
        target,
        clientX: 10,
        clientY: 20,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
      });

      const styles = env.document.getElementById("__click-to-source-highlight-styles");
      assert.ok(styles);
      assert.match(styles?.textContent ?? "", /cts-preview-pulse/);
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("include selectors limit which instrumented elements respond", async () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.set("includeSelectors", ["button"]);

    const wrapper = env.document.body.appendChild(new FakeElement("div"));
    wrapper.setAttribute(DATA_ATTR, "src/App.tsx:5:1");

    const button = wrapper.appendChild(new FakeElement("button"));
    button.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("click", {
        target: wrapper,
        button: 0,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(env.openedUrls.length, 0);

      env.document.dispatchEvent("click", {
        target: button,
        button: 0,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(env.openedUrls[0], "vscode://file/src/App.tsx:10:3");
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("exclude selectors skip matching instrumented elements in favor of a parent source target", async () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.set("excludeSelectors", [".skip"]);

    const parent = env.document.body.appendChild(new FakeElement("main"));
    parent.setAttribute(DATA_ATTR, "src/App.tsx:20:1");

    const child = parent.appendChild(new FakeElement("button"));
    child.classList.add("skip");
    child.setAttribute(DATA_ATTR, "src/App.tsx:10:3");

    const locator = new ClickToSourceLocator();
    locator.start();

    try {
      env.document.dispatchEvent("click", {
        target: child,
        button: 0,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(env.openedUrls[0], "vscode://file/src/App.tsx:20:1");
    } finally {
      locator.destroy();
    }
  } finally {
    env.cleanup();
  }
});

test("the first-run hint is only shown once per localStorage state", () => {
  const env = setupLocatorEnvironment();

  try {
    configManager.reset();
    configManager.set("hotkey", "shift");

    const firstLocator = new ClickToSourceLocator();
    firstLocator.start();

    assert.match(
      env.document.getElementById(TOAST_ID)?.textContent ?? "",
      /Hold Shift to preview elements, then click to open source\./,
    );

    firstLocator.destroy();
    assert.equal(env.document.getElementById(TOAST_ID), null);

    const secondLocator = new ClickToSourceLocator();
    secondLocator.start();

    try {
      assert.equal(env.document.getElementById(TOAST_ID), null);
    } finally {
      secondLocator.destroy();
    }
  } finally {
    env.cleanup();
  }
});
