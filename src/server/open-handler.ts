import type { IncomingMessage, ServerResponse } from "http";
import * as childProcess from "child_process";
import path from "path";
import { DEFAULT_SERVER_PATH } from "../constants.ts";
import { applyPathMappings, type PathMapping } from "../path-mapping.ts";

type KnownEditor = "vscode" | "cursor" | "webstorm";

export interface OpenRequestOptions {
  path?: string;
  editor?: string;
  cwd?: string;
  allowRemote?: boolean;
  allowOutsideWorkspace?: boolean;
  pathMappings?: PathMapping[];
}

export interface OpenLocation {
  file: string;
  line: number;
  column: number;
}

function normalizePositiveInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function formatTarget(location: OpenLocation): string {
  const line = normalizePositiveInteger(location.line);
  const column = normalizePositiveInteger(location.column);
  return `${location.file}:${line}:${column}`;
}

function normalizeEditorId(value?: string | null): KnownEditor | null {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "vscode":
    case "code":
      return "vscode";
    case "cursor":
      return "cursor";
    case "webstorm":
      return "webstorm";
    default:
      return null;
  }
}

export function buildLaunchCandidates(
  location: OpenLocation,
  editor?: string
): Array<{ command: string; args: string[] }> {
  const envEditor = process.env.CTS_EDITOR || process.env.EDITOR;
  const candidate = editor?.trim() || envEditor?.trim() || "code";
  const knownEditor = normalizeEditorId(candidate);
  const target = formatTarget(location);

  if (knownEditor === "webstorm") {
    const commands =
      process.platform === "win32"
        ? ["webstorm64.exe", "webstorm.exe", "webstorm"]
        : ["webstorm"];
    return commands.map((command) => ({
      command,
      args: ["--line", String(normalizePositiveInteger(location.line)), location.file],
    }));
  }

  if (knownEditor === "vscode") {
    const commands = process.platform === "win32" ? ["code.cmd", "code"] : ["code"];
    return commands.map((command) => ({
      command,
      args: ["--goto", target],
    }));
  }

  if (knownEditor === "cursor") {
    const commands =
      process.platform === "win32" ? ["cursor.cmd", "cursor"] : ["cursor"];
    return commands.map((command) => ({
      command,
      args: ["--goto", target],
    }));
  }

  return [{ command: candidate, args: ["--goto", target] }];
}

function readHeader(req: IncomingMessage, key: string): string | undefined {
  const value = req.headers[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function isLoopbackAddress(address?: string): boolean {
  if (!address) return false;

  const normalized = address.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

function isSameHostHeader(value: string, host: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.host === host;
  } catch {
    return false;
  }
}

export function isSameOriginBrowserRequest(
  req: IncomingMessage,
  host: string
): boolean {
  const fetchSite = readHeader(req, "sec-fetch-site");
  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "same-site" &&
    fetchSite !== "none"
  ) {
    return false;
  }

  const origin = readHeader(req, "origin");
  if (origin && !isSameHostHeader(origin, host)) {
    return false;
  }

  const referer = readHeader(req, "referer");
  if (referer && !isSameHostHeader(referer, host)) {
    return false;
  }

  return true;
}

function normalizeFilePath(
  requestedFile: string,
  cwd: string,
  allowOutsideWorkspace: boolean,
  pathMappings: PathMapping[]
): string | null {
  const trimmed = requestedFile.trim();
  if (!trimmed || trimmed.includes("\0")) {
    return null;
  }

  const normalizedCwd = path.resolve(cwd);
  const translated = applyPathMappings(trimmed, pathMappings);
  const normalizedFile = path.normalize(
    path.isAbsolute(translated)
      ? translated
      : path.resolve(normalizedCwd, translated)
  );

  if (allowOutsideWorkspace) {
    return normalizedFile;
  }

  const rootForCompare =
    process.platform === "win32"
      ? normalizedCwd.toLowerCase()
      : normalizedCwd;
  const fileForCompare =
    process.platform === "win32"
      ? normalizedFile.toLowerCase()
      : normalizedFile;
  const relative = path.relative(rootForCompare, fileForCompare);
  const insideWorkspace =
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative));

  return insideWorkspace ? normalizedFile : null;
}

function shouldUseShell(command: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

export function openInEditor(
  location: OpenLocation,
  options: OpenRequestOptions = {}
): boolean {
  const launchCandidates = buildLaunchCandidates(location, options.editor);
  for (const candidate of launchCandidates) {
    const result = childProcess.spawnSync(candidate.command, candidate.args, {
      cwd: options.cwd || process.cwd(),
      stdio: "ignore",
      windowsHide: true,
      timeout: 4000,
      shell: shouldUseShell(candidate.command),
    });

    if (!result.error) {
      return true;
    }
  }

  return false;
}

function respondJson(res: ServerResponse, status: number, body: object): void {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function createOpenRequestHandler(options: OpenRequestOptions = {}) {
  const route = options.path || DEFAULT_SERVER_PATH;
  const workspaceCwd = options.cwd || process.cwd();

  return function handle(
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void
  ): void {
    if (!req.url) {
      if (next) next();
      return;
    }

    const host = readHeader(req, "host") || "localhost";
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname !== route) {
      if (next) next();
      return;
    }

    if (req.method && req.method !== "GET") {
      respondJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    const remoteAddress = req.socket?.remoteAddress;
    if (
      options.allowRemote !== true &&
      remoteAddress &&
      !isLoopbackAddress(remoteAddress)
    ) {
      respondJson(res, 403, { ok: false, error: "Remote requests are blocked" });
      return;
    }

    if (!isSameOriginBrowserRequest(req, host)) {
      respondJson(res, 403, { ok: false, error: "Cross-origin request blocked" });
      return;
    }

    const file = url.searchParams.get("file");
    const line = Number.parseInt(url.searchParams.get("line") || "1", 10);
    const column = Number.parseInt(url.searchParams.get("column") || "1", 10);
    const editorFromRequest = normalizeEditorId(url.searchParams.get("editor"));
    const editor = editorFromRequest || options.editor;

    if (!file) {
      respondJson(res, 400, { ok: false, error: "Missing file parameter" });
      return;
    }

    const normalizedFile = normalizeFilePath(
      file,
      workspaceCwd,
      options.allowOutsideWorkspace === true,
      options.pathMappings || []
    );
    if (!normalizedFile) {
      respondJson(res, 403, { ok: false, error: "Invalid or disallowed file path" });
      return;
    }

    const ok = openInEditor(
      {
        file: normalizedFile,
        line: normalizePositiveInteger(line),
        column: normalizePositiveInteger(column),
      },
      { ...options, cwd: workspaceCwd, editor }
    );

    respondJson(res, 200, { ok });
  };
}
