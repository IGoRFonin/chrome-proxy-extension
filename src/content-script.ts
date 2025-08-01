import { OverlayMessage, DomainInfo, OverlayState } from "./types";

class DomainOverlayManager {
  private overlay: HTMLElement | null = null;
  private isVisible = false;
  private domains: DomainInfo[] = [];
  private availableProxies: Array<{ id: string; name: string; color: string }> =
    [];
  private overlayState: OverlayState = {
    visible: false,
    position: { x: 20, y: 20 }, // от правого нижнего угла
    size: { width: 400, height: 500 },
    expanded: false,
  };
  private updateTimeout: number | null = null;
  private domainRefreshInterval: number | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Загружаем сохраненное состояние overlay
    this.loadOverlayState();

    // Слушаем сообщения от background script
    chrome.runtime.onMessage.addListener(
      (message: OverlayMessage, sender, sendResponse) => {
        this.handleMessage(message);
        sendResponse({ success: true });
      }
    );

    // Слушаем изменения в storage для синхронизации с popup
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.appState) {
        // Отменяем предыдущее обновление если оно еще не выполнилось
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
        }

        // Добавляем задержку для debounce множественных изменений
        this.updateTimeout = window.setTimeout(async () => {
          // Обновляем список доступных прокси
          await this.loadAvailableProxies();

          // Обновляем домены если overlay видим
          if (this.isVisible) {
            await this.requestCurrentDomains();
          }

          this.updateTimeout = null;
        }, 200);
      }
    });

    // Сначала получаем доступные прокси
    this.loadAvailableProxies();

    // Запрашиваем текущие домены для этой страницы
    this.requestCurrentDomains();
  }

  private async loadOverlayState() {
    try {
      const result = await chrome.storage.local.get(["overlayState"]);
      if (result.overlayState) {
        this.overlayState = { ...this.overlayState, ...result.overlayState };
        if (this.overlayState.visible) {
          this.showOverlay();
        }
      }
    } catch (error) {
      console.error("Failed to load overlay state:", error);
    }
  }

  private async saveOverlayState() {
    try {
      await chrome.storage.local.set({ overlayState: this.overlayState });
    } catch (error) {
      console.error("Failed to save overlay state:", error);
    }
  }

  private handleMessage(message: OverlayMessage) {
    switch (message.type) {
      case "SHOW_OVERLAY":
        this.showOverlay();
        break;
      case "HIDE_OVERLAY":
        this.hideOverlay();
        break;
      case "UPDATE_DOMAINS":
        // УДАЛЕНО: больше не обрабатываем прямые UPDATE_DOMAINS от domainTracker
        // Вместо этого запрашиваем свежие данные с обогащением
        this.requestCurrentDomains();
        break;
      case "ASSIGN_DOMAIN_TO_PROXY":
        this.assignDomainToProxy(message.data.domain, message.data.proxyId);
        break;
    }
  }

  private async loadAvailableProxies() {
    try {
      // Запрашиваем доступные прокси
      const proxiesResponse = await chrome.runtime.sendMessage({
        type: "GET_AVAILABLE_PROXIES",
      });

      if (proxiesResponse?.proxies) {
        this.availableProxies = proxiesResponse.proxies;
      }
    } catch (error) {
      console.error("Failed to load available proxies:", error);
    }
  }

  private async requestCurrentDomains() {
    try {
      // Запрашиваем текущие домены
      const domainsResponse = await chrome.runtime.sendMessage({
        type: "GET_CURRENT_DOMAINS",
      });

      if (domainsResponse?.domains) {
        this.updateDomains(domainsResponse.domains);
      }
    } catch (error) {
      console.error("Failed to request domain data:", error);
    }
  }

  private async showOverlay() {
    // Обновляем данные перед показом
    await this.loadAvailableProxies();
    await this.requestCurrentDomains();

    if (this.overlay) {
      this.overlay.style.display = "block";
      // Восстанавливаем сохраненные размеры
      this.overlay.style.width = `${this.overlayState.size.width}px`;
      this.overlay.style.height = `${this.overlayState.size.height}px`;
      this.updateOverlayContent(); // Обновляем содержимое
    } else {
      this.createOverlay();
    }
    this.isVisible = true;
    this.overlayState.visible = true;
    this.saveOverlayState();

    // Запускаем периодическое обновление доменов
    this.startDomainRefresh();
  }

  private hideOverlay() {
    if (this.overlay) {
      // Сохраняем текущие размеры перед скрытием
      this.overlayState.size.width = this.overlay.offsetWidth;
      this.overlayState.size.height = this.overlay.offsetHeight;

      this.overlay.style.display = "none";
    }
    this.isVisible = false;
    this.overlayState.visible = false;
    this.saveOverlayState();

    // Останавливаем периодическое обновление доменов
    this.stopDomainRefresh();
  }

  private createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "proxy-domain-overlay";
    this.overlay.innerHTML = this.getOverlayHTML();
    this.styleOverlay();
    this.addEventListeners();
    document.body.appendChild(this.overlay);
    this.positionOverlay();
  }

  private getOverlayHTML(): string {
    return `
      <div class="overlay-header">
        <div class="overlay-title">Domains (${this.domains.length})</div>
        <div class="overlay-controls">
          <button class="overlay-btn expand-btn" title="Expand/Collapse">
            ${this.overlayState.expanded ? "−" : "+"}
          </button>
          <button class="overlay-btn close-btn" title="Hide">×</button>
        </div>
      </div>
      <div class="overlay-content ${
        this.overlayState.expanded ? "expanded" : "collapsed"
      }">
        ${this.renderDomains()}
      </div>
      <div class="overlay-resize-handle"></div>
    `;
  }

  private renderDomains(): string {
    if (this.domains.length === 0) {
      return '<div class="no-domains">No domains detected</div>';
    }

    const groupedDomains = this.groupDomainsByCategory();
    let html = "";

    for (const [category, domains] of Object.entries(groupedDomains)) {
      if (domains.length === 0) continue;

      html += `
        <div class="domain-group">
          <div class="domain-group-header" data-category="${category}">
            <span class="group-icon">${this.getCategoryIcon(category)}</span>
            <span class="group-title">${this.getCategoryTitle(category)}</span>
            <span class="group-count">(${domains.length})</span>
            <span class="group-toggle">▼</span>
          </div>
          <div class="domain-group-content">
            ${this.renderCategoryContent(domains)}
          </div>
        </div>
      `;
    }

    return html;
  }

  private groupDomainsByCategory(): Record<string, DomainInfo[]> {
    const groups: Record<string, DomainInfo[]> = {
      main: [],
      analytics: [],
      cdn: [],
      ads: [],
      other: [],
    };

    this.domains.forEach((domain) => {
      groups[domain.category].push(domain);
    });

    return groups;
  }

  private getBaseDomain(domain: string): string {
    const parts = domain.split(".");
    if (parts.length >= 2) {
      // Получаем последние 2 части для основного домена (example.com)
      return parts.slice(-2).join(".");
    }
    return domain;
  }

  private groupDomainsByBase(
    domains: DomainInfo[]
  ): Record<string, DomainInfo[]> {
    const groups: Record<string, DomainInfo[]> = {};

    domains.forEach((domain) => {
      const baseDomain = this.getBaseDomain(domain.domain);
      if (!groups[baseDomain]) {
        groups[baseDomain] = [];
      }
      groups[baseDomain].push(domain);
    });

    return groups;
  }

  private shouldGroupDomains(domains: DomainInfo[]): boolean {
    // Группируем только если есть больше 2 поддоменов одного основного домена
    const baseGroups = this.groupDomainsByBase(domains);
    return Object.values(baseGroups).some((group) => group.length > 1);
  }

  private renderCategoryContent(domains: DomainInfo[]): string {
    if (!this.shouldGroupDomains(domains)) {
      // Если нет смысла группировать, показываем как обычно
      return domains.map((domain) => this.renderDomain(domain)).join("");
    }

    // Группируем по основному домену
    const baseGroups = this.groupDomainsByBase(domains);
    let html = "";

    for (const [baseDomain, domainList] of Object.entries(baseGroups)) {
      if (domainList.length === 1) {
        // Один домен - показываем как обычно
        html += this.renderDomain(domainList[0]);
      } else {
        // Несколько поддоменов - создаем подгруппу
        html += `
          <div class="domain-subgroup">
            <div class="domain-subgroup-header">
              <span class="subgroup-icon">🔗</span>
              <span class="subgroup-title">*.${baseDomain}</span>
              <span class="subgroup-count">(${domainList.length})</span>
              <div class="subgroup-actions">
                <button class="add-wildcard-btn" data-domain="${baseDomain}" title="Add *.${baseDomain} to proxy">
                  + Add *.${baseDomain}
                </button>
              </div>
              <span class="subgroup-toggle">▼</span>
            </div>
            <div class="domain-subgroup-content">
              ${domainList.map((domain) => this.renderDomain(domain)).join("")}
            </div>
          </div>
        `;
      }
    }

    return html;
  }

  private renderDomain(domain: DomainInfo): string {
    const proxyIndicator = domain.proxyId
      ? `<span class="proxy-indicator" style="background-color: ${
          domain.color || "#666"
        }" title="Proxy: ${domain.proxyId}"></span>`
      : `<span class="proxy-indicator direct" title="Direct connection">D</span>`;

    return `
      <div class="domain-item" data-domain="${domain.domain}">
        ${proxyIndicator}
        <span class="domain-name">${domain.domain}</span>
        <span class="request-count">${domain.requestCount}</span>
        <div class="domain-actions">
          <select class="proxy-selector">
            ${this.getAllProxyOptions(domain.proxyId)}
          </select>
        </div>
      </div>
    `;
  }

  private getAllProxyOptions(currentProxyId?: string): string {
    let options = "";

    // Добавляем опцию Direct
    const isDirectSelected = !currentProxyId ? "selected" : "";
    options += `<option value="direct" ${isDirectSelected}>Direct</option>`;

    // Добавляем остальные прокси
    this.availableProxies.forEach((proxy) => {
      const selected = currentProxyId === proxy.id ? "selected" : "";
      options += `<option value="${proxy.id}" ${selected}>${proxy.name}</option>`;
    });

    return options;
  }

  private getProxyOptions(currentProxyId?: string): string {
    let options = "";

    this.availableProxies.forEach((proxy) => {
      const selected = currentProxyId === proxy.id ? "selected" : "";
      options += `<option value="${proxy.id}" ${selected}>${proxy.name}</option>`;
    });

    return options;
  }

  private getCategoryIcon(category: string): string {
    const icons = {
      main: "🌐",
      analytics: "📊",
      cdn: "☁️",
      ads: "📢",
      other: "❓",
    };
    return icons[category as keyof typeof icons] || "❓";
  }

  private getCategoryTitle(category: string): string {
    const titles = {
      main: "Main Content",
      analytics: "Analytics",
      cdn: "CDN",
      ads: "Advertising",
      other: "Other",
    };
    return titles[category as keyof typeof titles] || "Other";
  }

  private styleOverlay() {
    if (!this.overlay) return;

    const styles = `
      #proxy-domain-overlay {
        position: fixed;
        z-index: 2147483647;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        backdrop-filter: blur(10px);
        min-width: 350px;
        max-width: 600px;
        resize: both;
        overflow: hidden;
      }

      .domain-subgroup {
        margin-left: 15px;
        border-left: 2px solid #e0e0e0;
        padding-left: 10px;
        margin-bottom: 5px;
      }

      .domain-subgroup-header {
        display: flex;
        align-items: center;
        padding: 6px 10px;
        cursor: pointer;
        background: rgba(0, 0, 100, 0.02);
        border-radius: 4px;
        margin-bottom: 5px;
        transition: background 0.2s ease;
      }

      .domain-subgroup-header:hover {
        background: rgba(0, 0, 100, 0.05);
      }

      .subgroup-icon {
        margin-right: 8px;
        font-size: 12px;
      }

      .subgroup-title {
        flex: 1;
        font-weight: 500;
        color: #555;
        font-size: 13px;
      }

      .subgroup-count {
        color: #777;
        font-size: 11px;
        margin-right: 10px;
      }

      .subgroup-actions {
        margin-right: 10px;
      }

      .add-wildcard-btn {
        font-size: 10px;
        padding: 2px 6px;
        background: #007cba;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .add-wildcard-btn:hover {
        background: #005a87;
      }

      .subgroup-toggle {
        color: #999;
        font-size: 10px;
        transition: transform 0.2s ease;
      }

      .domain-subgroup.collapsed .subgroup-toggle {
        transform: rotate(-90deg);
      }

      .domain-subgroup-content {
        display: block;
      }

      .domain-subgroup.collapsed .domain-subgroup-content {
        display: none;
      }

      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: rgba(0, 0, 0, 0.03);
        border-bottom: 1px solid #eee;
        cursor: move;
        user-select: none;
      }

      .overlay-title {
        font-weight: 600;
        color: #333;
        font-size: 15px;
      }

      .overlay-controls {
        display: flex;
        gap: 4px;
      }

      .overlay-btn {
        width: 20px;
        height: 20px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 14px;
        font-weight: bold;
      }

      .overlay-btn:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .overlay-content {
        max-height: 500px;
        overflow-y: auto;
        transition: all 0.2s ease;
      }

      .overlay-content.collapsed {
        display: none;
      }

      .overlay-content.expanded {
        display: block;
      }

      .no-domains {
        padding: 20px;
        text-align: center;
        color: #666;
        font-style: italic;
      }

      .domain-group {
        border-bottom: 1px solid #f0f0f0;
      }

      .domain-group:last-child {
        border-bottom: none;
      }

      .domain-group-header {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        cursor: pointer;
        background: rgba(0, 0, 0, 0.02);
        transition: background 0.2s ease;
      }

      .domain-group-header:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .group-icon {
        margin-right: 8px;
        font-size: 14px;
      }

      .group-title {
        flex: 1;
        font-weight: 500;
        color: #444;
      }

      .group-count {
        color: #666;
        font-size: 11px;
        margin-right: 8px;
      }

      .group-toggle {
        color: #999;
        font-size: 10px;
        transition: transform 0.2s ease;
      }

      .domain-group.collapsed .group-toggle {
        transform: rotate(-90deg);
      }

      .domain-group-content {
        display: block;
      }

      .domain-group.collapsed .domain-group-content {
        display: none;
      }

      .domain-item {
        display: flex;
        align-items: center;
        padding: 8px 15px;
        border-bottom: 1px solid #f5f5f5;
        transition: background 0.2s ease;
      }

      .domain-item:hover {
        background: rgba(0, 0, 0, 0.02);
      }

      .domain-item:last-child {
        border-bottom: none;
      }

      .proxy-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        font-weight: bold;
        color: white;
      }

      .proxy-indicator.direct {
        background: #999;
        color: white;
      }

      .domain-name {
        flex: 1;
        color: #333;
        margin-right: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .request-count {
        color: #666;
        font-size: 10px;
        margin-right: 8px;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 20px;
        text-align: center;
      }

      .domain-actions {
        flex-shrink: 0;
      }

      .proxy-selector {
        font-size: 10px;
        padding: 2px 4px;
        border: 1px solid #ddd;
        border-radius: 3px;
        background: white;
        color: #333;
        cursor: pointer;
      }

      .overlay-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        cursor: se-resize;
        background: linear-gradient(-45deg, transparent 30%, #ddd 30%, #ddd 40%, transparent 40%, transparent 60%, #ddd 60%, #ddd 70%, transparent 70%);
      }

      @media (prefers-color-scheme: dark) {
        #proxy-domain-overlay {
          background: rgba(40, 40, 40, 0.95);
          border-color: #555;
          color: #e0e0e0;
        }

        .overlay-header {
          background: rgba(255, 255, 255, 0.05);
          border-bottom-color: #555;
        }

        .overlay-title {
          color: #e0e0e0;
        }

        .overlay-btn {
          color: #ccc;
        }

        .overlay-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .domain-group-header {
          background: rgba(255, 255, 255, 0.02);
        }

        .domain-group-header:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .domain-name {
          color: #e0e0e0;
        }

        .proxy-selector {
          background: #333;
          border-color: #555;
          color: #e0e0e0;
        }
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  private addEventListeners() {
    if (!this.overlay) return;

    // Закрытие overlay
    const closeBtn = this.overlay.querySelector(".close-btn");
    closeBtn?.addEventListener("click", () => this.hideOverlay());

    // Разворачивание/сворачивание
    const expandBtn = this.overlay.querySelector(".expand-btn");
    expandBtn?.addEventListener("click", () => this.toggleExpanded());

    // Перетаскивание
    this.makeDraggable();

    // Группировка доменов
    this.addGroupToggleListeners();

    // Изменение прокси для домена
    this.addProxyChangeListeners();
  }

  private toggleExpanded() {
    this.overlayState.expanded = !this.overlayState.expanded;
    this.saveOverlayState();
    this.updateOverlayContent();
  }

  private updateOverlayContent() {
    if (!this.overlay) return;

    const content = this.overlay.querySelector(".overlay-content");
    const expandBtn = this.overlay.querySelector(".expand-btn");

    if (content && expandBtn) {
      content.className = `overlay-content ${
        this.overlayState.expanded ? "expanded" : "collapsed"
      }`;
      expandBtn.textContent = this.overlayState.expanded ? "−" : "+";
      content.innerHTML = this.renderDomains();

      // Переподключаем листенеры после обновления содержимого
      this.addGroupToggleListeners();
      this.addSubgroupToggleListeners();
      this.addWildcardButtonListeners();
      this.addProxyChangeListeners();
    }
  }

  private makeDraggable() {
    if (!this.overlay) return;

    const header = this.overlay.querySelector(".overlay-header") as HTMLElement;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startPosX = 0;
    let startPosY = 0;

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPosX = this.overlayState.position.x;
      startPosY = this.overlayState.position.y;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      e.preventDefault();

      // Рассчитываем дельту движения мыши
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Для позиционирования от правого нижнего угла:
      // - движение мыши вправо = уменьшение right (больше места слева)
      // - движение мыши вниз = уменьшение bottom (больше места сверху)
      this.overlayState.position = {
        x: Math.max(0, startPosX - deltaX), // инвертируем X
        y: Math.max(0, startPosY - deltaY), // инвертируем Y
      };

      this.positionOverlay();
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.saveOverlayState();
      }
    });
  }

  private positionOverlay() {
    if (!this.overlay) return;

    // Позиционируем от правого нижнего угла
    this.overlay.style.right = `${this.overlayState.position.x}px`;
    this.overlay.style.bottom = `${this.overlayState.position.y}px`;

    // Размеры устанавливаем только если они не заданы пользователем
    const currentWidth = this.overlay.offsetWidth;
    const currentHeight = this.overlay.offsetHeight;

    if (currentWidth > 0 && currentHeight > 0) {
      // Сохраняем текущие размеры в состоянии
      this.overlayState.size.width = currentWidth;
      this.overlayState.size.height = currentHeight;
    } else {
      // Только при первой инициализации устанавливаем дефолтные размеры
      this.overlay.style.width = `${this.overlayState.size.width}px`;
      this.overlay.style.height = `${this.overlayState.size.height}px`;
    }
  }

  private addGroupToggleListeners() {
    if (!this.overlay) return;

    const groupHeaders = this.overlay.querySelectorAll(".domain-group-header");
    groupHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = (e.currentTarget as HTMLElement).closest(".domain-group");
        group?.classList.toggle("collapsed");
      });
    });
  }

  private addSubgroupToggleListeners() {
    if (!this.overlay) return;

    const subgroupHeaders = this.overlay.querySelectorAll(
      ".domain-subgroup-header"
    );
    subgroupHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        // Не обрабатываем клик если это кнопка
        if ((e.target as HTMLElement).classList.contains("add-wildcard-btn")) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        const subgroup = (e.currentTarget as HTMLElement).closest(
          ".domain-subgroup"
        );
        subgroup?.classList.toggle("collapsed");
      });
    });
  }

  private addWildcardButtonListeners() {
    if (!this.overlay) return;

    const wildcardBtns = this.overlay.querySelectorAll(".add-wildcard-btn");
    wildcardBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const baseDomain = (e.target as HTMLElement).getAttribute(
          "data-domain"
        );
        if (baseDomain) {
          this.showWildcardProxyModal(baseDomain);
        }
      });
    });
  }

  private addProxyChangeListeners() {
    if (!this.overlay) return;

    const selectors = this.overlay.querySelectorAll(".proxy-selector");
    selectors.forEach((selector) => {
      selector.addEventListener("change", (e) => {
        const select = e.target as HTMLSelectElement;
        const domainItem = select.closest(".domain-item");
        const domain = domainItem?.getAttribute("data-domain");

        if (domain) {
          this.assignDomainToProxy(domain, select.value);
        }
      });
    });
  }

  private showWildcardProxyModal(baseDomain: string) {
    if (!this.availableProxies.length) {
      alert("No active proxies available");
      return;
    }

    // Создаем простой modal для выбора прокси
    const modal = document.createElement("div");
    modal.className = "wildcard-modal";
    modal.innerHTML = `
      <div class="wildcard-modal-content">
        <h3>Add *.${baseDomain} to proxy</h3>
        <select class="wildcard-proxy-selector">
          ${this.availableProxies
            .map(
              (proxy) => `<option value="${proxy.id}">${proxy.name}</option>`
            )
            .join("")}
        </select>
        <div class="wildcard-modal-buttons">
          <button class="wildcard-confirm-btn">Add</button>
          <button class="wildcard-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    // Стили для modal
    const modalStyles = `
      .wildcard-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483648;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .wildcard-modal-content {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        min-width: 300px;
      }
      .wildcard-modal-content h3 {
        margin: 0 0 15px 0;
        font-size: 16px;
      }
      .wildcard-proxy-selector {
        width: 100%;
        padding: 8px;
        margin-bottom: 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .wildcard-modal-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .wildcard-modal-buttons button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .wildcard-confirm-btn {
        background: #007cba;
        color: white;
      }
      .wildcard-cancel-btn {
        background: #f0f0f0;
        color: #333;
      }
    `;

    // Добавляем стили
    const styleSheet = document.createElement("style");
    styleSheet.textContent = modalStyles;
    document.head.appendChild(styleSheet);

    document.body.appendChild(modal);

    // Обработчики кнопок
    const confirmBtn = modal.querySelector(".wildcard-confirm-btn");
    const cancelBtn = modal.querySelector(".wildcard-cancel-btn");
    const selector = modal.querySelector(
      ".wildcard-proxy-selector"
    ) as HTMLSelectElement;

    confirmBtn?.addEventListener("click", () => {
      const selectedProxyId = selector.value;
      this.assignDomainToProxy(`*.${baseDomain}`, selectedProxyId);
      document.body.removeChild(modal);
      document.head.removeChild(styleSheet);
    });

    cancelBtn?.addEventListener("click", () => {
      document.body.removeChild(modal);
      document.head.removeChild(styleSheet);
    });

    // Закрытие по клику вне modal
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(styleSheet);
      }
    });
  }

  private startDomainRefresh() {
    // Останавливаем предыдущий интервал если есть
    this.stopDomainRefresh();

    // Обновляем домены каждые 3 секунды когда overlay видим
    this.domainRefreshInterval = window.setInterval(() => {
      if (this.isVisible) {
        this.requestCurrentDomains();
      }
    }, 3000);
  }

  private stopDomainRefresh() {
    if (this.domainRefreshInterval) {
      clearInterval(this.domainRefreshInterval);
      this.domainRefreshInterval = null;
    }
  }

  private updateDomains(domains: DomainInfo[]) {
    this.domains = domains;
    if (this.isVisible && this.overlay) {
      this.updateOverlayContent();
    }

    // Обновляем заголовок с количеством доменов
    if (this.overlay) {
      const title = this.overlay.querySelector(".overlay-title");
      if (title) {
        title.textContent = `Domains (${this.domains.length})`;
      }
    }
  }

  private async assignDomainToProxy(domain: string, proxyId: string) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASSIGN_DOMAIN_TO_PROXY",
        data: { domain, proxyId },
      });

      if (response?.success) {
        // Обновляем информацию о домене
        const domainInfo = this.domains.find((d) => d.domain === domain);
        if (domainInfo) {
          domainInfo.proxyId = proxyId === "direct" ? undefined : proxyId;
          const proxyInfo = this.availableProxies.find((p) => p.id === proxyId);
          domainInfo.color = proxyInfo?.color;
          this.updateOverlayContent();
        }
      }
    } catch (error) {
      console.error("Failed to assign domain to proxy:", error);
    }
  }
}

// Инициализируем overlay manager
const overlayManager = new DomainOverlayManager();

export {};
