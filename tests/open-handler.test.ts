import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildLaunchCandidates,
  createOpenRequestHandler,
  isLoopbackAddress,
  isSameOriginBrowserRequest,
  openInEditor,
} from "../src/server/open-handler.ts";

interface MockRequestParams {
  url: string;
  method?: string;
  host?: string;
  remoteAddress?: string;
  origin?: string;
  referer?: string;
  secFetchSite?: string;
}

function createMockRequest(params: MockRequestParams): IncomingMessage {
  const headers: Record<string, string> = {};
  headers.host = params.host || "localhost:5173";
  if (params.origin) headers.origin = params.origin;
  if (params.referer) headers.referer = params.referer;
  if (params.secFetchSite) headers["sec-fetch-site"] = params.secFetchSite;

  return {
    url: params.url,
    method: params.method || "GET",
    headers,
    socket: {
      remoteAddress: params.remoteAddress || "127.0.0.1",
    },
  } as IncomingMessage;
}

function createMockResponse(): {
  response: ServerResponse;
  statusCode: () => number;
  body: () => string;
  headers: () => Map<string, string>;
} {
  let status = 200;
  let text = "";
  const headers = new Map<string, string>();

  const response = {
    get statusCode() {
      return status;
    },
    set statusCode(value: number) {
      status = value;
    },
    setHeader(key: string, value: string) {
      headers.set(key.toLowerCase(), String(value));
      return this;
    },
    end(value?: string) {
      text = value ? String(value) : "";
      return this;
    },
  } as unknown as ServerResponse;

  return {
    response,
    statusCode: () => status,
    body: () => text,
    headers: () => headers,
  };
}

test("isLoopbackAddress only allows local addresses", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("::1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("192.168.1.5"), false);
});

test("isSameOriginBrowserRequest blocks cross-site origins", () => {
  const sameOriginReq = createMockRequest({
    url: "/__click_to_source/open?file=src/main.tsx",
    origin: "http://localhost:5173",
    secFetchSite: "same-origin",
  });
  const crossOriginReq = createMockRequest({
    url: "/__click_to_source/open?file=src/main.tsx",
    origin: "https://evil.example",
    secFetchSite: "cross-site",
  });

  assert.equal(isSameOriginBrowserRequest(sameOriginReq, "localhost:5173"), true);
  assert.equal(
    isSameOriginBrowserRequest(crossOriginReq, "localhost:5173"),
    false
  );
});

test("handler calls next() when route does not match", () => {
  const handler = createOpenRequestHandler({ editor: "__missing_editor__" });
  const req = createMockRequest({ url: "/other" });
  const { response, statusCode } = createMockResponse();
  let nextCalled = false;

  handler(req, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(statusCode(), 200);
});

test("handler rejects non-GET methods", () => {
  const handler = createOpenRequestHandler({ editor: "__missing_editor__" });
  const req = createMockRequest({
    url: "/__click_to_source/open?file=src/main.tsx",
    method: "POST",
  });
  const { response, statusCode, body } = createMockResponse();

  handler(req, response);

  assert.equal(statusCode(), 405);
  assert.match(body(), /Method not allowed/);
});

test("handler rejects remote requests by default", () => {
  const handler = createOpenRequestHandler({ editor: "__missing_editor__" });
  const req = createMockRequest({
    url: "/__click_to_source/open?file=src/main.tsx",
    remoteAddress: "10.0.0.15",
  });
  const { response, statusCode, body } = createMockResponse();

  handler(req, response);

  assert.equal(statusCode(), 403);
  assert.match(body(), /Remote requests are blocked/);
});

test("handler rejects paths outside workspace by default", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-handler-"));
  const workspace = path.join(baseDir, "workspace");
  const outside = path.join(baseDir, "outside", "App.tsx");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.dirname(outside), { recursive: true });

  const handler = createOpenRequestHandler({
    cwd: workspace,
    editor: "__missing_editor__",
  });
  const req = createMockRequest({
    url: `/__click_to_source/open?file=${encodeURIComponent(outside)}`,
  });
  const { response, statusCode, body } = createMockResponse();

  handler(req, response);

  assert.equal(statusCode(), 403);
  assert.match(body(), /Invalid or disallowed file path/);
});

test("handler allows outside paths when explicitly enabled", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-handler-"));
  const workspace = path.join(baseDir, "workspace");
  const outside = path.join(baseDir, "outside", "App.tsx");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.dirname(outside), { recursive: true });

  const handler = createOpenRequestHandler({
    cwd: workspace,
    editor: "__missing_editor__",
    allowOutsideWorkspace: true,
  });
  const req = createMockRequest({
    url: `/__click_to_source/open?file=${encodeURIComponent(outside)}&line=10&column=3`,
  });
  const { response, statusCode, body, headers } = createMockResponse();

  handler(req, response);

  assert.equal(statusCode(), 200);
  assert.equal(headers().get("content-type"), "application/json");
  const payload = JSON.parse(body()) as { ok: boolean };
  assert.equal(payload.ok, false);
});

