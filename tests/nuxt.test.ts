import test from "node:test";
import assert from "node:assert/strict";
import { clickToSourceNuxt } from "../src/nuxt.ts";

test("clickToSourceNuxt injects the Vite plugin and client plugin entry", () => {
  const viteConfig: Record<string, unknown> = {};
  const nuxt = {
    options: {
      dev: true,
      plugins: [],
    },
    hook(name: string, callback: (config: Record<string, unknown>) => void) {
      assert.equal(name, "vite:extendConfig");
      callback(viteConfig);
    },
  };

  const module = clickToSourceNuxt();
  module({}, nuxt);

  assert.ok(Array.isArray(viteConfig.plugins));
  assert.ok(viteConfig.plugins.length > 0);
  assert.ok(typeof viteConfig.vue === "object");
  assert.ok(Array.isArray(nuxt.options.plugins));
  assert.equal(nuxt.options.plugins.length, 1);
  assert.match(String(nuxt.options.plugins[0].src), /nuxt-plugin\.(mjs|ts)$/);
  assert.equal(nuxt.options.plugins[0].mode, "client");
});
