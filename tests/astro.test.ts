import test from "node:test";
import assert from "node:assert/strict";
import { clickToSourceAstro } from "../src/astro.ts";

test("clickToSourceAstro registers a Vite plugin and client init script", () => {
  const updates: Array<Record<string, unknown>> = [];
  const injections: Array<{ stage: string; content: string }> = [];

  const integration = clickToSourceAstro({ framework: "react" });

  integration.hooks["astro:config:setup"]({
    updateConfig(value) {
      updates.push(value);
    },
    injectScript(stage, content) {
      injections.push({ stage, content });
    },
  });

  assert.equal(updates.length, 1);
  assert.ok(Array.isArray((updates[0].vite as any).plugins));
  assert.equal(injections.length, 1);
  assert.deepEqual(injections[0], {
    stage: "page",
    content: 'import "click-to-source/init";',
  });
});
