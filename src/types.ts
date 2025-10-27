export interface ProxyEntry {
  active: boolean;
  name?: string;
  host: string;
  port: string;
  login: string;
  password: string;
  domains: string[]; // новое поле для доменов прокси
  priority?: number; // новое поле для автоматического приоритета по позиции в списке
}

export interface ProxySettings {
  mode: "global" | "domain-based"; // изменено с "all" | "selected"
  // selectedDomains удалено - теперь домены привязаны к каждому прокси
}

export interface AppState {
  proxies: ProxyEntry[];
  settings: ProxySettings;
  overlayState?: OverlayState;
}

export interface OverlayState {
  visible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  expanded: boolean;
}

export interface DomainInfo {
  domain: string;
  proxyId?: string; // ID прокси который используется
  category: DomainCategory;
  requestCount: number;
  lastSeen: number;
  color?: string; // цвет для визуализации
  isWebSocket?: boolean; // флаг для WebSocket соединений
}

export type DomainCategory = "main" | "analytics" | "cdn" | "ads" | "other";

export interface OverlayMessage {
  type:
    | "SHOW_OVERLAY"
    | "HIDE_OVERLAY"
    | "UPDATE_DOMAINS"
    | "ASSIGN_DOMAIN_TO_PROXY";
  data?: any;
}
