import { configManager } from "./config";
import { DATA_ATTR, HIGHLIGHT_CLASS } from "./constants";
import { openInEditor, type SourceLocation } from "./open";

/**
 * Click handler that opens VSCode when user Ctrl+Clicks an element
 */
export class ClickToSourceLocator {
  private isListening = false;
  private boundHandler: (e: MouseEvent) => void;

  constructor() {
    this.boundHandler = this.handleClick.bind(this);
  }

  start(): void {
    if (this.isListening) return;
    this.isListening = true;
    document.addEventListener("click", this.boundHandler, true);
  }

  private handleClick(e: MouseEvent): void {
    const config = configManager.getConfig();

    // Check if feature is enabled
    if (!config.enabled) return;

    // Check if the correct hotkey is pressed
    if (!this.isHotkey(e, config.hotkey)) return;

    // Find element with data-click-to-source attribute
    const target = e.target as Element | null;
    if (!target || !(target instanceof Element)) return;

    const container = target.closest("#__click-to-source-container");
    if (container) return;

    const element = target.closest(`[${DATA_ATTR}]`);
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

  /**
   * Check if the clicked hotkey matches the configured one
   */
  private isHotkey(e: MouseEvent, hotkey: string): boolean {
    switch (hotkey) {
      case "ctrl":
        return e.ctrlKey && e.button === 0;
      case "alt":
        return e.altKey && e.button === 0;
      case "meta":
        return e.metaKey && e.button === 0;
      case "shift":
        return e.shiftKey && e.button === 0;
      default:
        return e.ctrlKey && e.button === 0; // Default to Ctrl
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
    if (!document.getElementById("__click-to-source-highlight-styles")) {
      const style = document.createElement("style");
      style.id = "__click-to-source-highlight-styles";
      style.textContent = `
        .${HIGHLIGHT_CLASS} {
          outline: 2px solid rgb(88, 166, 255);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(style);
    }

    element.classList.add(HIGHLIGHT_CLASS);

    setTimeout(() => {
      element.classList.remove(HIGHLIGHT_CLASS);
    }, 200);
  }

  /**
   * Clean up listener
   */
  destroy(): void {
    if (!this.isListening) return;
    this.isListening = false;
    document.removeEventListener("click", this.boundHandler, true);
  }
}
