import { StorageManager } from "./utils/storage";
import { domainTracker, DomainTracker } from "./utils/domainTracker";
import { ColorGenerator } from "./utils/colorGenerator";
import type { AppState, ProxyEntry, OverlayMessage, DomainInfo } from "./types";

chrome.runtime.onInstalled.addListener(async () => {
  const state = await StorageManager.getState();

  if (!state.proxies.length) {
    await StorageManager.setState({
      proxies: [],
      settings: { mode: "global" },
    });
  }

  // Initialize color generator
  await ColorGenerator.init();

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

  // Add overlay control menu items
  chrome.contextMenus.create({
    id: "separator1",
    type: "separator",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "showOverlay",
    title: "Show Domain Overlay",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "hideOverlay",
    title: "Hide Domain Overlay",
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

  // Initialize color generator
  await ColorGenerator.init();
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

    // Add overlay control menu items
    chrome.contextMenus.create({
      id: "separator1",
      type: "separator",
      contexts: ["all"],
    });

    chrome.contextMenus.create({
      id: "showOverlay",
      title: "Show Domain Overlay",
      contexts: ["all"],
    });

    chrome.contextMenus.create({
      id: "hideOverlay",
      title: "Hide Domain Overlay",
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

  // Handle overlay controls
  if (info.menuItemId === "showOverlay") {
    console.log("🎯 Context menu: Show overlay clicked");
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "SHOW_OVERLAY",
        } as OverlayMessage)
        .catch((error) => {
          console.error("Failed to send message to content script:", error);
        });
    }
    return;
  }

  if (info.menuItemId === "hideOverlay") {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "HIDE_OVERLAY",
      } as OverlayMessage);
    }
    return;
  }

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

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleContentScriptMessage(message, sender, sendResponse);
  return true; // Keep the message channel open for async responses
});

