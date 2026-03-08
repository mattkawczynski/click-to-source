import test from "node:test";
import assert from "node:assert/strict";
import { openInEditor } from "../src/open.ts";
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
};

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
