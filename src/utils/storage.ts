import { AppState, ProxyEntry } from "../types";

export interface StorageManagerType {
  getState(): Promise<AppState>;
  setState(state: AppState): Promise<void>;
  updateState(updater: (state: AppState) => AppState): Promise<void>;
  validateState(state: AppState): Promise<boolean>;
  backupState(): Promise<void>;
  restoreFromBackup(): Promise<boolean>;
  migrateData(state: AppState): AppState;
}

// Migration function to handle legacy data without name field
const migrateProxies = (proxies: ProxyEntry[]): ProxyEntry[] => {
  return proxies.map((proxy, index) => {
    // If proxy doesn't have a name field, add one
    if (proxy.name === undefined) {
      return {
        ...proxy,
        name: `Proxy-${index + 1}`, // Default naming pattern
      };
    }
    return proxy;
  });
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
        typeof proxy.password !== "string"
      ) {
        return false;
      }
    }

    return true;
  },

  migrateData(state: AppState): AppState {
    return {
      ...state,
      proxies: migrateProxies(state.proxies),
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
