import { configManager } from "./config";
import { HIGHLIGHT_CLASS } from "./constants";

/**
 * Floating UI button and settings panel
 */
export class ClickToSourceUI {
  private container: HTMLElement | null = null;
  private button: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.render();
  }

  private render(): void {
    const config = configManager.getConfig();
    if (!config.showButton) return;

    // Create container
    this.container = document.createElement("div");
    this.container.id = "__click-to-source-container";
    this.container.innerHTML = this.getContainerHTML();
    document.body.appendChild(this.container);

    // Get elements
    this.button = this.container.querySelector(
      "[data-role='button']"
    ) as HTMLElement;
    this.panel = this.container.querySelector(
      "[data-role='panel']"
    ) as HTMLElement;

    if (!this.button || !this.panel) {
      console.error("[click-to-source] Failed to render UI elements");
      return;
    }

    // Add styles
    this.injectStyles();

    // Setup event listeners
    this.setupEventListeners();

    // Update position and theme
    this.updatePosition();
    this.updateTheme();

    this.unsubscribe = configManager.subscribe(() => {
      this.updateTheme();
      this.updatePosition();
    });
  }

  private getContainerHTML(): string {
    const config = configManager.getConfig();

    return `
      <button class="cts-button" data-role="button" type="button" title="click-to-source settings">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M9 5c-1.654 0-3 1.346-3 3 0 1.654 1.346 3 3 3s3-1.346 3-3c0-1.654-1.346-3-3-3zm0 2c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1z"/>
          <path d="M4 2c-.55 0-1 .45-1 1v18c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1H4zm0 2h16v14H4V4z"/>
        </svg>
      </button>

      <div class="cts-panel" data-role="panel" style="display: none;">
        <div class="cts-panel-header">
          <h3>click-to-source</h3>
          <button class="cts-close" data-role="close" type="button" aria-label="Close settings">x</button>
        </div>

        <div class="cts-panel-content">
          <div class="cts-setting">
            <label for="cts-hotkey">Hotkey:</label>
            <select id="cts-hotkey" data-role="hotkey">
              <option value="ctrl" ${config.hotkey === "ctrl" ? "selected" : ""}>Ctrl</option>
              <option value="alt" ${config.hotkey === "alt" ? "selected" : ""}>Alt</option>
              <option value="meta" ${config.hotkey === "meta" ? "selected" : ""}>Meta</option>
              <option value="shift" ${config.hotkey === "shift" ? "selected" : ""}>Shift</option>
            </select>
          </div>

          <div class="cts-setting">
            <label for="cts-position">Position:</label>
            <select id="cts-position" data-role="position">
              <option value="tl" ${config.position === "tl" ? "selected" : ""}>Top Left</option>
              <option value="tr" ${config.position === "tr" ? "selected" : ""}>Top Right</option>
              <option value="bl" ${config.position === "bl" ? "selected" : ""}>Bottom Left</option>
              <option value="br" ${config.position === "br" ? "selected" : ""}>Bottom Right</option>
            </select>
          </div>

          <div class="cts-setting">
            <label for="cts-theme">Theme:</label>
            <select id="cts-theme" data-role="theme">
              <option value="auto" ${config.theme === "auto" ? "selected" : ""}>Auto</option>
              <option value="light" ${config.theme === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${config.theme === "dark" ? "selected" : ""}>Dark</option>
            </select>
          </div>

          <div class="cts-setting">
            <label>
              <input type="checkbox" data-role="enabled" ${config.enabled ? "checked" : ""} />
              Enabled
            </label>
          </div>

          <div class="cts-panel-footer">
            <button class="cts-btn-reset" data-role="reset" type="button">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (!this.button || !this.panel) return;

    // Toggle panel
    this.button.addEventListener("click", () => this.togglePanel());

    // Close button
    this.panel
      .querySelector('[data-role="close"]')
      ?.addEventListener("click", () => this.closePanel());

    // Settings changes
    this.panel
      .querySelector('[data-role="hotkey"]')
      ?.addEventListener("change", (e) => {
        const value = (e.target as HTMLSelectElement).value as any;
        configManager.set("hotkey", value);
      });

    this.panel
      .querySelector('[data-role="position"]')
      ?.addEventListener("change", (e) => {
        const value = (e.target as HTMLSelectElement).value as any;
        configManager.set("position", value);
        this.updatePosition();
      });

    this.panel
      .querySelector('[data-role="theme"]')
      ?.addEventListener("change", (e) => {
        const value = (e.target as HTMLSelectElement).value as any;
        configManager.set("theme", value);
        this.updateTheme();
      });

    this.panel
      .querySelector('[data-role="enabled"]')
      ?.addEventListener("change", (e) => {
        const value = (e.target as HTMLInputElement).checked;
        configManager.set("enabled", value);
      });

    this.panel
      .querySelector('[data-role="reset"]')
      ?.addEventListener("click", () => {
        configManager.reset();
        this.closePanel();
        window.location.reload();
      });

    // Dragging
    this.button.addEventListener("mousedown", this.startDrag.bind(this));
    document.addEventListener("mousemove", this.drag.bind(this));
    document.addEventListener("mouseup", this.endDrag.bind(this));
  }

  private togglePanel(): void {
    if (!this.panel) return;
    if (this.panel.style.display === "none") {
      this.openPanel();
    } else {
      this.closePanel();
    }
  }

  private openPanel(): void {
    if (!this.panel) return;
    this.panel.style.display = "block";
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.panel.style.display = "none";
  }

  private startDrag(e: MouseEvent): void {
    if (!this.button || this.panel?.style.display !== "none") return;
    this.isDragging = true;
    const rect = this.button.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private drag(e: MouseEvent): void {
    if (!this.isDragging || !this.button) return;
    this.button.style.left = e.clientX - this.dragOffset.x + "px";
    this.button.style.top = e.clientY - this.dragOffset.y + "px";
  }

  private endDrag(): void {
    this.isDragging = false;
  }

  private updatePosition(): void {
    if (!this.button || !this.panel) return;
    const config = configManager.getConfig();
    const gap = 12;

    this.button.style.position = "fixed";
    this.button.style.zIndex = "999999";

    switch (config.position) {
      case "tl":
        this.button.style.top = gap + "px";
        this.button.style.left = gap + "px";
        this.button.style.right = "auto";
        this.button.style.bottom = "auto";
        this.panel.style.top = "70px";
        this.panel.style.left = gap + "px";
        this.panel.style.right = "auto";
        this.panel.style.bottom = "auto";
        break;
      case "tr":
        this.button.style.top = gap + "px";
        this.button.style.right = gap + "px";
        this.button.style.left = "auto";
        this.button.style.bottom = "auto";
        this.panel.style.top = "70px";
        this.panel.style.right = gap + "px";
        this.panel.style.left = "auto";
        this.panel.style.bottom = "auto";
        break;
      case "bl":
        this.button.style.bottom = gap + "px";
        this.button.style.left = gap + "px";
        this.button.style.right = "auto";
        this.button.style.top = "auto";
        this.panel.style.bottom = "70px";
        this.panel.style.left = gap + "px";
        this.panel.style.right = "auto";
        this.panel.style.top = "auto";
        break;
      case "br":
      default:
        this.button.style.bottom = gap + "px";
        this.button.style.right = gap + "px";
        this.button.style.left = "auto";
        this.button.style.top = "auto";
        this.panel.style.bottom = "70px";
        this.panel.style.right = gap + "px";
        this.panel.style.left = "auto";
        this.panel.style.top = "auto";
    }
  }

  private updateTheme(): void {
    if (!this.container) return;
    const config = configManager.getConfig();
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark =
      config.theme === "dark" || (config.theme === "auto" && prefersDark);

    this.container.classList.toggle("cts-dark", isDark);
  }

  private injectStyles(): void {
    if (document.getElementById("__click-to-source-styles")) return;

    const style = document.createElement("style");
    style.id = "__click-to-source-styles";
    style.textContent = `
      #__click-to-source-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .cts-button {
        position: fixed;
        width: 48px;
        height: 48px;
        bottom: 12px;
        right: 12px;
        background: rgba(88, 166, 255, 0.9);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        color: white;
        transition: all 0.2s ease;
        user-select: none;
        z-index: 999999;
      }

      .cts-button:hover {
        background: rgba(88, 166, 255, 1);
        box-shadow: 0 6px 16px rgba(88, 166, 255, 0.4);
        transform: scale(1.1);
      }

      .cts-button:active {
        transform: scale(0.95);
      }

      .cts-panel {
        position: fixed;
        width: 280px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(10px);
        z-index: 999998;
        animation: slideUp 0.2s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .cts-dark .cts-panel {
        background: rgba(30, 30, 30, 0.95);
        border-color: rgba(255, 255, 255, 0.1);
        color: #f5f5f5;
      }

      .cts-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      .cts-dark .cts-panel-header {
        border-bottom-color: rgba(255, 255, 255, 0.1);
      }

      .cts-panel-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .cts-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: inherit;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .cts-close:hover {
        opacity: 0.7;
      }

      .cts-panel-content {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .cts-setting {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cts-setting label {
        font-size: 12px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.6);
      }

      .cts-dark .cts-setting label {
        color: rgba(255, 255, 255, 0.6);
      }

      .cts-setting select,
      .cts-setting input[type="checkbox"] {
        padding: 6px 8px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        font-size: 13px;
        background: white;
        color: inherit;
      }

      .cts-dark .cts-setting select,
      .cts-dark .cts-setting input[type="checkbox"] {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .cts-setting input[type="checkbox"] {
        width: auto;
        cursor: pointer;
      }

      .cts-panel-footer {
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
      }

      .cts-dark .cts-panel-footer {
        border-top-color: rgba(255, 255, 255, 0.1);
      }

      .cts-btn-reset {
        width: 100%;
        padding: 6px 12px;
        background: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: inherit;
      }

      .cts-dark .cts-btn-reset {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .cts-btn-reset:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .cts-dark .cts-btn-reset:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .${HIGHLIGHT_CLASS} {
        outline: 2px solid rgb(88, 166, 255);
        outline-offset: 2px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Destroy UI
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
