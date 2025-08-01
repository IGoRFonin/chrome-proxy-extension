import { DomainInfo, DomainCategory } from "../types";

export class DomainTracker {
  private static readonly ANALYTICS_DOMAINS = [
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.com",
    "doubleclick.net",
    "google.com/analytics",
    "hotjar.com",
    "mixpanel.com",
    "segment.com",
    "amplitude.com",
    "fullstory.com",
    "logrocket.com",
    "yandex.ru/metrika",
    "criteo.com",
    "bing.com",
    "linkedin.com/px",
    "twitter.com/i",
    "pinterest.com/ct",
    "reddit.com/api",
    "outbrain.com",
    "taboola.com",
    "sharethrough.com",
    "adsystem.com",
  ];

  private static readonly CDN_DOMAINS = [
    "cloudflare.com",
    "amazonaws.com",
    "azureedge.net",
    "fastly.com",
    "jsdelivr.net",
    "unpkg.com",
    "cdnjs.cloudflare.com",
    "maxcdn.com",
    "bootstrapcdn.com",
    "googleapis.com",
    "gstatic.com",
    "fontawesome.com",
    "typekit.net",
    "akamaihd.net",
    "msecnd.net",
    "rackcdn.com",
    "keycdn.com",
  ];

  private static readonly AD_DOMAINS = [
    "googlesyndication.com",
    "googleadservices.com",
    "facebook.com/tr",
    "amazon-adsystem.com",
    "adsystem.com",
    "ads.yahoo.com",
    "bing.com/ads",
    "outbrain.com",
    "taboola.com",
    "revcontent.com",
    "mgid.com",
    "content.ad",
    "yandex.ru/ads",
    "criteo.com",
    "adsrvr.org",
    "adnxs.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "contextweb.com",
    "adsystem.com",
  ];

  private domains: Map<string, DomainInfo> = new Map();
  private tabDomains: Map<number, Set<string>> = new Map();

  constructor() {
    this.setupWebRequestListener();
  }

  private setupWebRequestListener() {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequest(details),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );

    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleRequestCompleted(details),
      { urls: ["<all_urls>"] }
    );
  }

  private handleRequest(details: chrome.webRequest.WebRequestBodyDetails) {
    if (details.tabId <= 0) return; // Skip extension requests

    const url = new URL(details.url);
    const domain = url.hostname;

    this.trackDomain(domain, details.tabId);
  }

  private handleRequestCompleted(
    details: chrome.webRequest.WebResponseCacheDetails
  ) {
    if (details.tabId <= 0) return;

    const url = new URL(details.url);
    const domain = url.hostname;

    // Update request count
    const domainInfo = this.domains.get(domain);
    if (domainInfo) {
      domainInfo.requestCount++;
      domainInfo.lastSeen = Date.now();
    }

    // НЕ отправляем автоматические обновления - content script сам запросит данные
  }

  private trackDomain(domain: string, tabId: number) {
    // Пропускаем локальные домены и IP адреса
    if (this.isLocalDomain(domain)) return;

    // Добавляем домен к вкладке
    if (!this.tabDomains.has(tabId)) {
      this.tabDomains.set(tabId, new Set());
    }
    this.tabDomains.get(tabId)!.add(domain);

    // Создаем или обновляем информацию о домене
    if (!this.domains.has(domain)) {
      const domainInfo: DomainInfo = {
        domain,
        category: this.categorizeDomain(domain),
        requestCount: 1,
        lastSeen: Date.now(),
      };
      this.domains.set(domain, domainInfo);
    } else {
      const domainInfo = this.domains.get(domain)!;
      domainInfo.requestCount++;
      domainInfo.lastSeen = Date.now();
    }

    // НЕ отправляем автоматические обновления в content script
    // Content script сам запросит данные через GET_CURRENT_DOMAINS когда нужно
  }

  private isLocalDomain(domain: string): boolean {
    return (
      domain === "localhost" ||
      domain.startsWith("127.") ||
      domain.startsWith("192.168.") ||
      domain.startsWith("10.") ||
      domain.startsWith("172.16.") ||
      domain.includes("local") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(domain) // IP addresses
    );
  }

  private categorizeDomain(domain: string): DomainCategory {
    const lowerDomain = domain.toLowerCase();

    // Проверяем аналитику
    if (
      DomainTracker.ANALYTICS_DOMAINS.some(
        (ad: string) => lowerDomain.includes(ad) || ad.includes(lowerDomain)
      )
    ) {
      return "analytics";
    }

    // Проверяем CDN
    if (
      DomainTracker.CDN_DOMAINS.some(
        (cd: string) => lowerDomain.includes(cd) || cd.includes(lowerDomain)
      )
    ) {
      return "cdn";
    }

    // Проверяем рекламу
    if (
      DomainTracker.AD_DOMAINS.some(
        (ad: string) => lowerDomain.includes(ad) || ad.includes(lowerDomain)
      )
    ) {
      return "ads";
    }

    // Дополнительные эвристики
    if (
      lowerDomain.includes("ads") ||
      lowerDomain.includes("ad.") ||
      lowerDomain.includes("doubleclick") ||
      lowerDomain.includes("googlesyndication")
    ) {
      return "ads";
    }

    if (
      lowerDomain.includes("cdn") ||
      lowerDomain.includes("static") ||
      lowerDomain.includes("assets") ||
      lowerDomain.includes("media")
    ) {
      return "cdn";
    }

    if (
      lowerDomain.includes("analytics") ||
      lowerDomain.includes("tracking") ||
      lowerDomain.includes("metrics") ||
      lowerDomain.includes("stats")
    ) {
      return "analytics";
    }

    // По умолчанию - основной контент
    return "main";
  }

  // УДАЛЕНО: notifyContentScript больше не нужно
  // Content script сам запрашивает обновления через GET_CURRENT_DOMAINS

  public getDomainsForTab(tabId: number): DomainInfo[] {
    const tabDomainSet = this.tabDomains.get(tabId);
    if (!tabDomainSet) return [];

    return Array.from(tabDomainSet)
      .map((domain) => this.domains.get(domain))
      .filter(
        (domainInfo): domainInfo is DomainInfo => domainInfo !== undefined
      )
      .sort((a, b) => {
        // Сортируем по категории, затем по количеству запросов
        if (a.category !== b.category) {
          const categoryOrder = {
            main: 0,
            cdn: 1,
            analytics: 2,
            ads: 3,
            other: 4,
          };
          return categoryOrder[a.category] - categoryOrder[b.category];
        }
        return b.requestCount - a.requestCount;
      });
  }

  public clearTabDomains(tabId: number) {
    this.tabDomains.delete(tabId);
  }

  public getAllDomains(): DomainInfo[] {
    return Array.from(this.domains.values());
  }

  public getDomainInfo(domain: string): DomainInfo | undefined {
    return this.domains.get(domain);
  }

  public updateDomainProxy(domain: string, proxyId: string) {
    const domainInfo = this.domains.get(domain);
    if (domainInfo) {
      domainInfo.proxyId = proxyId === "direct" ? undefined : proxyId;
    }
  }
}

// Cleanup when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Will be called from background script
});

export const domainTracker = new DomainTracker();
