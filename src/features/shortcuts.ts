/**
 * 全局快捷键系统
 * 统一管理所有快捷键绑定
 */

import { commandPalette } from './command-palette';
import { favoritesManager } from './favorites';
import { branchManager } from './branch';
import { state } from '../store';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void | Promise<void>;
  description: string;
  preventDefault?: boolean;
}

class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private enabled = true;

  constructor() {
    this.registerDefaultShortcuts();
    this.bindGlobalListener();
  }

  /**
   * 注册默认快捷键
   */
  private registerDefaultShortcuts(): void {
    // 命令面板
    this.register({
      key: 'p',
      ctrl: true,
      shift: true,
      action: () => commandPalette.toggle(),
      description: '打开命令面板',
    });

    // 模板库
    this.register({
      key: 't',
      ctrl: true,
      action: () => {
        document.getElementById('open-templates-btn')?.click();
      },
      description: '打开模板库',
    });

    // 收藏夹
    this.register({
      key: 'b',
      ctrl: true,
      action: () => favoritesManager.toggleModal(),
      description: '打开收藏夹',
    });

    // 对话分支
    this.register({
      key: 'g',
      ctrl: true,
      shift: true,
      action: () => branchManager.toggleModal(),
      description: '打开对话分支',
    });

    // 新建会话
    this.register({
      key: 'n',
      ctrl: true,
      shift: true,
      action: () => {
        document.getElementById('new-session-btn')?.click();
      },
      description: '新建会话',
    });

    // 添加 Agent
    this.register({
      key: 'n',
      ctrl: true,
      action: () => {
        document.getElementById('add-agent-btn')?.click();
      },
      description: '添加 Agent',
    });

    // 设置
    this.register({
      key: ',',
      ctrl: true,
      action: () => {
        document.getElementById('open-settings-btn')?.click();
      },
      description: '打开设置',
    });

    // 导出
    this.register({
      key: 'e',
      ctrl: true,
      action: () => {
        document.getElementById('export-session-btn')?.click();
      },
      description: '导出会话',
    });

    // 切换主题
    this.register({
      key: 'd',
      ctrl: true,
      shift: true,
      action: () => {
        document.getElementById('theme-toggle-btn')?.click();
      },
      description: '切换主题',
    });

    // 聚焦输入框
    this.register({
      key: '/',
      ctrl: true,
      action: () => {
        const input = document.getElementById('message-input') as HTMLTextAreaElement;
        if (input && !input.disabled) {
          input.focus();
        }
      },
      description: '聚焦输入框',
    });

    // 切换 Agent（向右）
    this.register({
      key: 'Tab',
      ctrl: true,
      action: () => this.navigateAgent(1),
      description: '切换到下一个 Agent',
    });

    // 切换 Agent（向左）
    this.register({
      key: 'Tab',
      ctrl: true,
      shift: true,
      action: () => this.navigateAgent(-1),
      description: '切换到上一个 Agent',
    });

    // 清空会话
    this.register({
      key: 'Delete',
      ctrl: true,
      action: () => {
        if (state.messages.length > 0) {
          document.getElementById('clear-chat-btn')?.click();
        }
      },
      description: '清空当前会话',
    });

    // 切换思考模式
    this.register({
      key: 'k',
      ctrl: true,
      action: () => {
        const btn = document.getElementById('toggle-think-btn') as HTMLButtonElement;
        if (btn && !btn.disabled) {
          btn.click();
        }
      },
      description: '切换思考模式',
    });
  }

  /**
   * 注册快捷键
   */
  register(shortcut: Shortcut): void {
    const key = this.getKeyId(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * 取消注册快捷键
   */
  unregister(shortcut: Shortcut): void {
    const key = this.getKeyId(shortcut);
    this.shortcuts.delete(key);
  }

  /**
   * 生成快捷键 ID
   */
  private getKeyId(shortcut: Shortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * 绑定全局监听器
   */
  private bindGlobalListener(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      // 忽略在输入框中的快捷键（除了特定的全局快捷键）
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // 构建当前按键 ID
      const currentKey = this.buildKeyIdFromEvent(e);
      const shortcut = this.shortcuts.get(currentKey);

      if (shortcut) {
        // 在输入框中时，只允许特定快捷键
        if (isInput && !this.isGlobalShortcut(shortcut)) {
          return;
        }

        e.preventDefault();
        shortcut.action();
      }
    });
  }

  /**
   * 从事件构建按键 ID
   */
  private buildKeyIdFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * 判断是否为全局快捷键（在输入框中也生效）
   */
  private isGlobalShortcut(shortcut: Shortcut): boolean {
    // 命令面板、切换 Agent、主题切换等在输入框中也生效
    const globalKeys = ['ctrl+shift+p', 'ctrl+tab', 'ctrl+shift+tab', 'ctrl+shift+d'];
    const keyId = this.getKeyId(shortcut);
    return globalKeys.includes(keyId);
  }

  /**
   * 导航 Agent
   */
  private navigateAgent(direction: number): void {
    const agents = state.agents;
    if (agents.length === 0) return;

    const currentIndex = state.currentAgentId
      ? agents.findIndex(a => a.id === state.currentAgentId)
      : -1;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = agents.length - 1;
    if (nextIndex >= agents.length) nextIndex = 0;

    const nextAgent = agents[nextIndex];
    if (nextAgent) {
      window.dispatchEvent(new CustomEvent('select-agent', { detail: nextAgent.id }));
    }
  }

  /**
   * 启用快捷键
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用快捷键
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 获取所有快捷键
   */
  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 获取快捷键帮助文本
   */
  getHelpText(): string {
    return this.getAll()
      .map(s => {
        const parts: string[] = [];
        if (s.ctrl) parts.push('Ctrl');
        if (s.shift) parts.push('Shift');
        if (s.alt) parts.push('Alt');
        parts.push(s.key.toUpperCase());
        return `${parts.join('+')} - ${s.description}`;
      })
      .join('\n');
  }
}

