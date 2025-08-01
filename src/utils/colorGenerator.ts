export class ColorGenerator {
  private static colors: Map<string, string> = new Map();

  // Предопределенные мягкие цвета для прокси
  private static readonly PREDEFINED_COLORS = [
    "#7C3AED", // Purple
    "#059669", // Emerald
    "#DC2626", // Red
    "#2563EB", // Blue
    "#CA8A04", // Yellow
    "#9333EA", // Violet
    "#16A34A", // Green
    "#EA580C", // Orange
    "#0891B2", // Cyan
    "#BE185D", // Pink
    "#4338CA", // Indigo
    "#65A30D", // Lime
  ];

  // Дополнительные приглушенные цвета
  private static readonly SOFT_COLORS = [
    "#64748B", // Slate
    "#6B7280", // Gray
    "#78716C", // Stone
    "#EF4444", // Red-400
    "#F97316", // Orange-500
    "#EAB308", // Yellow-500
    "#22C55E", // Green-500
    "#06B6D4", // Cyan-500
    "#3B82F6", // Blue-500
    "#8B5CF6", // Violet-500
    "#EC4899", // Pink-500
    "#F43F5E", // Rose-500
  ];

  /**
   * Генерирует или получает сохраненный цвет для прокси
   */
  public static getColorForProxy(proxyId: string): string {
    if (this.colors.has(proxyId)) {
      return this.colors.get(proxyId)!;
    }

    const color = this.generateColorForProxy(proxyId);
    this.colors.set(proxyId, color);
    this.saveColors();
    return color;
  }

  /**
   * Генерирует цвет на основе ID прокси
   */
  private static generateColorForProxy(proxyId: string): string {
    // Используем hash для получения стабильного индекса
    const hash = this.simpleHash(proxyId);
    const allColors = [...this.PREDEFINED_COLORS, ...this.SOFT_COLORS];
    const colorIndex = Math.abs(hash) % allColors.length;

    return allColors[colorIndex];
  }

  /**
   * Простая hash функция для строки
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Загружаем сохраненные цвета из storage
   */
  public static async loadColors(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(["proxyColors"]);
      if (result.proxyColors) {
        this.colors = new Map(Object.entries(result.proxyColors));
      }
    } catch (error) {
      console.error("Failed to load proxy colors:", error);
    }
  }

  /**
   * Сохраняем цвета в storage
   */
  private static async saveColors(): Promise<void> {
    try {
      const colorObject = Object.fromEntries(this.colors);
      await chrome.storage.local.set({ proxyColors: colorObject });
    } catch (error) {
      console.error("Failed to save proxy colors:", error);
    }
  }

  /**
   * Получаем все сохраненные цвета
   */
  public static getAllColors(): Map<string, string> {
    return new Map(this.colors);
  }

  /**
   * Устанавливаем кастомный цвет для прокси
   */
  public static setColorForProxy(proxyId: string, color: string): void {
    this.colors.set(proxyId, color);
    this.saveColors();
  }

  /**
   * Удаляем цвет для прокси
   */
  public static removeColorForProxy(proxyId: string): void {
    this.colors.delete(proxyId);
    this.saveColors();
  }

  /**
   * Проверяем, является ли цвет светлым (для выбора цвета текста)
   */
  public static isLightColor(color: string): boolean {
    // Удаляем # если есть
    const hex = color.replace("#", "");

    // Конвертируем в RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Рассчитываем относительную яркость
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 155;
  }

  /**
   * Генерирует контрастный цвет текста для фона
   */
  public static getContrastTextColor(backgroundColor: string): string {
    return this.isLightColor(backgroundColor) ? "#000000" : "#FFFFFF";
  }

  /**
   * Генерирует CSS переменные для всех цветов прокси
   */
  public static generateCSSVariables(): string {
    let css = ":root {\n";

    this.colors.forEach((color, proxyId) => {
      const safeId = proxyId.replace(/[^a-zA-Z0-9-_]/g, "-");
      css += `  --proxy-${safeId}-color: ${color};\n`;
      css += `  --proxy-${safeId}-text: ${this.getContrastTextColor(color)};\n`;
    });

    css += "}\n";
    return css;
  }

  /**
   * Инициализация - загружаем сохраненные цвета
   */
  public static async init(): Promise<void> {
    await this.loadColors();
  }
}
