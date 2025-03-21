import React, { useState, useEffect } from "react";
import ProxyTable from "./components/ProxyTable";
import AddProxyForm from "./components/AddProxyForm";
import SettingsModal from "./components/SettingsModal";
import { ProxyEntry, ProxySettings, AppState } from "./types";
import { StorageManager } from "./utils/storage";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    proxies: [],
    settings: { mode: "all", selectedDomains: [] },
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [currentProxyIndex, setCurrentProxyIndex] = useState<number | null>(
    null
  );
  const [addProxyModalOpen, setAddProxyModalOpen] = useState(false);

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
    // Process each line to extract proxy details
    const newProxies = proxyList
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        // Handle different formats
        if (line.includes("@")) {
          // Format: login:password@ip:port
          const [credentials, server] = line.split("@");
          const [login, password] = credentials.split(":");
          const [host, port] = server.split(":");
          return { active: false, host, port, login, password };
        } else {
          // Format: ip:port or ip:port:login:password
          const parts = line.split(":");
          if (parts.length === 2) {
            // ip:port
            return {
              active: false,
              host: parts[0],
              port: parts[1],
              login: "",
              password: "",
            };
          } else if (parts.length >= 4) {
            // ip:port:login:password
            return {
              active: false,
              host: parts[0],
              port: parts[1],
              login: parts[2],
              password: parts[3],
            };
          }
          // Default if format doesn't match
          return {
            active: false,
            host: line,
            port: "",
            login: "",
            password: "",
          };
        }
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

  const deleteProxy = (index: number) => {
    const newProxies = [...state.proxies];
    newProxies.splice(index, 1);
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
    <div className="app-container">
      <main className="app-content">
        <ProxyTable
          proxies={state.proxies}
          toggleProxy={toggleProxy}
          openSettings={openSettings}
          deleteProxy={deleteProxy}
          addProxy={() => setAddProxyModalOpen(true)}
        />

        {addProxyModalOpen && (
          <AddProxyForm
            addProxyList={addProxyList}
            onClose={() => setAddProxyModalOpen(false)}
            isOpen={addProxyModalOpen}
          />
        )}
      </main>

      {settingsModalOpen && (
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          settings={state.settings}
          onSave={saveSettings}
        />
      )}
    </div>
  );
};

export default App;
