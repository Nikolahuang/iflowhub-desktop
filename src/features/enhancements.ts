/**
 * 综合功能增强模块
 * 包含：上下文余量显示、权限模式（YOLO/智能模式）、主题颜色选项
 */

import { state } from '../store';

// ── 上下文余量管理 ────────────────────────────────────────────────────────────

export interface ContextInfo {
  used: number;
  total: number;
  percentage: number;
  remaining: number;
}

class ContextManager {
  private contextWindowMap: Map<string, number> = new Map();

  /**
   * 设置模型的上下文窗口大小
   */
  setModelContextWindow(modelId: string, windowSize: number): void {
    this.contextWindowMap.set(modelId, windowSize);
  }

  /**
   * 获取模型的上下文窗口大小
   */
  getModelContextWindow(modelId: string): number {
    // 常见模型的上下文窗口大小
    const knownModels: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'claude-3-5-sonnet': 200000,
      'claude-3-5-haiku': 200000,
    };

    if (this.contextWindowMap.has(modelId)) {
      return this.contextWindowMap.get(modelId)!;
    }

    // 尝试匹配已知模型
    for (const [key, size] of Object.entries(knownModels)) {
      if (modelId.toLowerCase().includes(key.toLowerCase())) {
        return size;
      }
    }

    // 默认返回 128k
    return 128000;
  }

  /**
   * 估算文本的 token 数量（简单估算）
   */
  estimateTokens(text: string): number {
    // 简单估算：英文约 4 字符 = 1 token，中文约 2 字符 = 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * 计算当前会话的上下文使用情况
   */
  calculateContextUsage(modelId: string): ContextInfo {
    const total = this.getModelContextWindow(modelId);
    let used = 0;

    // 计算所有消息的 token 数
    for (const msg of state.messages) {
      used += this.estimateTokens(msg.content);
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          used += this.estimateTokens(JSON.stringify(tc));
        }
      }
    }

    const percentage = Math.min(100, Math.round((used / total) * 100));
    const remaining = Math.max(0, total - used);

    return {
      used,
      total,
      percentage,
      remaining,
    };
  }

  /**
   * 获取上下文状态描述
   */
  getContextStatus(percentage: number): { color: string; label: string } {
    if (percentage < 50) {
      return { color: '#3fb950', label: '充足' };
    }
    if (percentage < 75) {
      return { color: '#d29922', label: '适中' };
    }
    if (percentage < 90) {
      return { color: '#f85149', label: '紧张' };
    }
    return { color: '#f85149', label: '即将耗尽' };
  }

  /**
   * 格式化 token 数量为可读字符串
   */
  formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return `${tokens}`;
  }
}

export const contextManager = new ContextManager();

// ── 权限模式管理 ───────────────────────────────────────────────────────────────

export type PermissionMode = 'yolo' | 'smart' | 'confirm';

const PERMISSION_STORAGE_KEY = 'iflow-permission-mode';

interface PermissionConfig {
  mode: PermissionMode;
  autoApproveRead: boolean;
  autoApproveWrite: boolean;
  autoApproveExecute: boolean;
  confirmThreshold: 'always' | 'risky' | 'never';
}

class PermissionManager {
  private config: PermissionConfig;

  constructor() {
    const savedMode = localStorage.getItem(PERMISSION_STORAGE_KEY) as PermissionMode;
    this.config = this.getDefaultConfig(savedMode || 'smart');
  }

  private getDefaultConfig(mode: PermissionMode): PermissionConfig {
    switch (mode) {
      case 'yolo':
        return {
          mode: 'yolo',
          autoApproveRead: true,
          autoApproveWrite: true,
          autoApproveExecute: true,
          confirmThreshold: 'never',
        };
      case 'confirm':
        return {
          mode: 'confirm',
          autoApproveRead: false,
          autoApproveWrite: false,
          autoApproveExecute: false,
          confirmThreshold: 'always',
        };
      case 'smart':
      default:
        return {
          mode: 'smart',
          autoApproveRead: true,
          autoApproveWrite: false,
          autoApproveExecute: false,
          confirmThreshold: 'risky',
        };
    }
  }

  getMode(): PermissionMode {
    return this.config.mode;
  }

