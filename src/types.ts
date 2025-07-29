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
}
