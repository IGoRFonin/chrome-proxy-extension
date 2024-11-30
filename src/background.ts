import { StorageManager } from './utils/storage';
import type { AppState, ProxyEntry } from './types';

chrome.runtime.onInstalled.addListener(async () => {
  await StorageManager.setState({
    proxies: [],
    settings: { mode: 'all', selectedDomains: [] }
  });
  
  chrome.contextMenus.create({
    id: "addDomain",
    title: "Add domain to proxy list",
    contexts: ["all"]
  });
  
  chrome.contextMenus.create({
    id: "removeDomain",
    title: "Remove domain from proxy list",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addDomain" || info.menuItemId === "removeDomain") {
    const url = new URL(tab?.url || "");
    const domain = url.hostname;
    
    await StorageManager.updateState((state) => {
      if (info.menuItemId === "addDomain") {
        if (state.settings.mode === 'all') {
          state.settings.mode = 'selected';
        }
        if (!state.settings.selectedDomains.includes(domain)) {
          state.settings.selectedDomains.push(domain);
        }
      } else {
        state.settings.selectedDomains = state.settings.selectedDomains.filter(d => d !== domain);
      }
      return state;
    });
  }
});

function updateIcon(isActive: boolean) {
  chrome.action.setIcon({
    path: isActive ? "icon-active-128.png" : "icon-128.png"
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.appState) {
    const newState: AppState = changes.appState.newValue;
    const activeProxy = newState.proxies.find((proxy: ProxyEntry) => proxy.active);
    
    if (activeProxy) {
      setProxySettings(activeProxy, newState.settings);
      updateIcon(true);
    } else {
      chrome.proxy.settings.clear({ scope: 'regular' });
      updateIcon(false);
    }
  }
});

function setProxySettings(proxy: ProxyEntry, settings: AppState['settings']) {
  let config: chrome.proxy.ProxyConfig;

  if (settings.mode === 'all') {
    config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: proxy.host,
          port: parseInt(proxy.port, 10)
        }
      }
    };
  } else {
    config = {
      mode: "pac_script",
      pacScript: {
        data: `
          function FindProxyForURL(url, host) {
            var proxy = "PROXY ${proxy.host}:${proxy.port}";
            var domains = ${JSON.stringify(settings.selectedDomains)};
            
            for (var i = 0; i < domains.length; i++) {
              var domain = domains[i];
              if (domain.startsWith('*.')) {
                var suffix = domain.substr(1);
                if (dnsDomainIs(host, suffix) || host.endsWith(suffix)) {
                  return proxy;
                }
              } else if (host === domain || host.endsWith('.' + domain)) {
                return proxy;
              }
            }
            return "DIRECT";
          }
        `
      }
    };
  }
  
  chrome.proxy.settings.set({ value: config, scope: 'regular' });
  
  if (proxy.login && proxy.password) {
    chrome.webRequest.onAuthRequired.addListener(
      authListener,
      { urls: ["<all_urls>"] },
      ["asyncBlocking"]
    );
  } else {
    chrome.webRequest.onAuthRequired.removeListener(authListener);
  }
}

async function authListener(
  details: chrome.webRequest.WebAuthenticationChallengeDetails,
  callback?: (response: chrome.webRequest.BlockingResponse) => void
) {
  const appState = await StorageManager.getState();
  const activeProxy = appState.proxies.find(proxy => proxy.active);
  
  if (activeProxy && activeProxy.login && activeProxy.password && callback) {
    callback({
      authCredentials: {
        username: activeProxy.login,
        password: activeProxy.password
      }
    });
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.appState) {
    const newState = changes.appState.newValue;
    console.log('Storage updated:', newState);
  }
});

export {};