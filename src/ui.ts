import { configManager } from "./config";

type SettingsTab = "general" | "filters";

function parseSelectorList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function formatSelectorList(selectors: string[]): string {
  return selectors.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class ClickToSourceUI {
  private container: HTMLElement | null = null;
  private button: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private activeTab: SettingsTab = "general";
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.render();
  }

  private render(): void {
    const config = configManager.getConfig();
    if (!config.showButton) return;

    this.container = document.createElement("div");
    this.container.id = "__click-to-source-container";
    this.container.innerHTML = this.getContainerHTML();
    document.body.appendChild(this.container);

    this.button = this.container.querySelector('[data-role="button"]') as HTMLElement;
    this.panel = this.container.querySelector('[data-role="panel"]') as HTMLElement;

    if (!this.button || !this.panel) {
      console.error("[click-to-source] Failed to render UI elements");
      return;
    }

    this.injectStyles();
    this.setupEventListeners();
    this.setActiveTab(this.activeTab);
    this.updatePosition();
    this.updateTheme();

    this.unsubscribe = configManager.subscribe(() => {
      this.updatePosition();
      this.updateTheme();
      this.syncPanelState();
    });

    this.syncPanelState();
  }

  private getContainerHTML(): string {
    const config = configManager.getConfig();

    return `
      <button class="cts-button" data-role="button" type="button" title="click-to-source settings">
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
          <path d="M12 3.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9L12 15.2 7.6 17.05l.84-4.9-3.56-3.47 4.92-.72L12 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="2.1" fill="currentColor"/>
        </svg>
      </button>

      <div class="cts-panel" data-role="panel" style="display: none;">
        <div class="cts-panel-header">
          <div class="cts-panel-title">
            <h3>click-to-source</h3>
            <a
              class="cts-panel-link"
              href="https://www.npmjs.com/package/click-to-source"
              target="_blank"
              rel="noreferrer"
            >npm</a>
          </div>
          <button class="cts-close" data-role="close" type="button" aria-label="Close settings">x</button>
        </div>

        <div class="cts-panel-content">
          <div class="cts-status" data-role="runtime-status"></div>

          <div class="cts-tabs" role="tablist" aria-label="click-to-source settings sections">
            <button class="cts-tab is-active" data-role="tab" data-tab="general" type="button" role="tab" aria-selected="true">General</button>
            <button class="cts-tab" data-role="tab" data-tab="filters" type="button" role="tab" aria-selected="false">Filters</button>
          </div>

          <div class="cts-tab-panels">
            <section class="cts-tab-panel is-active" data-role="tab-panel" data-tab-panel="general" role="tabpanel">
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
                <label for="cts-action">Action:</label>
                <select id="cts-action" data-role="action">
                  <option value="open" ${config.action === "open" ? "selected" : ""}>Open in editor</option>
                  <option value="copy" ${config.action === "copy" ? "selected" : ""}>Copy source path</option>
                  <option value="inspect" ${config.action === "inspect" ? "selected" : ""}>Inspect only</option>
                </select>
              </div>

              <div class="cts-setting">
                <label for="cts-editor">Editor:</label>
                <select id="cts-editor" data-role="editor">
                  <option value="vscode" ${config.openIn === "vscode" ? "selected" : ""}>VS Code</option>
                  <option value="cursor" ${config.openIn === "cursor" ? "selected" : ""}>Cursor</option>
                  <option value="webstorm" ${config.openIn === "webstorm" ? "selected" : ""}>WebStorm</option>
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

              <div class="cts-setting cts-setting-inline">
                <label>
                  <input type="checkbox" data-role="enabled" ${config.enabled ? "checked" : ""} />
                  Enabled
                </label>
              </div>
            </section>

            <section class="cts-tab-panel" data-role="tab-panel" data-tab-panel="filters" role="tabpanel">
              <div class="cts-setting">
                <label for="cts-include-selectors">Include selectors:</label>
                <textarea
                  id="cts-include-selectors"
                  data-role="include-selectors"
                  rows="5"
                  placeholder="button, a, [role=&quot;button&quot;]"
                >${escapeHtml(formatSelectorList(config.includeSelectors))}</textarea>
                <small>Only instrumented elements matching these selectors will respond.</small>
              </div>

              <div class="cts-setting">
                <label for="cts-exclude-selectors">Exclude selectors:</label>
                <textarea
                  id="cts-exclude-selectors"
                  data-role="exclude-selectors"
                  rows="5"
                  placeholder=".layout-shell, .decorative-wrapper"
                >${escapeHtml(formatSelectorList(config.excludeSelectors))}</textarea>
                <small>Matching instrumented elements are skipped in favor of a parent source target.</small>
              </div>
            </section>
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

    this.button.addEventListener("click", () => this.togglePanel());
    this.panel
      .querySelector('[data-role="close"]')
      ?.addEventListener("click", () => this.closePanel());

    this.panel.querySelectorAll('[data-role="tab"]').forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = (tab as HTMLElement).dataset.tab as SettingsTab | undefined;
        if (tabName) {
          this.setActiveTab(tabName);
        }
      });
    });

    this.panel
      .querySelector('[data-role="hotkey"]')
      ?.addEventListener("change", (e) => {
        configManager.set("hotkey", (e.target as HTMLSelectElement).value as any);
      });

    this.panel
      .querySelector('[data-role="action"]')
      ?.addEventListener("change", (e) => {
        configManager.set("action", (e.target as HTMLSelectElement).value as any);
        this.syncPanelState();
      });

    this.panel
      .querySelector('[data-role="editor"]')
      ?.addEventListener("change", (e) => {
        configManager.set("openIn", (e.target as HTMLSelectElement).value as any);
      });

    this.panel
      .querySelector('[data-role="position"]')
      ?.addEventListener("change", (e) => {
        configManager.set("position", (e.target as HTMLSelectElement).value as any);
        this.updatePosition();
      });

    this.panel
      .querySelector('[data-role="theme"]')
      ?.addEventListener("change", (e) => {
        configManager.set("theme", (e.target as HTMLSelectElement).value as any);
        this.updateTheme();
      });

    this.panel
      .querySelector('[data-role="enabled"]')
      ?.addEventListener("change", (e) => {
        configManager.set("enabled", (e.target as HTMLInputElement).checked);
      });

    this.panel
      .querySelector('[data-role="include-selectors"]')
      ?.addEventListener("change", (e) => {
        configManager.set(
          "includeSelectors",
          parseSelectorList((e.target as HTMLTextAreaElement).value),
        );
      });

    this.panel
      .querySelector('[data-role="exclude-selectors"]')
      ?.addEventListener("change", (e) => {
        configManager.set(
          "excludeSelectors",
          parseSelectorList((e.target as HTMLTextAreaElement).value),
        );
      });

    this.panel
      .querySelector('[data-role="reset"]')
      ?.addEventListener("click", () => {
        configManager.reset();
        this.closePanel();
        window.location.reload();
      });

    this.button.addEventListener("mousedown", this.startDrag.bind(this));
    document.addEventListener("mousemove", this.drag.bind(this));
    document.addEventListener("mouseup", this.endDrag.bind(this));
  }

  private togglePanel(): void {
    if (!this.panel) return;
    if (this.panel.style.display === "none") {
      this.openPanel();
      return;
    }
    this.closePanel();
  }

  private openPanel(): void {
    if (!this.panel) return;
    this.panel.style.display = "block";
    this.setActiveTab(this.activeTab);
    this.syncPanelState();
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
    this.button.style.left = `${e.clientX - this.dragOffset.x}px`;
    this.button.style.top = `${e.clientY - this.dragOffset.y}px`;
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
        this.button.style.top = `${gap}px`;
        this.button.style.left = `${gap}px`;
        this.button.style.right = "auto";
        this.button.style.bottom = "auto";
        this.panel.style.top = "70px";
        this.panel.style.left = `${gap}px`;
        this.panel.style.right = "auto";
        this.panel.style.bottom = "auto";
        break;
      case "tr":
        this.button.style.top = `${gap}px`;
        this.button.style.right = `${gap}px`;
        this.button.style.left = "auto";
        this.button.style.bottom = "auto";
        this.panel.style.top = "70px";
        this.panel.style.right = `${gap}px`;
        this.panel.style.left = "auto";
        this.panel.style.bottom = "auto";
        break;
      case "bl":
        this.button.style.bottom = `${gap}px`;
        this.button.style.left = `${gap}px`;
        this.button.style.right = "auto";
        this.button.style.top = "auto";
        this.panel.style.bottom = "70px";
        this.panel.style.left = `${gap}px`;
        this.panel.style.right = "auto";
        this.panel.style.top = "auto";
        break;
      case "br":
      default:
        this.button.style.bottom = `${gap}px`;
        this.button.style.right = `${gap}px`;
        this.button.style.left = "auto";
        this.button.style.top = "auto";
        this.panel.style.bottom = "70px";
        this.panel.style.right = `${gap}px`;
        this.panel.style.left = "auto";
        this.panel.style.top = "auto";
        break;
    }
  }

  private updateTheme(): void {
    if (!this.container) return;

    const config = configManager.getConfig();
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark =
      config.theme === "dark" || (config.theme === "auto" && prefersDark);

    this.container.classList.toggle("cts-dark", isDark);
  }

  private setActiveTab(tab: SettingsTab): void {
    this.activeTab = tab;
    if (!this.panel) return;

    this.panel.querySelectorAll<HTMLElement>('[data-role="tab"]').forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === tab);
      button.setAttribute("aria-selected", button.dataset.tab === tab ? "true" : "false");
    });

    this.panel.querySelectorAll<HTMLElement>('[data-role="tab-panel"]').forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tab);
    });
  }

  private syncPanelState(): void {
    if (!this.panel) return;

    const config = configManager.getConfig();
    const runtimeStatus = this.panel.querySelector<HTMLElement>('[data-role="runtime-status"]');
    const editorSelect = this.panel.querySelector<HTMLSelectElement>('[data-role="editor"]');

    if (runtimeStatus) {
      runtimeStatus.textContent = this.getRuntimeStatusText(config.action);
    }

    if (editorSelect) {
      editorSelect.disabled = config.action !== "open";
    }
  }

  private getRuntimeStatusText(action: ReturnType<typeof configManager.getConfig>["action"]): string {
    switch (action) {
      case "copy":
        return "Local mode only. Hotkey clicks will copy the source path from the instrumented element.";
      case "inspect":
        return "Local mode only. Hotkey clicks will show the source path without opening your editor.";
      case "open":
      default:
        return "Local mode only. Hotkey clicks will open the source in your editor.";
    }
  }

  private injectStyles(): void {
    if (document.getElementById("__click-to-source-styles")) {
      return;
    }

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
        background:
          radial-gradient(circle at 28% 28%, rgba(255, 255, 255, 0.34), transparent 40%),
          linear-gradient(135deg, rgb(14, 165, 233), rgb(37, 99, 235));
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow:
          0 12px 28px rgba(37, 99, 235, 0.32),
          inset 0 1px 0 rgba(255, 255, 255, 0.24);
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        user-select: none;
        z-index: 999999;
      }

      .cts-button:hover {
        transform: translateY(-1px) scale(1.06);
        filter: saturate(1.08);
        box-shadow:
          0 16px 34px rgba(37, 99, 235, 0.36),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }

      .cts-button:active {
        transform: scale(0.95);
      }

      .cts-panel {
        position: fixed;
        display: flex;
        flex-direction: column;
        width: min(360px, calc(100vw - 24px));
        max-height: min(78vh, 680px);
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(10px);
        z-index: 999998;
        overflow: hidden;
        animation: cts-slide-up 0.2s ease;
      }

      @keyframes cts-slide-up {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .cts-dark .cts-panel {
        background: rgba(30, 30, 30, 0.96);
        border-color: rgba(255, 255, 255, 0.1);
        color: #f5f5f5;
        color-scheme: dark;
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

      .cts-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cts-panel-title h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .cts-panel-link {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(88, 166, 255, 0.14);
        color: rgb(24, 78, 147);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-decoration: none;
        text-transform: uppercase;
      }

      .cts-panel-link:hover {
        background: rgba(88, 166, 255, 0.22);
      }

      .cts-dark .cts-panel-link {
        background: rgba(88, 166, 255, 0.2);
        color: #dbeafe;
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

      .cts-panel-content {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
      }

      .cts-status {
        margin: 12px 16px 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(88, 166, 255, 0.12);
        border: 1px solid rgba(88, 166, 255, 0.24);
        color: rgb(24, 78, 147);
        font-size: 12px;
        line-height: 1.45;
      }

      .cts-dark .cts-status {
        background: rgba(88, 166, 255, 0.14);
        border-color: rgba(88, 166, 255, 0.26);
        color: #dbeafe;
      }

      .cts-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 12px 16px 0;
      }

      .cts-tab {
        padding: 8px 10px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.04);
        color: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease, border-color 0.2s ease;
      }

      .cts-tab.is-active {
        background: rgba(88, 166, 255, 0.18);
        border-color: rgba(88, 166, 255, 0.4);
        color: rgb(24, 78, 147);
      }

      .cts-dark .cts-tab {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .cts-dark .cts-tab.is-active {
        background: rgba(88, 166, 255, 0.24);
        border-color: rgba(88, 166, 255, 0.45);
        color: #dbeafe;
      }

      .cts-tab-panels {
        padding: 12px 16px 0;
        overflow-y: auto;
        min-height: 0;
        flex: 1 1 auto;
      }

      .cts-tab-panel {
        display: none;
        flex-direction: column;
        gap: 12px;
        padding-bottom: 12px;
      }

      .cts-tab-panel.is-active {
        display: flex;
      }

      .cts-setting {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cts-setting-inline {
        flex-direction: row;
        align-items: center;
      }

      .cts-setting label {
        font-size: 12px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.62);
      }

      .cts-dark .cts-setting label {
        color: rgba(255, 255, 255, 0.68);
      }

      .cts-setting select,
      .cts-setting input[type="text"],
      .cts-setting textarea,
      .cts-setting input[type="checkbox"] {
        padding: 6px 8px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        font-size: 13px;
        background: white;
        color: inherit;
        box-sizing: border-box;
      }

      .cts-setting select,
      .cts-setting textarea {
        width: 100%;
      }

      .cts-dark .cts-setting select,
      .cts-dark .cts-setting textarea,
      .cts-dark .cts-setting input[type="checkbox"] {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: #f5f5f5;
      }

      .cts-setting select option {
        background: white;
        color: #111827;
      }

      .cts-dark .cts-setting select option {
        background: rgb(31, 41, 55);
        color: #f5f5f5;
      }

      .cts-setting textarea {
        resize: vertical;
        min-height: 68px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .cts-setting small {
        color: rgba(0, 0, 0, 0.55);
        font-size: 11px;
        line-height: 1.4;
      }

      .cts-dark .cts-setting small {
        color: rgba(255, 255, 255, 0.6);
      }

      .cts-panel-footer {
        padding: 12px 16px 16px;
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
        transition: background 0.2s ease;
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
    `;

    document.head.appendChild(style);
  }

  destroy(): void {
    this.container?.remove();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