  setMode(mode: PermissionMode): void {
    this.config = this.getDefaultConfig(mode);
    localStorage.setItem(PERMISSION_STORAGE_KEY, mode);
    this.dispatchEvent('permission-mode-changed', this.config);
  }

  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  shouldAutoApprove(action: 'read' | 'write' | 'execute'): boolean {
    switch (action) {
      case 'read':
        return this.config.autoApproveRead;
      case 'write':
        return this.config.autoApproveWrite;
      case 'execute':
        return this.config.autoApproveExecute;
    }
  }

  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const permissionManager = new PermissionManager();

// ── 主题颜色管理 ───────────────────────────────────────────────────────────────

export type ThemeAccent = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan';

interface ThemeColors {
  accent: string;
  accentHover: string;
  accentSecondary: string;
  accentGradient: string;
}

const THEME_COLORS: Record<ThemeAccent, ThemeColors> = {
  blue: {
    accent: '#2f81f7',
    accentHover: '#388bfd',
    accentSecondary: '#a371f7',
    accentGradient: 'linear-gradient(135deg, #2f81f7, #a371f7)',
  },
  purple: {
    accent: '#a371f7',
    accentHover: '#b392f0',
    accentSecondary: '#f778ba',
    accentGradient: 'linear-gradient(135deg, #a371f7, #f778ba)',
  },
  green: {
    accent: '#3fb950',
    accentHover: '#56d364',
    accentSecondary: '#7ee787',
    accentGradient: 'linear-gradient(135deg, #3fb950, #7ee787)',
  },
  orange: {
    accent: '#f78166',
    accentHover: '#ffa657',
    accentSecondary: '#d29922',
    accentGradient: 'linear-gradient(135deg, #f78166, #d29922)',
  },
  pink: {
    accent: '#f778ba',
    accentHover: '#ff9bce',
    accentSecondary: '#a371f7',
    accentGradient: 'linear-gradient(135deg, #f778ba, #a371f7)',
  },
  cyan: {
    accent: '#79c0ff',
    accentHover: '#a5d6ff',
    accentSecondary: '#56d4dd',
    accentGradient: 'linear-gradient(135deg, #79c0ff, #56d4dd)',
  },
};

const ACCENT_STORAGE_KEY = 'iflow-theme-accent';

class ThemeAccentManager {
  private currentAccent: ThemeAccent;

  constructor() {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY) as ThemeAccent;
    this.currentAccent = saved && THEME_COLORS[saved] ? saved : 'blue';
  }

  getAccent(): ThemeAccent {
    return this.currentAccent;
  }

  setAccent(accent: ThemeAccent): void {
    if (!THEME_COLORS[accent]) return;
    this.currentAccent = accent;
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    this.applyAccent();
    this.dispatchEvent('theme-accent-changed', accent);
  }

  applyAccent(): void {
    const colors = THEME_COLORS[this.currentAccent];
    const root = document.documentElement;
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-secondary', colors.accentSecondary);
    root.style.setProperty('--accent-gradient', colors.accentGradient);
  }

