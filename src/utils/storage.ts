import { AppState, ProxyEntry, ProxySettings } from "../types";

export interface StorageManagerType {
  getState(): Promise<AppState>;
  setState(state: AppState): Promise<void>;
  updateState(updater: (state: AppState) => AppState): Promise<void>;
  validateState(state: AppState): Promise<boolean>;
  backupState(): Promise<void>;
  restoreFromBackup(): Promise<boolean>;
  migrateData(state: AppState): AppState;
}

// Legacy settings type for migration
interface LegacyProxySettings {
  mode: "all" | "selected" | "global" | "domain-based";
  selectedDomains?: string[];
}

// Migration function to handle legacy data without name field and new multi-proxy features
const migrateProxies = (
  proxies: ProxyEntry[],
  legacySettings?: LegacyProxySettings
): ProxyEntry[] => {
  return proxies.map((proxy, index) => {
    const migratedProxy: ProxyEntry = {
      ...proxy,
      // Add name field if missing
      name: proxy.name !== undefined ? proxy.name : `Proxy-${index + 1}`,
      // Add domains field if missing
      domains: proxy.domains !== undefined ? proxy.domains : [],
      // Add priority field based on position in array
      priority: proxy.priority !== undefined ? proxy.priority : index,
    };

    // If this is a legacy migration and we have selectedDomains in settings,
    // migrate them to the active proxy
    if (
      legacySettings &&
      (legacySettings.mode === "selected" || legacySettings.mode === "all") &&
      proxy.active &&
      legacySettings.selectedDomains
    ) {
      migratedProxy.domains = [...legacySettings.selectedDomains];
    }

    return migratedProxy;
  });
};

// Migration function for settings
const migrateSettings = (settings: any): ProxySettings => {
  const migratedSettings: ProxySettings = {
    // Map legacy modes to new modes
    mode:
      settings.mode === "all"
        ? "global"
        : settings.mode === "selected"
        ? "domain-based"
        : settings.mode || "global",
  };

  return migratedSettings;
};

export const StorageManager: StorageManagerType = {
  async getState(): Promise<AppState> {
    return new Promise((resolve) => {
      chrome.storage.local.get("appState", (result) => {
        const rawState = result.appState || {
          proxies: [],
          settings: { mode: "all", selectedDomains: [] },
        };

        // Apply migration
        const migratedState = this.migrateData(rawState);

        // Save migrated state back if it was modified
        if (JSON.stringify(rawState) !== JSON.stringify(migratedState)) {
          this.setState(migratedState);
        }

        resolve(migratedState);
      });
    });
  },

  async setState(state: AppState): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ appState: state }, resolve);
    });
  },

  async updateState(updater: (state: AppState) => AppState): Promise<void> {
    const currentState = await this.getState();
    const newState = updater(currentState);
    await this.setState(newState);
  },

  async validateState(state: AppState): Promise<boolean> {
    if (!state || !state.settings || !Array.isArray(state.proxies)) {
      return false;
    }

    // Validate proxy entries have required fields
    for (const proxy of state.proxies) {
      if (
        typeof proxy.active !== "boolean" ||
        typeof proxy.host !== "string" ||
        typeof proxy.port !== "string" ||
        typeof proxy.login !== "string" ||
        typeof proxy.password !== "string" ||
        !Array.isArray(proxy.domains)
      ) {
        return false;
      }
    }

    // Validate settings
    if (!["global", "domain-based"].includes(state.settings.mode)) {
      return false;
    }

    return true;
  },

  migrateData(state: any): AppState {
    // Store legacy settings for proxy migration
    const legacySettings: LegacyProxySettings = state.settings;

    return {
      proxies: migrateProxies(state.proxies || [], legacySettings),
      settings: migrateSettings(state.settings || {}),
    };
  },

  async backupState(): Promise<void> {
    const state = await this.getState();
    return new Promise((resolve) => {
      chrome.storage.local.set({ appStateBackup: state }, resolve);
    });
  },

  async restoreFromBackup(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get("appStateBackup", async (result) => {
        if (
          result.appStateBackup &&
          (await this.validateState(result.appStateBackup))
        ) {
          // Apply migration to backup as well
          const migratedState = this.migrateData(result.appStateBackup);
          await this.setState(migratedState);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },
};

export { StorageManager as default };