test("openInEditor uses the Windows shell for .cmd launchers", {
  skip: process.platform !== "win32",
}, () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-open-"));
  const commandPath = path.join(tempDir, "fake-editor.cmd");
  fs.writeFileSync(commandPath, "@echo off\r\nexit /b 0\r\n");

  const ok = openInEditor(
    {
      file: path.join(tempDir, "App.tsx"),
      line: 10,
      column: 3,
    },
    {
      cwd: tempDir,
      editor: commandPath,
    }
  );

  assert.equal(ok, true);
});

function createCaptureCommand(tempDir: string, name: string, captureFile: string): string {
  const fullPath = path.join(tempDir, process.platform === "win32" ? `${name}.cmd` : name);
  if (process.platform === "win32") {
    fs.writeFileSync(
      fullPath,
      `@echo off\r\n>%~dp0\\${path.basename(captureFile)} echo %*\r\nexit /b 0\r\n`
    );
  } else {
    fs.writeFileSync(
      fullPath,
      `#!/bin/sh\nprintf '%s\\n' \"$@\" > \"${captureFile.replace(/"/g, '\\"')}\"\n`
    );
    fs.chmodSync(fullPath, 0o755);
  }
  return fullPath;
}

test("buildLaunchCandidates uses the correct args for known editors", () => {
  const location = {
    file: "src/App.tsx",
    line: 12,
    column: 5,
  };

  assert.deepEqual(buildLaunchCandidates(location, "vscode")[0], {
    command: process.platform === "win32" ? "code.cmd" : "code",
    args: ["--goto", "src/App.tsx:12:5"],
  });
  assert.deepEqual(buildLaunchCandidates(location, "cursor")[0], {
    command: process.platform === "win32" ? "cursor.cmd" : "cursor",
    args: ["--goto", "src/App.tsx:12:5"],
  });
  assert.deepEqual(buildLaunchCandidates(location, "webstorm")[0], {
    command: process.platform === "win32" ? "webstorm64.exe" : "webstorm",
    args: ["--line", "12", "src/App.tsx"],
  });
});

test("openInEditor resolves vscode, cursor, and webstorm launchers from PATH", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-editor-path-"));
  const originalPath = process.env.PATH || "";

  try {
    const cases = [
      { editor: "vscode", command: "code", expected: "--goto src/App.tsx:12:5" },
      { editor: "cursor", command: "cursor", expected: "--goto src/App.tsx:12:5" },
    ] as const;

    for (const testCase of cases) {
      const captureFile = path.join(tempDir, `${testCase.editor}.txt`);
      createCaptureCommand(tempDir, testCase.command, captureFile);
      process.env.PATH = `${tempDir}${path.delimiter}${originalPath}`;

      const ok = openInEditor(
        {
          file: "src/App.tsx",
          line: 12,
          column: 5,
        },
        {
          cwd: tempDir,
          editor: testCase.editor,
        }
      );

      assert.equal(ok, true, `${testCase.editor} launcher should be found on PATH`);
      const capture = fs.readFileSync(captureFile, "utf8").trim();
      assert.match(capture, new RegExp(testCase.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  } finally {
    process.env.PATH = originalPath;
  }
});

test("handler applies path mappings before opening files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-handler-map-"));
  const workspace = path.join(tempDir, "workspace");
  const mappedRoot = path.join(tempDir, "mapped-root");
  const captureFile = path.join(tempDir, "captured.txt");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(mappedRoot, { recursive: true });
  const editorPath = createCaptureCommand(tempDir, "capture-editor", captureFile);

  const handler = createOpenRequestHandler({
    cwd: workspace,
    editor: editorPath,
    allowOutsideWorkspace: true,
    pathMappings: [
      {
        from: "/workspace",
        to: mappedRoot.replace(/\\/g, "/"),
      },
    ],
  });
  const req = createMockRequest({
    url: `/__click_to_source/open?file=${encodeURIComponent("/workspace/src/App.tsx")}&line=10&column=3`,
  });
  const { response, statusCode, body } = createMockResponse();

  handler(req, response);

  assert.equal(statusCode(), 200);
  const payload = JSON.parse(body()) as { ok: boolean };
  assert.equal(payload.ok, true);
  const capture = fs.readFileSync(captureFile, "utf8").trim();
  assert.ok(capture.includes(mappedRoot));
});
