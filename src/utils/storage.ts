import { AppState } from '../types';

export interface StorageManagerType {
  getState(): Promise<AppState>;
  setState(state: AppState): Promise<void>;
  updateState(updater: (state: AppState) => AppState): Promise<void>;
  validateState(state: AppState): Promise<boolean>;
  backupState(): Promise<void>;
  restoreFromBackup(): Promise<boolean>;
}

export const StorageManager: StorageManagerType = {
  async getState(): Promise<AppState> {
    return new Promise((resolve) => {
      chrome.storage.sync.get('appState', (result) => {
        resolve(result.appState || {
          proxies: [],
          settings: { mode: 'all', selectedDomains: [] }
        });
      });
    });
  },

  async setState(state: AppState): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ appState: state }, resolve);
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
    return true;
  },

  async backupState(): Promise<void> {
    const state = await this.getState();
    return new Promise((resolve) => {
      chrome.storage.local.set({ appStateBackup: state }, resolve);
    });
  },

  async restoreFromBackup(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get('appStateBackup', async (result) => {
        if (result.appStateBackup && await this.validateState(result.appStateBackup)) {
          await this.setState(result.appStateBackup);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
};

export { StorageManager as default }; 