import { StorageManager } from "./utils/storage";
import type { AppState, ProxyEntry } from "./types";

chrome.runtime.onInstalled.addListener(async () => {
  const state = await StorageManager.getState();

  if (!state.proxies.length) {
    await StorageManager.setState({
      proxies: [],
      settings: { mode: "global" },
    });
  }

  // Create base context menu items
  chrome.contextMenus.create({
    id: "addDomain",
    title: "Add domain to proxy list",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "addDomainSubDomain",
    title: "Add subdomain to proxy list",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "removeDomain",
    title: "Remove domain from proxy list",
    contexts: ["all"],
  });

  // Update context menus based on current state
  updateContextMenus(state);
});

// Initialize proxy settings when browser starts
chrome.runtime.onStartup.addListener(async () => {
  const state = await StorageManager.getState();
  const activeProxies = state.proxies.filter((proxy) => proxy.active);

  if (activeProxies.length > 0) {
    setProxySettings(activeProxies, state.settings);
    updateIcon(true);
  } else {
    updateIcon(false);
  }
});

// Also initialize on extension load (helps when extension is reloaded/updated)
(async () => {
  const state = await StorageManager.getState();
  const activeProxies = state.proxies.filter((proxy) => proxy.active);

  if (activeProxies.length > 0) {
    setProxySettings(activeProxies, state.settings);
    updateIcon(true);
  } else {
    updateIcon(false);
  }
})();

// Update context menus based on current state
function updateContextMenus(state: AppState) {
  // Remove existing dynamic menu items
  chrome.contextMenus.removeAll(() => {
    // Recreate base items
    chrome.contextMenus.create({
      id: "addDomain",
      title: "Add domain to proxy list",
      contexts: ["all"],
    });

    chrome.contextMenus.create({
      id: "addDomainSubDomain",
      title: "Add subdomain to proxy list",
      contexts: ["all"],
    });

    chrome.contextMenus.create({
      id: "removeDomain",
      title: "Remove domain from proxy list",
      contexts: ["all"],
    });

    // In domain-based mode, create submenu for active proxies
    if (state.settings.mode === "domain-based") {
      const activeProxies = state.proxies.filter((proxy) => proxy.active);

      if (activeProxies.length > 0) {
        chrome.contextMenus.create({
          id: "addDomainToProxy",
          title: "Add domain to specific proxy",
          contexts: ["all"],
        });

        activeProxies.forEach((proxy, index) => {
          const title = proxy.name || `${proxy.host}:${proxy.port}`;
          chrome.contextMenus.create({
            id: `addDomainToProxy_${index}`,
            parentId: "addDomainToProxy",
            title: title,
            contexts: ["all"],
          });
        });
      }
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = new URL(tab?.url || "");
  const domain = url.hostname;

  if (info.menuItemId === "addDomain" || info.menuItemId === "removeDomain") {
    await StorageManager.updateState((state) => {
      if (info.menuItemId === "addDomain") {
        // In global mode, switch to domain-based and add to first active proxy
        if (state.settings.mode === "global") {
          state.settings.mode = "domain-based";
        }

        // Find first active proxy or create one
        let targetProxy = state.proxies.find((proxy) => proxy.active);
        if (!targetProxy && state.proxies.length > 0) {
          state.proxies[0].active = true;
          targetProxy = state.proxies[0];
        }

        if (targetProxy && !targetProxy.domains.includes(domain)) {
          targetProxy.domains.push(domain);
        }
      } else {
        // Remove domain from all proxies
        state.proxies.forEach((proxy) => {
          proxy.domains = proxy.domains.filter((d) => d !== domain);
        });
      }
      return state;
    });
  }

  if (info.menuItemId === "addDomainSubDomain") {
    const subdomain = "*." + domain.split(".").slice(-2).join(".");

    await StorageManager.updateState((state) => {
      // Find first active proxy or create one
      let targetProxy = state.proxies.find((proxy) => proxy.active);
      if (!targetProxy && state.proxies.length > 0) {
        state.proxies[0].active = true;
        targetProxy = state.proxies[0];
      }

      if (targetProxy && !targetProxy.domains.includes(subdomain)) {
        targetProxy.domains.push(subdomain);
      }
      return state;
    });
  }

  // Handle domain addition to specific proxy
  if (
    info.menuItemId &&
    info.menuItemId.toString().startsWith("addDomainToProxy_")
  ) {
    const proxyIndex = parseInt(info.menuItemId.toString().split("_")[1]);

    await StorageManager.updateState((state) => {
      const activeProxies = state.proxies.filter((proxy) => proxy.active);
      const targetProxy = activeProxies[proxyIndex];

      if (targetProxy && !targetProxy.domains.includes(domain)) {
        targetProxy.domains.push(domain);
      }
      return state;
    });
  }
});

function updateIcon(isActive: boolean) {
  chrome.action.setIcon({
    path: isActive ? "icon-active-128.png" : "icon-128.png",
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.appState) {
    const newState: AppState = changes.appState.newValue;
    const activeProxies = newState.proxies.filter(
      (proxy: ProxyEntry) => proxy.active
    );

    if (activeProxies.length > 0) {
      setProxySettings(activeProxies, newState.settings);
      updateIcon(true);
    } else {
      chrome.proxy.settings.clear({ scope: "regular" });
      updateIcon(false);
    }

    // Update context menus when state changes
    updateContextMenus(newState);
  }
});

function setProxySettings(
  proxies: ProxyEntry[],
  settings: AppState["settings"]
) {
  let config: chrome.proxy.ProxyConfig;

  if (settings.mode === "global") {
    // In global mode, use only the first active proxy
    const activeProxy = proxies[0];
    config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: activeProxy.host,
          port: parseInt(activeProxy.port, 10),
        },
      },
    };
  } else {
    // In domain-based mode, create PAC script for multiple proxies
    const sortedProxies = [...proxies].sort(
      (a, b) => (a.priority || 0) - (b.priority || 0)
    );

    config = {
      mode: "pac_script",
      pacScript: {
        data: `
          function FindProxyForURL(url, host) {
            var proxies = ${JSON.stringify(
              sortedProxies.map((p) => ({
                host: p.host,
                port: p.port,
                domains: p.domains,
              }))
            )};

            // Check each proxy in priority order
            for (var i = 0; i < proxies.length; i++) {
              var proxy = proxies[i];
              var domains = proxy.domains;

              for (var j = 0; j < domains.length; j++) {
                var domain = domains[j];
                if (domain.startsWith('*.')) {
                  var suffix = domain.substr(1);
                  if (dnsDomainIs(host, suffix) || host.endsWith(suffix)) {
                    return "PROXY " + proxy.host + ":" + proxy.port;
                  }
                } else if (host === domain || host.endsWith('.' + domain)) {
                  return "PROXY " + proxy.host + ":" + proxy.port;
                }
              }
            }
            return "DIRECT";
          }
        `,
      },
    };
  }

  chrome.proxy.settings.set({ value: config, scope: "regular" });

  // Remove existing listeners to avoid duplicates
  if (chrome.webRequest.onAuthRequired.hasListener(authListener)) {
    chrome.webRequest.onAuthRequired.removeListener(authListener);
  }

  // Add auth listener if any proxy has credentials
  const proxiesWithAuth = proxies.filter((p) => p.login && p.password);
  if (proxiesWithAuth.length > 0) {
    chrome.webRequest.onAuthRequired.addListener(
      authListener,
      { urls: ["<all_urls>"] },
      ["asyncBlocking"]
    );
  }
}

