import test from "node:test";
import assert from "node:assert/strict";
import {
  copySourceLocation,
  formatSourceLocation,
  openInEditor,
} from "../src/open.ts";
import type { ClickToSourceConfig } from "../src/config.ts";

const location = {
  file: "src/App.tsx",
  line: 10,
  column: 3,
};

const config: ClickToSourceConfig = {
  enabled: true,
  hotkey: "ctrl",
  position: "br",
  theme: "auto",
  showButton: true,
  serverPath: "/__click_to_source/open",
  openIn: "vscode",
  pathMappings: [],
  action: "open",
  includeSelectors: [],
  excludeSelectors: [],
};

test("formatSourceLocation applies path mappings", () => {
  assert.equal(
    formatSourceLocation(
      {
        file: "/workspaces/app/src/App.tsx",
        line: 12,
        column: 4,
      },
      {
        pathMappings: [{ from: "/workspaces/app", to: "C:/Users/mateu/projects/app" }],
      },
    ),
    "C:/Users/mateu/projects/app/src/App.tsx:12:4",
  );
});

test("copySourceLocation copies the mapped source path", async () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const copied: string[] = [];

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text: string) {
          copied.push(text);
        },
      },
    },
  });

  try {
    const ok = await copySourceLocation(
      {
        file: "/workspaces/app/src/App.tsx",
        line: 18,
        column: 2,
      },
      {
        pathMappings: [{ from: "/workspaces/app", to: "C:/workspace/app" }],
      },
    );

    assert.equal(ok, true);
    assert.deepEqual(copied, ["C:/workspace/app/src/App.tsx:18:2"]);
  } finally {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
    } else {
      delete (globalThis as any).navigator;
    }
  }
});

test("openInEditor falls back to vscode:// when server reports ok=false", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const opened: string[] = [];

  (globalThis as any).window = {
    open: (url: string) => {
      opened.push(url);
    },
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await openInEditor(location, config);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }

  assert.equal(opened.length, 1);
  assert.equal(opened[0], "vscode://file/src/App.tsx:10:3");
});

test("openInEditor does not fall back when server reports ok=true", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  let opened = false;

  (globalThis as any).window = {
    open: () => {
      opened = true;
    },
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await openInEditor(location, config);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }

  assert.equal(opened, false);
});

test("openInEditor applies path mappings for browser fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const opened: string[] = [];

  (globalThis as any).window = {
    open: (url: string) => {
      opened.push(url);
    },
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await openInEditor(
      {
        file: "/workspaces/app/src/App.tsx",
        line: 12,
        column: 4,
      },
      {
        ...config,
        pathMappings: [
          {
            from: "/workspaces/app",
            to: "C:/Users/mateu/projects/app",
          },
        ],
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }

  assert.equal(opened.length, 1);
  assert.equal(
    opened[0],
    "vscode://file/C:/Users/mateu/projects/app/src/App.tsx:12:4",
  );
});