async function handleContentScriptMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  try {
    switch (message.type) {
      case "GET_CURRENT_DOMAINS":
        if (sender.tab?.id) {
          console.log(
            `🔍 GET_CURRENT_DOMAINS request for tab ${sender.tab.id}`
          );
          const domains = domainTracker.getDomainsForTab(sender.tab.id);
          console.log(
            `📊 Raw domains from tracker:`,
            domains.map((d) => ({ domain: d.domain, category: d.category }))
          );
          const domainsWithColors = await enrichDomainsWithProxyInfo(domains);
          console.log(
            `📊 Enriched domains:`,
            domainsWithColors.map((d) => ({
              domain: d.domain,
              proxyId: d.proxyId,
            }))
          );
          sendResponse({ domains: domainsWithColors });
        }
        break;

      case "ASSIGN_DOMAIN_TO_PROXY":
        await handleDomainProxyAssignment(
          message.data.domain,
          message.data.proxyId
        );
        sendResponse({ success: true });
        break;

      case "GET_AVAILABLE_PROXIES":
        const state = await StorageManager.getState();
        const availableProxies = state.proxies
          .filter((proxy) => proxy.active)
          .map((proxy) => ({
            id: generateProxyId(proxy),
            name: proxy.name || `${proxy.host}:${proxy.port}`,
            color: ColorGenerator.getColorForProxy(generateProxyId(proxy)),
          }));
        sendResponse({ proxies: availableProxies });
        break;

      default:
        sendResponse({ error: "Unknown message type" });
    }
  } catch (error) {
    console.error("Error handling content script message:", error);
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function enrichDomainsWithProxyInfo(
  domains: DomainInfo[]
): Promise<DomainInfo[]> {
  console.log(`🎨 Starting to enrich ${domains.length} domains...`);

  const state = await StorageManager.getState();

  console.log("🎨 Enriching domains with proxy info. Current state:", {
    mode: state.settings.mode,
    totalProxies: state.proxies.length,
    activeProxies: state.proxies.filter((p) => p.active).length,
    allProxies: state.proxies.map((p) => ({
      id: generateProxyId(p),
      active: p.active,
      domains: p.domains,
      name: p.name,
    })),
    proxiesWithDomains: state.proxies
      .filter((p) => p.active && p.domains.length > 0)
      .map((p) => ({
        id: generateProxyId(p),
        domains: p.domains,
      })),
  });

  if (state.proxies.length === 0) {
    console.warn("⚠️ No proxies found in state!");
  }

  if (state.proxies.filter((p) => p.active).length === 0) {
    console.warn("⚠️ No active proxies found!");
  }

  return domains.map((domain) => {
    console.log(`🔍 Processing domain: ${domain.domain}`);

    // Определяем какой прокси используется для этого домена
    const proxyId = findProxyForDomain(domain.domain, state);
    const color = proxyId
      ? ColorGenerator.getColorForProxy(proxyId)
      : undefined;

    console.log(`🎨 Domain ${domain.domain} → Proxy: ${proxyId || "DIRECT"}`);

    return {
      ...domain,
      proxyId,
      color,
    };
  });
}

function findProxyForDomain(
  domain: string,
  state: AppState
): string | undefined {
  console.log(
    `🔍 Finding proxy for domain: ${domain}, mode: ${state.settings.mode}`
  );

  if (state.settings.mode === "global") {
    const activeProxy = state.proxies.find((proxy) => proxy.active);
    const result = activeProxy ? generateProxyId(activeProxy) : undefined;
    console.log(`📋 Global mode result: ${result}`);
    return result;
  } else {
    // Domain-based mode
    console.log(
      `📋 Active proxies: ${state.proxies.filter((p) => p.active).length}`
    );

    for (const proxy of state.proxies) {
      if (!proxy.active) continue;

      console.log(
        `🔎 Checking proxy ${generateProxyId(proxy)} with domains:`,
        proxy.domains
      );

      for (const proxyDomain of proxy.domains) {
        if (proxyDomain.startsWith("*.")) {
          const suffix = proxyDomain.substr(1);
          if (domain.endsWith(suffix)) {
            const result = generateProxyId(proxy);
            console.log(
              `✅ Match found (wildcard): ${domain} matches ${proxyDomain} → ${result}`
            );
            return result;
          }
        } else if (
          domain === proxyDomain ||
          domain.endsWith("." + proxyDomain)
        ) {
          const result = generateProxyId(proxy);
          console.log(
            `✅ Match found (exact): ${domain} matches ${proxyDomain} → ${result}`
          );
          return result;
        }
      }
    }
  }

  console.log(`❌ No proxy found for ${domain} → DIRECT`);
  return undefined; // DIRECT connection
}

function generateProxyId(proxy: ProxyEntry): string {
  return `${proxy.host}:${proxy.port}`;
}

async function handleDomainProxyAssignment(domain: string, proxyId: string) {
  await StorageManager.updateState((state) => {
    if (proxyId === "direct") {
      // Remove domain from all proxies
      state.proxies.forEach((proxy) => {
        proxy.domains = proxy.domains.filter((d) => d !== domain);
      });
    } else {
      // Find target proxy and assign domain
      const targetProxy = state.proxies.find(
        (proxy) => generateProxyId(proxy) === proxyId && proxy.active
      );

      if (targetProxy) {
        // Remove domain from other proxies first
        state.proxies.forEach((proxy) => {
          proxy.domains = proxy.domains.filter((d) => d !== domain);
        });

        // Add to target proxy if not already there
        if (!targetProxy.domains.includes(domain)) {
          targetProxy.domains.push(domain);
        }

        // Switch to domain-based mode if in global mode
        if (state.settings.mode === "global") {
          state.settings.mode = "domain-based";
        }
      }
    }

    return state;
  });

  // Update domain tracker
  domainTracker.updateDomainProxy(domain, proxyId);
}

// Clean up domains when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  domainTracker.clearTabDomains(tabId);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.appState) {
    const newState = changes.appState.newValue;
    console.log("Storage updated:", newState);
  }
});

export {};
