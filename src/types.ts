export interface ProxyEntry {
  active: boolean;
  name?: string;
  host: string;
  port: string;
  login: string;
  password: string;
}

export interface ProxySettings {
  mode: "all" | "selected";
  selectedDomains: string[];
}

export interface AppState {
  proxies: ProxyEntry[];
  settings: ProxySettings;
}
