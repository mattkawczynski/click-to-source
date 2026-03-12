import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withClickToSourceNext } from "../src/next.ts";

test("withClickToSourceNext adds the dev loader rule for app and pages roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-next-"));
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.mkdirSync(path.join(root, "pages"), { recursive: true });

  const wrapped = withClickToSourceNext({});
  const config = wrapped.webpack({ module: { rules: [] } }, { dev: true, dir: root });
  const rules = config.module.rules as Array<Record<string, any>>;

  assert.equal(rules.length, 1);
  assert.match(String(rules[0].test), /\.\[jt\]sx/);
  assert.equal(rules[0].enforce, "pre");
  assert.equal(rules[0].include.length, 2);
  assert.match(String(rules[0].use[0].loader), /next-loader/);
});

test("withClickToSourceNext stays idempotent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cts-next-idempotent-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  const wrapped = withClickToSourceNext({});
  const config = {
    module: {
      rules: [
        {
          use: [{ loader: "/tmp/click-to-source/dist/next-loader.cjs" }],
        },
      ],
    },
  };

  const resolved = wrapped.webpack(config, { dev: true, dir: root });
  assert.equal(resolved.module.rules.length, 1);
});

test("withClickToSourceNext does not add loader rules outside dev mode", () => {
  const wrapped = withClickToSourceNext({});
  const resolved = wrapped.webpack({ module: { rules: [] } }, { dev: false, dir: process.cwd() });

  assert.equal(resolved.module.rules.length, 0);
});
