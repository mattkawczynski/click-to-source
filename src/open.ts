import { DEFAULT_SERVER_PATH } from "./constants.ts";
import type { ClickToSourceConfig } from "./config.ts";

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

async function tryFetch(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.type === "opaque") {
      return true;
    }

    if (!res.ok) {
      return false;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return true;
    }

    try {
      const payload = (await res.json()) as { ok?: boolean };
      return payload.ok !== false;
    } catch {
      return true;
    }
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function openViaScheme(location: SourceLocation): void {
  const normalized = location.file.replace(/\\/g, "/");
  const encoded = encodeURI(normalized);
  const vscodePath = `vscode://file/${encoded}:${location.line}:${location.column}`;
  window.open(vscodePath);
}

export async function openInEditor(
  location: SourceLocation,
  config: ClickToSourceConfig
): Promise<void> {
  const serverPath = config.serverPath || DEFAULT_SERVER_PATH;
  const base = config.serverBaseUrl || "";
  const url =
    base.length > 0
      ? `${base.replace(/\/$/, "")}${serverPath}`
      : serverPath;

  const query = `?file=${encodeURIComponent(location.file)}&line=${
    location.line
  }&column=${location.column}&editor=${encodeURIComponent(config.openIn)}`;

  const requestUrl = `${url}${query}`;
  const shouldTryServer = Boolean(serverPath);

  if (shouldTryServer) {
    const ok = await tryFetch(requestUrl, 150);
    if (ok) return;
  }

  openViaScheme(location);
}