// Keep track of authentication attempts to prevent infinite auth loops
let authAttemptCount = 0;
const MAX_AUTH_ATTEMPTS = 3;

async function authListener(
  details: chrome.webRequest.WebAuthenticationChallengeDetails,
  callback?: (response: chrome.webRequest.BlockingResponse) => void
) {
  const appState = await StorageManager.getState();
  const activeProxies = appState.proxies.filter((proxy) => proxy.active);

  // Reset auth counter for new URLs
  if (authAttemptCount > 0 && details.requestId) {
    authAttemptCount = 0;
  }

  // Prevent infinite auth loops
  if (authAttemptCount >= MAX_AUTH_ATTEMPTS) {
    console.error("Max auth attempts reached for proxy", details.url);
    if (callback) callback({});
    return;
  }

  authAttemptCount++;

  // Find appropriate proxy for authentication
  // In global mode, use first proxy, in domain-based mode try to match domain
  let targetProxy = activeProxies[0];

  if (appState.settings.mode === "domain-based" && details.url) {
    const requestUrl = new URL(details.url);
    const host = requestUrl.hostname;

    // Try to find proxy that handles this domain
    for (const proxy of activeProxies) {
      for (const domain of proxy.domains) {
        if (domain.startsWith("*.")) {
          const suffix = domain.substr(1);
          if (host.endsWith(suffix)) {
            targetProxy = proxy;
            break;
          }
        } else if (host === domain || host.endsWith("." + domain)) {
          targetProxy = proxy;
          break;
        }
      }
      if (targetProxy !== activeProxies[0]) break;
    }
  }

  if (targetProxy && targetProxy.login && targetProxy.password && callback) {
    callback({
      authCredentials: {
        username: targetProxy.login,
        password: targetProxy.password,
      },
    });
  } else if (callback) {
    callback({});
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.appState) {
    const newState = changes.appState.newValue;
    console.log("Storage updated:", newState);
  }
});

export {};
