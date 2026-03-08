import { DEFAULT_SERVER_PATH } from "./constants";

export interface ClickToSourceConfig {
  enabled: boolean;
  hotkey: "ctrl" | "alt" | "meta" | "shift";
  position: "tl" | "tr" | "bl" | "br";
  theme: "light" | "dark" | "auto";
  showButton: boolean;
  serverPath: string;
  serverBaseUrl?: string;
  openIn: "vscode" | "cursor" | "webstorm";
}

const STORAGE_KEY = "__click_to_source_config";

const DEFAULT_CONFIG: ClickToSourceConfig = {
  enabled: true,
  hotkey: "ctrl",
  position: "br",
  theme: "auto",
  showButton: true,
  serverPath: DEFAULT_SERVER_PATH,
  openIn: "vscode",
};

/**
 * Configuration manager for click-to-source
 * Handles loading/saving preferences from localStorage
 */
export class ConfigManager {
  private config: ClickToSourceConfig = { ...DEFAULT_CONFIG };
  private listeners = new Set<(config: ClickToSourceConfig) => void>();

  constructor() {
    this.load();
  }

  /**
   * Load configuration from localStorage
   */
  load(): void {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      this.config = { ...DEFAULT_CONFIG };
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn("[click-to-source] Failed to load config from localStorage");
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save configuration to localStorage
   */
  save(): void {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn("[click-to-source] Failed to save config to localStorage");
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ClickToSourceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(partial: Partial<ClickToSourceConfig>): void {
    this.config = { ...this.config, ...partial };
    this.save();
    this.notify();
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
    this.notify();
  }

  /**
   * Get specific config value
   */
  get<K extends keyof ClickToSourceConfig>(key: K): ClickToSourceConfig[K] {
    return this.config[key];
  }

  /**
   * Set specific config value
   */
  set<K extends keyof ClickToSourceConfig>(
    key: K,
    value: ClickToSourceConfig[K]
  ): void {
    this.config[key] = value;
    this.save();
    this.notify();
  }

  subscribe(listener: (config: ClickToSourceConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getConfig();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

// Singleton instance
export const configManager = new ConfigManager();
