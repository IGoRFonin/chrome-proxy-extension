import React, { useState, useEffect } from 'react';
import ProxyTable from './components/ProxyTable';
import AddProxyForm from './components/AddProxyForm';
import SettingsModal from './components/SettingsModal';
import { ProxyEntry, ProxySettings, AppState } from './types';
import { StorageManager } from './utils/storage';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    proxies: [],
    settings: { mode: 'all', selectedDomains: [] }
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [currentProxyIndex, setCurrentProxyIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadState = async () => {
      const state = await StorageManager.getState();
      setState(state);
    };
    loadState();
  }, []);

  const saveState = async (newState: AppState) => {
    setState(newState);
    await StorageManager.setState(newState);
  };

  const addProxyList = (proxyList: string) => {
    const newProxies = proxyList.split('\n').map((line) => {
      const [host, port, login, password] = line.split(':');
      return { active: false, host, port, login, password };
    });
    saveState({ ...state, proxies: [...state.proxies, ...newProxies] });
  };

  const toggleProxy = (index: number) => {
    const newProxies = state.proxies.map((proxy, i) => {
      if (i === index) {
        return { ...proxy, active: !proxy.active };
      } else {
        return { ...proxy, active: false };
      }
    });
    saveState({ ...state, proxies: newProxies });
  };

  const openSettings = (index: number) => {
    setCurrentProxyIndex(index);
    setSettingsModalOpen(true);
  };

  const saveSettings = (settings: ProxySettings) => {
    saveState({ ...state, settings });
  };

  return (
    <div className="app">
      <h1>Proxy Manager</h1>
      <ProxyTable 
        proxies={state.proxies} 
        toggleProxy={toggleProxy} 
        openSettings={openSettings}
      />
      <AddProxyForm addProxyList={addProxyList} />
      <SettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={state.settings}
        onSave={saveSettings}
      />
    </div>
  );
};

export default App;