  getAvailableAccents(): { id: ThemeAccent; name: string; color: string }[] {
    return [
      { id: 'blue', name: '海洋蓝', color: '#2f81f7' },
      { id: 'purple', name: '梦幻紫', color: '#a371f7' },
      { id: 'green', name: '森林绿', color: '#3fb950' },
      { id: 'orange', name: '活力橙', color: '#f78166' },
      { id: 'pink', name: '樱花粉', color: '#f778ba' },
      { id: 'cyan', name: '清新青', color: '#79c0ff' },
    ];
  }

  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const themeAccentManager = new ThemeAccentManager();

// ── 字体管理 ───────────────────────────────────────────────────────────────────

export type AppFont = 'default' | 'rounded' | 'mono' | 'serif';

const FONTS: Record<AppFont, { name: string; family: string }> = {
  default: { name: '默认', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  rounded: { name: '圆润', family: "'Nunito', 'Segoe UI', sans-serif" },
  mono: { name: '等宽', family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
  serif: { name: '衬线', family: "'Noto Serif SC', 'Source Serif Pro', Georgia, serif" },
};

const FONT_STORAGE_KEY = 'iflow-app-font';

class FontManager {
  private currentFont: AppFont;

  constructor() {
    const saved = localStorage.getItem(FONT_STORAGE_KEY) as AppFont;
    this.currentFont = saved && FONTS[saved] ? saved : 'default';
  }

  getFont(): AppFont {
    return this.currentFont;
  }

  setFont(font: AppFont): void {
    if (!FONTS[font]) return;
    this.currentFont = font;
    localStorage.setItem(FONT_STORAGE_KEY, font);
    this.applyFont();
    this.dispatchEvent('font-changed', font);
  }

  applyFont(): void {
    const font = FONTS[this.currentFont];
    document.body.style.fontFamily = font.family;
  }

  getAvailableFonts(): { id: AppFont; name: string }[] {
    return Object.entries(FONTS).map(([id, { name }]) => ({ id: id as AppFont, name }));
  }

  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const fontManager = new FontManager();

// ── UI 组件 ────────────────────────────────────────────────────────────────────

/**
 * 创建上下文余量显示组件
 */
export function createContextIndicator(): HTMLElement {
  const indicator = document.createElement('div');
  indicator.id = 'context-indicator';
  indicator.className = 'context-indicator';
  indicator.innerHTML = `
    <div class="context-bar">
      <div class="context-bar-fill"></div>
    </div>
    <div class="context-info">
      <span class="context-label">上下文</span>
      <span class="context-value">0%</span>
    </div>
  `;
  return indicator;
}

/**
 * 更新上下文余量显示
 */
export function updateContextIndicator(modelId?: string): void {
  const indicator = document.getElementById('context-indicator');
  if (!indicator) return;

  const currentModel = modelId || state.modelOptionsCacheByAgent[state.currentAgentId || '']?.[0]?.value || 'gpt-4o';
  const info = contextManager.calculateContextUsage(currentModel);
  const status = contextManager.getContextStatus(info.percentage);

  const fill = indicator.querySelector('.context-bar-fill') as HTMLElement;
  const value = indicator.querySelector('.context-value') as HTMLElement;

  if (fill) {
    fill.style.width = `${info.percentage}%`;
    fill.style.backgroundColor = status.color;
  }

  if (value) {
    value.textContent = `${info.percentage}%`;
    value.style.color = status.color;
    value.title = `已用: ${contextManager.formatTokens(info.used)} / 总计: ${contextManager.formatTokens(info.total)}\n剩余: ${contextManager.formatTokens(info.remaining)}`;
  }
}

/**
 * 初始化增强功能样式
 */
export function initEnhancementsStyles(): void {
  if (document.getElementById('enhancements-styles')) return;

  const style = document.createElement('style');
  style.id = 'enhancements-styles';
  style.textContent = `
    /* 上下文余量指示器 */
    .context-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .context-bar {
      flex: 1;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      overflow: hidden;
    }

    .context-bar-fill {
      height: 100%;
      background: var(--success-color);
      border-radius: 2px;
      transition: width 0.3s, background-color 0.3s;
    }

    .context-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .context-label {
      color: var(--text-muted);
    }

    .context-value {
      font-weight: 500;
      color: var(--success-text);
    }

    /* 权限模式选择器 */
    .permission-mode-selector {
      display: flex;
      gap: 8px;
      padding: 12px;
    }

    .permission-mode-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 8px;
      border: 2px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-tertiary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .permission-mode-btn:hover {
      border-color: var(--accent-color);
    }

    .permission-mode-btn.active {
      border-color: var(--accent-color);
      background: rgba(47, 129, 247, 0.1);
    }

    .permission-mode-icon {
      font-size: 24px;
    }

    .permission-mode-name {
      font-size: 14px;
      font-weight: 600;
    }

    .permission-mode-desc {
      font-size: 11px;
      color: var(--text-secondary);
      text-align: center;
    }

    /* 主题颜色选择器 */
    .accent-color-picker {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px;
    }

    .accent-color-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }

    .accent-color-btn:hover {
      transform: scale(1.1);
    }

    .accent-color-btn.active {
      border-color: var(--text-primary);
      box-shadow: 0 0 0 2px var(--bg-primary);
    }

    /* 字体选择器 */
    .font-selector {
      display: flex;
      gap: 8px;
      padding: 12px;
    }

    .font-btn {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .font-btn:hover {
      border-color: var(--accent-color);
    }

    .font-btn.active {
      border-color: var(--accent-color);
      background: rgba(47, 129, 247, 0.1);
    }

    /* 增强的工具调用面板样式 */
    .tool-call-item {
      position: relative;
    }

    .tool-output {
      max-height: 200px;
      overflow-y: auto;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .tool-output::-webkit-scrollbar {
      width: 4px;
    }

    .tool-output::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 2px;
    }

    /* 状态徽章 */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-badge.success {
      background: rgba(63, 185, 80, 0.15);
      color: #3fb950;
    }

    .status-badge.warning {
      background: rgba(210, 153, 34, 0.15);
      color: #d29922;
    }

    .status-badge.error {
      background: rgba(248, 81, 73, 0.15);
      color: #f85149;
    }

    .status-badge.info {
      background: rgba(47, 129, 247, 0.15);
      color: #58a6ff;
    }

    /* 增强的输入区域 */
    .input-container {
      position: relative;
    }

    .input-status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 16px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-muted);
    }

    .permission-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .permission-indicator.yolo {
      color: #f85149;
    }

    .permission-indicator.smart {
      color: #3fb950;
    }

    .permission-indicator.confirm {
      color: #d29922;
    }
  `;

  document.head.appendChild(style);

  // 动态加载 Google 字体
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap';
  document.head.appendChild(fontLink);
}
