import { configManager } from "./config";
import { DATA_ATTR, HIGHLIGHT_CLASS, PREVIEW_CLASS } from "./constants";
import { openInEditor, type SourceLocation } from "./open";

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
  }

  private handleClick(e: MouseEvent): void {
    const config = configManager.getConfig();

    // Check if feature is enabled
    if (!config.enabled) return;

    // Check if the correct hotkey is pressed
    if (!this.isHotkey(e, config.hotkey)) return;

    // Find element with data-click-to-source attribute
    const element = this.findSourceElement(e.target);
    if (!element) return;

    const raw = element.getAttribute(DATA_ATTR);
    if (!raw) return;

    // Prevent default behavior
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Highlight element briefly
    this.highlightElement(element);

    const location = this.parseSource(raw);
    if (!location) return;

    // Open in editor
    openInEditor(location, config);
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
   * Open file in VSCode
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
  }

  private findSourceElement(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    if (target.closest("#__click-to-source-container")) return null;
    return target.closest(`[${DATA_ATTR}]`);
  }

  private setPreviewElement(element: Element | null): void {
    this.ensureHighlightStyles();

    if (this.previewElement === element) {
      return;
    }

    this.previewElement?.classList.remove(PREVIEW_CLASS);
    this.previewElement = element;
    this.previewElement?.classList.add(PREVIEW_CLASS);
  }

  private clearPreview(): void {
    this.previewElement?.classList.remove(PREVIEW_CLASS);
    this.previewElement = null;
  }

  private ensureHighlightStyles(): void {
    if (document.getElementById("__click-to-source-highlight-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "__click-to-source-highlight-styles";
    style.textContent = `
      .${PREVIEW_CLASS} {
        outline: 2px dashed rgba(88, 166, 255, 0.95);
        outline-offset: 2px;
        background-color: rgba(88, 166, 255, 0.08);
      }

      .${HIGHLIGHT_CLASS} {
        outline: 2px solid rgb(88, 166, 255);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.18);
      }
    `;
    document.head.appendChild(style);
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
  }
}
