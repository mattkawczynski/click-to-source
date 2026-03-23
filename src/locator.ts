import { configManager } from "./config";
import {
  DATA_ATTR,
  HIGHLIGHT_CLASS,
  PREVIEW_CLASS,
  TOAST_ID,
  TOOLTIP_ID,
} from "./constants";
import {
  copySourceLocation,
  formatSourceLocation,
  openInEditor,
  type SourceLocation,
} from "./open";
import { resolveFromSourceMap } from "./sourcemap-resolve";

const FIRST_RUN_HINT_KEY = "__click_to_source_hint_seen_v3";
const TOOLTIP_OFFSET = 16;
const STATUS_DURATION_MS = 2200;

/**
 * Runtime locator that previews instrumented elements and opens their source on hotkey+click
 */
export class ClickToSourceLocator {
  private isListening = false;
  private boundClickHandler: (e: MouseEvent) => void;
  private boundMouseMoveHandler: (e: MouseEvent) => void;
  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private boundKeyUpHandler: (e: KeyboardEvent) => void;
  private boundBlurHandler: () => void;
  private previewElement: Element | null = null;
  private lastPointer = {
    clientX: 0,
    clientY: 0,
    hasPosition: false,
  };
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
    this.boundBlurHandler = this.clearPreview.bind(this);
  }

  start(): void {
    if (this.isListening) return;
    this.isListening = true;
    document.addEventListener("click", this.boundClickHandler, true);
    document.addEventListener("mousemove", this.boundMouseMoveHandler, true);
    document.addEventListener("keydown", this.boundKeyDownHandler, true);
    document.addEventListener("keyup", this.boundKeyUpHandler, true);
    window.addEventListener("blur", this.boundBlurHandler);
    this.showFirstRunHint();
  }

  private async handleClick(e: MouseEvent): Promise<void> {
    const config = configManager.getConfig();

    // Check if feature is enabled
    if (!config.enabled) return;

    // Check if the correct hotkey is pressed
    if (!this.isHotkey(e, config.hotkey)) return;

    // Find element with data-click-to-source attribute or React fiber source
    const element = this.findSourceElement(e.target);
    if (!element) return;

    // Prevent default behavior (do this before async work)
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Highlight element briefly
    this.highlightElement(element);

    const location = await this.resolveSourceLocation(element);
    if (!location) return;

    const action = config.action;

    switch (action) {
      case "copy": {
        const copied = await copySourceLocation(location, config);
        this.showToast(
          copied
            ? `Copied ${formatSourceLocation(location, config)}`
            : "Copy failed. Check clipboard permissions.",
        );
        return;
      }
      case "inspect":
        this.showToast(`Source ${formatSourceLocation(location, config)}`);
        return;
      case "open":
      default:
        await openInEditor(location, config);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    this.lastPointer = {
      clientX: e.clientX,
      clientY: e.clientY,
      hasPosition: true,
    };

    const config = configManager.getConfig();
    if (!config.enabled || !this.isHotkeyPressed(e, config.hotkey)) {
      this.clearPreview();
      return;
    }

    this.setPreviewElement(this.findSourceElement(e.target));
    this.updateTooltipPosition();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const config = configManager.getConfig();
    if (!config.enabled || !this.matchesHotkeyKey(e, config.hotkey)) {
      return;
    }

    this.updatePreviewFromPointer();
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const config = configManager.getConfig();
    if (!this.matchesHotkeyKey(e, config.hotkey)) {
      return;
    }

    this.clearPreview();
  }

  /**
   * Check if the clicked hotkey matches the configured one
   */
  private isHotkey(e: MouseEvent, hotkey: string): boolean {
    return this.isHotkeyPressed(e, hotkey) && e.button === 0;
  }

  private isHotkeyPressed(
    e: Pick<MouseEvent | KeyboardEvent, "ctrlKey" | "altKey" | "metaKey" | "shiftKey">,
    hotkey: string,
  ): boolean {
    switch (hotkey) {
      case "ctrl":
        return e.ctrlKey;
      case "alt":
        return e.altKey;
      case "meta":
        return e.metaKey;
      case "shift":
        return e.shiftKey;
      default:
        return e.ctrlKey;
    }
  }

  private matchesHotkeyKey(e: KeyboardEvent, hotkey: string): boolean {
    switch (hotkey) {
      case "ctrl":
        return e.key === "Control";
      case "alt":
        return e.key === "Alt";
      case "meta":
        return e.key === "Meta";
      case "shift":
        return e.key === "Shift";
      default:
        return e.key === "Control";
    }
  }

  /**
   * Get source location from either the data attribute or React fiber debug info.
   * For fiber-based sources, resolves through source maps to get the original file path.
   */
  private async resolveSourceLocation(element: Element): Promise<SourceLocation | null> {
    const raw = element.getAttribute(DATA_ATTR);
    if (raw) {
      return this.parseSource(raw);
    }
    return this.getFiberSource(element);
  }

  /**
   * Parse a "file:line:column" source string.
   */
  private parseSource(raw: string): SourceLocation | null {
    const lastColon = raw.lastIndexOf(":");
    const secondLastColon = raw.lastIndexOf(":", lastColon - 1);
    if (lastColon === -1 || secondLastColon === -1) return null;

    const file = raw.slice(0, secondLastColon);
    const line = Number(raw.slice(secondLastColon + 1, lastColon));
    const column = Number(raw.slice(lastColon + 1));

    if (!file) return null;
    return {
      file,
      line: Number.isFinite(line) && line > 0 ? line : 1,
      column: Number.isFinite(column) && column > 0 ? column : 1,
    };
  }

  /**
   * Highlight element briefly to show visual feedback
   */
  private highlightElement(element: Element): void {
    this.ensureHighlightStyles();

    element.classList.add(HIGHLIGHT_CLASS);

    setTimeout(() => {
      element.classList.remove(HIGHLIGHT_CLASS);
    }, 200);
  }

  private updatePreviewFromPointer(): void {
    if (!this.lastPointer.hasPosition || typeof document.elementFromPoint !== "function") {
      return;
    }

    const target = document.elementFromPoint(
      this.lastPointer.clientX,
      this.lastPointer.clientY,
    );
    this.setPreviewElement(this.findSourceElement(target));
    this.updateTooltipPosition();
  }

  private findSourceElement(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    if (
      target.closest("#__click-to-source-container") ||
      target.closest(`#${TOOLTIP_ID}`) ||
      target.closest(`#${TOAST_ID}`)
    ) {
      return null;
    }

    const config = configManager.getConfig();
    let current: Element | null = target;

    // Try build-time data attributes first
    while (current) {
      const candidate: Element | null = current.closest(`[${DATA_ATTR}]`);
      if (!candidate) {
        break;
      }

      if (this.isIgnoredElement(candidate, config)) {
        current = candidate.parentElement;
        continue;
      }

      return candidate;
    }

    // Fallback: walk up from target looking for React fiber _debugSource
    current = target;
    while (current) {
      if (
        current.id === "__click-to-source-container" ||
        current.id === TOOLTIP_ID ||
        current.id === TOAST_ID
      ) {
        break;
      }

      if (!this.isIgnoredElement(current, config) && this.hasFiberDebugInfo(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  /**
   * Synchronous check: does this element have any React fiber debug info?
   * Used for hover detection (no source map resolution needed).
   */
  private hasFiberDebugInfo(element: Element): boolean {
    const fiberKey = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return false;
    let fiber = (element as Record<string, any>)[fiberKey];
    while (fiber) {
      if (fiber._debugSource || fiber._debugStack) return true;
      fiber = fiber.return;
    }
    return false;
  }

  /**
   * Get source location from React fiber debug info (available in dev mode).
   * Supports both React 18 (_debugSource) and React 19+ (_debugStack).
   * For React 19, resolves bundled URLs through source maps to original file paths.
   */
  private async getFiberSource(element: Element): Promise<SourceLocation | null> {
    const fiberKey = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return null;

    let fiber = (element as Record<string, any>)[fiberKey];
    while (fiber) {
      // React 18: structured _debugSource
      const source = fiber._debugSource;
      if (source?.fileName) {
        return {
          file: source.fileName.replace(/\\/g, "/"),
          line: source.lineNumber || 1,
          column: (source.columnNumber ?? 0) + 1,
        };
      }

      // React 19+: _debugStack is an Error with a stack trace
      const debugStack = fiber._debugStack;
      if (debugStack?.stack) {
        const loc = await this.resolveDebugStack(debugStack.stack);
        if (loc) return loc;
      }

      fiber = fiber.return;
    }
    return null;
  }

  /**
   * Parse a React 19 _debugStack Error.stack and resolve through source maps
   * to get the original file path, line, and column.
   */
  private async resolveDebugStack(stack: string): Promise<SourceLocation | null> {
    const lines = stack.split("\n");
    for (const line of lines) {
      if (line.includes("node_modules") || line.includes("react-stack-top-frame")) {
        continue;
      }

      // Match "at Component (url:line:col)" or "at url:line:col"
      const match =
        line.match(/\((.+):(\d+):(\d+)\)/) ||
        line.match(/at\s+(.+):(\d+):(\d+)/);
      if (match) {
        const rawFile = match[1];
        if (rawFile.includes("node_modules")) continue;

        const genLine = Number(match[2]) || 1;
        const genCol = Number(match[3]) || 1;

        // If it's a URL (bundled chunk), resolve through source map
        if (rawFile.startsWith("http://") || rawFile.startsWith("https://")) {
          const resolved = await resolveFromSourceMap(rawFile, genLine, genCol);
          if (resolved) {
            return resolved;
          }
          continue;
        }

        // Already a file path
        return {
          file: rawFile.replace(/\\/g, "/"),
          line: genLine,
          column: genCol,
        };
      }
    }
    return null;
  }

  private isIgnoredElement(
    element: Element,
    config: ReturnType<typeof configManager.getConfig>,
  ): boolean {
    if (this.matchesAnySelector(element, config.excludeSelectors)) {
      return true;
    }

    if (
      config.includeSelectors.length > 0 &&
      !this.matchesAnySelector(element, config.includeSelectors)
    ) {
      return true;
    }

    return false;
  }

  private matchesAnySelector(element: Element, selectors: string[]): boolean {
    return selectors.some((selector) => {
      const normalized = selector.trim();
      return normalized.length > 0 && typeof element.matches === "function"
        ? element.matches(normalized)
        : false;
    });
  }

  private setPreviewElement(element: Element | null): void {
    this.ensureHighlightStyles();

    if (this.previewElement === element) {
      return;
    }

    this.previewElement?.classList.remove(PREVIEW_CLASS);
    this.previewElement = element;
    this.previewElement?.classList.add(PREVIEW_CLASS);
    this.updateTooltipContent();
  }

  private clearPreview(): void {
    this.previewElement?.classList.remove(PREVIEW_CLASS);
    this.previewElement = null;
    this.hideTooltip();
  }

  private ensureHighlightStyles(): void {
    if (document.getElementById("__click-to-source-highlight-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "__click-to-source-highlight-styles";
    style.textContent = `
      @keyframes cts-preview-pulse {
        0% {
          outline-color: rgba(88, 166, 255, 0.7);
          box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.08);
        }
        50% {
          outline-color: rgba(88, 166, 255, 1);
          box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.14);
        }
        100% {
          outline-color: rgba(88, 166, 255, 0.7);
          box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.08);
        }
      }

      .${PREVIEW_CLASS} {
        outline: 2px dashed rgba(88, 166, 255, 0.95);
        outline-offset: 2px;
        background-color: rgba(88, 166, 255, 0.08);
        animation: cts-preview-pulse 1.1s ease-in-out infinite;
      }

      .${HIGHLIGHT_CLASS} {
        outline: 2px solid rgb(88, 166, 255);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.18);
      }

      #${TOOLTIP_ID} {
        position: fixed;
        max-width: min(420px, calc(100vw - 24px));
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(12, 18, 28, 0.95);
        color: #f5f7fb;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
        pointer-events: none;
        z-index: 1000000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${TOAST_ID} {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        max-width: min(520px, calc(100vw - 24px));
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(12, 18, 28, 0.95);
        color: #f5f7fb;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
        z-index: 1000000;
      }
    `;
    document.head.appendChild(style);
  }

  private async updateTooltipContent(): Promise<void> {
    const element = this.previewElement;
    if (!element) {
      this.hideTooltip();
      return;
    }

    // Show immediate feedback for data-attr path, async resolve for fiber
    const raw = element.getAttribute(DATA_ATTR);
    if (raw) {
      const location = this.parseSource(raw);
      if (!location) { this.hideTooltip(); return; }
      const config = configManager.getConfig();
      const tooltip = this.getOrCreateOverlay(TOOLTIP_ID);
      tooltip.textContent = `${this.getActionLabel(location, config)} ${formatSourceLocation(location, config)}`;
      this.updateTooltipPosition();
      return;
    }

    // Fiber path: show loading, then resolve
    const tooltip = this.getOrCreateOverlay(TOOLTIP_ID);
    tooltip.textContent = "Resolving source…";
    this.updateTooltipPosition();

    const location = await this.resolveSourceLocation(element);
    if (!location || this.previewElement !== element) {
      if (this.previewElement !== element) return;
      this.hideTooltip();
      return;
    }

    const config = configManager.getConfig();
    tooltip.textContent = `${this.getActionLabel(location, config)} ${formatSourceLocation(location, config)}`;
  }

  private updateTooltipPosition(): void {
    const tooltip = this.getOverlay(TOOLTIP_ID);
    if (!tooltip || !this.lastPointer.hasPosition) {
      return;
    }

    const viewportWidth =
      typeof window.innerWidth === "number"
        ? window.innerWidth
        : this.lastPointer.clientX + TOOLTIP_OFFSET;
    const viewportHeight =
      typeof window.innerHeight === "number"
        ? window.innerHeight
        : this.lastPointer.clientY + TOOLTIP_OFFSET;

    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(
      viewportWidth - TOOLTIP_OFFSET,
      this.lastPointer.clientX + TOOLTIP_OFFSET,
    )}px`;
    tooltip.style.top = `${Math.min(
      viewportHeight - TOOLTIP_OFFSET,
      this.lastPointer.clientY + TOOLTIP_OFFSET,
    )}px`;
  }

  private hideTooltip(): void {
    const tooltip = this.getOverlay(TOOLTIP_ID);
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }

  private showFirstRunHint(): void {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return;
    }

    try {
      if (window.localStorage.getItem(FIRST_RUN_HINT_KEY)) {
        return;
      }

      const config = configManager.getConfig();
      const action = this.describeAction(config.action);
      this.showToast(
        `Hold ${this.formatHotkey(config.hotkey)} to preview elements, then click to ${action}.`,
        5000,
      );
      window.localStorage.setItem(FIRST_RUN_HINT_KEY, "1");
    } catch {
      // Ignore storage failures and continue without a persisted hint flag.
    }
  }

  private formatHotkey(hotkey: string): string {
    switch (hotkey) {
      case "ctrl":
        return "Ctrl";
      case "alt":
        return "Alt";
      case "meta":
        return "Meta";
      case "shift":
        return "Shift";
      default:
        return "Ctrl";
    }
  }

  private describeAction(
    action: ReturnType<typeof configManager.getConfig>["action"],
  ): string {
    switch (action) {
      case "copy":
        return "copy source";
      case "inspect":
        return "inspect source";
      case "open":
      default:
        return "open source";
    }
  }

  private getActionLabel(
    _location: SourceLocation,
    config: ReturnType<typeof configManager.getConfig>,
  ): string {
    switch (config.action) {
      case "copy":
        return "Copy";
      case "inspect":
        return "Inspect";
      case "open":
      default:
        return "Open";
    }
  }

  private showToast(message: string, durationMs = STATUS_DURATION_MS): void {
    const toast = this.getOrCreateOverlay(TOAST_ID);
    toast.textContent = message;
    toast.style.display = "block";

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      toast.style.display = "none";
      this.toastTimeout = null;
    }, durationMs);
  }

  private getOverlay(id: string): HTMLElement | null {
    return typeof document.getElementById === "function"
      ? (document.getElementById(id) as HTMLElement | null)
      : null;
  }

  private getOrCreateOverlay(id: string): HTMLElement {
    const existing = this.getOverlay(id);
    if (existing) {
      return existing;
    }

    const overlay = document.createElement("div");
    overlay.id = id;
    overlay.style.display = "none";
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  /**
   * Clean up listener
   */
  destroy(): void {
    if (!this.isListening) return;
    this.isListening = false;
    document.removeEventListener("click", this.boundClickHandler, true);
    document.removeEventListener("mousemove", this.boundMouseMoveHandler, true);
    document.removeEventListener("keydown", this.boundKeyDownHandler, true);
    document.removeEventListener("keyup", this.boundKeyUpHandler, true);
    window.removeEventListener("blur", this.boundBlurHandler);
    this.clearPreview();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.getOverlay(TOOLTIP_ID)?.remove();
    this.getOverlay(TOAST_ID)?.remove();
  }
}
