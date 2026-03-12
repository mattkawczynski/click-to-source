import { DEFAULT_SERVER_PATH } from "./constants.ts";
import type { ClickToSourceConfig } from "./config.ts";
import { applyPathMappings } from "./path-mapping.ts";

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
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function copyWithClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  if (
    typeof document === "undefined" ||
    !document.body ||
    typeof document.createElement !== "function"
  ) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    if (typeof document.execCommand === "function") {
      return document.execCommand("copy");
    }
    return false;
  } finally {
    textarea.remove();
  }
}

function openViaScheme(location: SourceLocation): void {
  const normalized = location.file.replace(/\\/g, "/");
  const encoded = encodeURI(normalized);
  window.open(`vscode://file/${encoded}:${location.line}:${location.column}`);
}

export function resolveLocation(
  location: SourceLocation,
  config: Pick<ClickToSourceConfig, "pathMappings">
): SourceLocation {
  return {
    ...location,
    file: applyPathMappings(location.file, config.pathMappings),
  };
}

export function formatSourceLocation(
  location: SourceLocation,
  config?: Pick<ClickToSourceConfig, "pathMappings">
): string {
  const resolved = config ? resolveLocation(location, config) : location;
  return `${resolved.file}:${resolved.line}:${resolved.column}`;
}

export async function copySourceLocation(
  location: SourceLocation,
  config: Pick<ClickToSourceConfig, "pathMappings">
): Promise<boolean> {
  return copyWithClipboard(formatSourceLocation(location, config));
}

export async function openInEditor(
  location: SourceLocation,
  config: ClickToSourceConfig
): Promise<void> {
  const mappedLocation = resolveLocation(location, config);
  const serverPath = config.serverPath || DEFAULT_SERVER_PATH;
  const base = config.serverBaseUrl || "";
  const url =
    base.length > 0 ? `${base.replace(/\/$/, "")}${serverPath}` : serverPath;

  const query = `?file=${encodeURIComponent(location.file)}&line=${
    location.line
  }&column=${location.column}&editor=${encodeURIComponent(config.openIn)}`;

  if (serverPath) {
    const ok = await tryFetch(`${url}${query}`, 150);
    if (ok) {
      return;
    }
  }

  openViaScheme(mappedLocation);
}