// 导出单例
export const shortcutManager = new ShortcutManager();

/**
 * 初始化快捷键帮助弹窗
 */
export function initShortcutHelp(): void {
  // 创建帮助按钮和弹窗
  const helpBtn = document.createElement('button');
  helpBtn.id = 'shortcut-help-btn';
  helpBtn.className = 'btn-secondary';
  helpBtn.innerHTML = '⌨️ 快捷键';
  helpBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 100; opacity: 0.7;';
  
  document.body.appendChild(helpBtn);

  const helpModal = document.createElement('div');
  helpModal.id = 'shortcut-help-modal';
  helpModal.className = 'modal hidden';
  helpModal.innerHTML = `
    <div class="modal-content shortcut-help-content">
      <div class="modal-header">
        <h3>⌨️ 快捷键帮助</h3>
        <button class="btn-icon close-shortcut-help" aria-label="关闭">×</button>
      </div>
      <div class="modal-body shortcut-help-body">
        <div class="shortcut-list"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(helpModal);

  // 填充快捷键列表
  const listEl = helpModal.querySelector('.shortcut-list');
  if (listEl) {
    const shortcuts = shortcutManager.getAll();
    const categories = {
      '全局': shortcuts.filter(s => 
        ['ctrl+shift+p', 'ctrl+shift+d', 'ctrl+,'].includes(
          `${s.ctrl ? 'ctrl+' : ''}${s.shift ? 'shift+' : ''}${s.key.toLowerCase()}`
        )
      ),
      '会话': shortcuts.filter(s => 
        ['ctrl+e', 'ctrl+shift+n', 'ctrl+delete', 'ctrl+k'].includes(
          `${s.ctrl ? 'ctrl+' : ''}${s.shift ? 'shift+' : ''}${s.key.toLowerCase()}`
        )
      ),
      '导航': shortcuts.filter(s => 
        ['ctrl+tab', 'ctrl+shift+tab', 'ctrl+/'].includes(
          `${s.ctrl ? 'ctrl+' : ''}${s.shift ? 'shift+' : ''}${s.key.toLowerCase()}`
        )
      ),
      '功能': shortcuts.filter(s => 
        ['ctrl+t', 'ctrl+b', 'ctrl+shift+g', 'ctrl+n'].includes(
          `${s.ctrl ? 'ctrl+' : ''}${s.shift ? 'shift+' : ''}${s.key.toLowerCase()}`
        )
      ),
    };

    for (const [category, items] of Object.entries(categories)) {
      if (items.length === 0) continue;
      
      const section = document.createElement('div');
      section.className = 'shortcut-section';
      section.innerHTML = `
        <div class="shortcut-section-title">${category}</div>
        <div class="shortcut-items">
          ${items.map(s => `
            <div class="shortcut-item">
              <span class="shortcut-keys">
                ${s.ctrl ? '<kbd>Ctrl</kbd>' : ''}
                ${s.shift ? '<kbd>Shift</kbd>' : ''}
                ${s.alt ? '<kbd>Alt</kbd>' : ''}
                <kbd>${s.key.toUpperCase()}</kbd>
              </span>
              <span class="shortcut-desc">${s.description}</span>
            </div>
          `).join('')}
        </div>
      `;
      listEl.appendChild(section);
    }
  }

  // 绑定事件
  helpBtn.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
  });

  helpModal.querySelector('.close-shortcut-help')?.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.add('hidden');
    }
  });

  // 5秒后隐藏按钮
  setTimeout(() => {
    helpBtn.style.opacity = '0';
    helpBtn.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      helpBtn.style.display = 'none';
    }, 300);
  }, 5000);
}

/**
 * 初始化快捷键样式
 */
export function initShortcutStyles(): void {
  if (document.getElementById('shortcut-styles')) return;

  const style = document.createElement('style');
  style.id = 'shortcut-styles';
  style.textContent = `
    /* 快捷键帮助样式 */
    .shortcut-help-content {
      width: min(500px, 90vw);
    }

    .shortcut-help-body {
      max-height: 60vh;
      overflow-y: auto;
    }

    .shortcut-section {
      margin-bottom: 20px;
    }

    .shortcut-section:last-child {
      margin-bottom: 0;
    }

    .shortcut-section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .shortcut-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
    }

    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .shortcut-keys kbd {
      display: inline-block;
      padding: 3px 8px;
      font-size: 11px;
      font-family: 'Monaco', 'Consolas', monospace;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
    }

    .shortcut-desc {
      font-size: 13px;
      color: var(--text-secondary);
    }
  `;

  document.head.appendChild(style);
}
