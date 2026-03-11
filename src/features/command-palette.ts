/**
 * 命令面板系统 - 类似 VS Code 的 Ctrl+Shift+P
 * 提供快速访问所有功能的能力
 */

import { state } from '../store';

export interface Command {
  id: string;
  name: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'agent' | 'session' | 'settings';
  description?: string;
  action: () => void | Promise<void>;
  when?: () => boolean; // 条件判断是否可用
}

class CommandPalette {
  private commands: Map<string, Command> = new Map();
  private isOpen = false;
  private selectedIndex = 0;
  private filteredCommands: Command[] = [];
  private searchQuery = '';
  private panelEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private onCommandExecute?: () => void;

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * 注册默认命令
   */
  private registerDefaultCommands(): void {
    // 导航命令
    this.register({
      id: 'nav.nextAgent',
      name: '下一个 Agent',
      shortcut: 'Ctrl+Tab',
      category: 'navigation',
      description: '切换到下一个 Agent',
      action: () => this.navigateToAgent(1),
    });

    this.register({
      id: 'nav.prevAgent',
      name: '上一个 Agent',
      shortcut: 'Ctrl+Shift+Tab',
      category: 'navigation',
      description: '切换到上一个 Agent',
      action: () => this.navigateToAgent(-1),
    });

    // Agent 命令
    this.register({
      id: 'agent.add',
      name: '添加 Agent',
      shortcut: 'Ctrl+N',
      category: 'agent',
      description: '添加新的 iFlow Agent',
      action: () => document.getElementById('add-agent-btn')?.click(),
    });

    this.register({
      id: 'agent.disconnect',
      name: '断开 Agent 连接',
      category: 'agent',
      description: '断开当前 Agent 的连接',
      action: () => {
        if (state.currentAgentId) {
          const agent = state.agents.find(a => a.id === state.currentAgentId);
          if (agent && agent.status === 'connected') {
            window.dispatchEvent(new CustomEvent('disconnect-agent', { detail: agent.id }));
          }
        }
      },
      when: () => !!state.currentAgentId && state.agents.find(a => a.id === state.currentAgentId)?.status === 'connected',
    });

    // 会话命令
    this.register({
      id: 'session.new',
      name: '新建会话',
      shortcut: 'Ctrl+Shift+N',
      category: 'session',
      description: '创建新的对话会话',
      action: () => document.getElementById('new-session-btn')?.click(),
      when: () => !!state.currentAgentId,
    });

    this.register({
      id: 'session.clear',
      name: '清空会话',
      category: 'session',
      description: '清空当前会话的消息',
      action: () => document.getElementById('clear-chat-btn')?.click(),
      when: () => state.messages.length > 0,
    });

    this.register({
      id: 'session.export',
      name: '导出会话',
      shortcut: 'Ctrl+E',
      category: 'session',
      description: '导出当前会话',
      action: () => document.getElementById('export-session-btn')?.click(),
      when: () => state.messages.length > 0,
    });

    // 动作命令
    this.register({
      id: 'action.templates',
      name: '打开模板库',
      shortcut: 'Ctrl+T',
      category: 'action',
      description: '打开 Prompt 模板库',
      action: () => document.getElementById('open-templates-btn')?.click(),
    });

    this.register({
      id: 'action.settings',
      name: '打开设置',
      shortcut: 'Ctrl+,',
      category: 'settings',
      description: '打开应用程序设置',
      action: () => document.getElementById('open-settings-btn')?.click(),
    });

    this.register({
      id: 'action.toggleTheme',
      name: '切换主题',
      category: 'settings',
      description: '在亮色/暗色主题之间切换',
      action: () => document.getElementById('theme-toggle-btn')?.click(),
    });

    this.register({
      id: 'action.toggleToolPanel',
      name: '切换工具调用面板',
      category: 'action',
      description: '显示/隐藏工具调用面板',
      action: () => document.getElementById('open-tool-calls-btn')?.click(),
    });

    this.register({
      id: 'action.toggleGitPanel',
      name: '切换文件变更面板',
      category: 'action',
      description: '显示/隐藏文件变更面板',
      action: () => document.getElementById('open-git-changes-btn')?.click(),
    });

    this.register({
      id: 'action.toggleThink',
      name: '切换思考模式',
      category: 'action',
      description: '开启/关闭深度思考模式',
      action: () => document.getElementById('toggle-think-btn')?.click(),
      when: () => !!state.currentAgentId && state.agents.find(a => a.id === state.currentAgentId)?.status === 'connected',
    });

    // 特殊命令
    this.register({
      id: 'special.focusInput',
      name: '聚焦输入框',
      shortcut: 'Ctrl+/',
      category: 'navigation',
      description: '将焦点移到消息输入框',
      action: () => document.getElementById('message-input')?.focus(),
    });

    this.register({
      id: 'special.commandPalette',
      name: '命令面板',
      shortcut: 'Ctrl+Shift+P',
      category: 'navigation',
      description: '打开命令面板',
      action: () => this.toggle(),
    });
  }

  /**
   * 注册新命令
   */
  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * 取消注册命令
   */
  unregister(id: string): void {
    this.commands.delete(id);
  }

  /**
   * 获取所有可用命令
   */
  getAvailableCommands(): Command[] {
    return Array.from(this.commands.values()).filter(cmd => 
      !cmd.when || cmd.when()
    );
  }

  /**
   * 导航到指定方向的 Agent
   */
  private navigateToAgent(direction: number): void {
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
   * 创建命令面板 UI
   */
  private createPanel(): void {
    if (this.panelEl) return;

    this.panelEl = document.createElement('div');
    this.panelEl.id = 'command-palette';
    this.panelEl.className = 'command-palette-overlay hidden';
    this.panelEl.innerHTML = `
      <div class="command-palette-container">
        <div class="command-palette-input-wrapper">
          <input 
            type="text" 
            class="command-palette-input" 
            placeholder="输入命令名称或快捷键..." 
            autocomplete="off"
          />
        </div>
        <div class="command-palette-list"></div>
        <div class="command-palette-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.panelEl);

    this.inputEl = this.panelEl.querySelector('.command-palette-input');
    this.listEl = this.panelEl.querySelector('.command-palette-list');

    // 绑定事件
    this.panelEl.addEventListener('click', (e) => {
      if (e.target === this.panelEl) {
        this.close();
      }
    });

    this.inputEl?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.filterCommands();
      this.renderCommands();
    });

    this.inputEl?.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
  }

  /**
   * 过滤命令
   */
  private filterCommands(): void {
    const query = this.searchQuery.toLowerCase().trim();
    const availableCommands = this.getAvailableCommands();

    if (!query) {
      this.filteredCommands = availableCommands;
    } else {
      this.filteredCommands = availableCommands.filter(cmd => {
        const nameMatch = cmd.name.toLowerCase().includes(query);
        const shortcutMatch = cmd.shortcut?.toLowerCase().includes(query);
        const descMatch = cmd.description?.toLowerCase().includes(query);
        const idMatch = cmd.id.toLowerCase().includes(query);
        return nameMatch || shortcutMatch || descMatch || idMatch;
      });
    }

    // 按类别排序
    const categoryOrder = ['navigation', 'agent', 'session', 'action', 'settings'];
    this.filteredCommands.sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return a.name.localeCompare(b.name);
    });

    this.selectedIndex = 0;
  }

  /**
   * 渲染命令列表
   */
  private renderCommands(): void {
    if (!this.listEl) return;

    if (this.filteredCommands.length === 0) {
      this.listEl.innerHTML = `
        <div class="command-palette-empty">
          未找到匹配的命令
        </div>
      `;
      return;
    }

    // 按类别分组
    const grouped = this.groupByCategory(this.filteredCommands);
    let html = '';

    for (const [category, commands] of Object.entries(grouped)) {
      html += `
        <div class="command-palette-category">
          <div class="command-palette-category-header">${this.getCategoryLabel(category)}</div>
          <div class="command-palette-category-items">
      `;

      commands.forEach((cmd) => {
        const globalIndex = this.filteredCommands.indexOf(cmd);
        const isSelected = globalIndex === this.selectedIndex;
        html += `
          <div 
            class="command-palette-item ${isSelected ? 'selected' : ''}"
            data-index="${globalIndex}"
            data-id="${cmd.id}"
          >
            <span class="command-name">${this.highlightMatch(cmd.name)}</span>
            ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
            ${cmd.description ? `<span class="command-desc">${cmd.description}</span>` : ''}
          </div>
        `;
      });

      html += '</div></div>';
    }

    this.listEl.innerHTML = html;

    // 绑定点击事件
    this.listEl.querySelectorAll('.command-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        if (id) {
          this.executeCommand(id);
        }
      });

      item.addEventListener('mouseenter', () => {
        const index = parseInt(item.getAttribute('data-index') || '0');
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  /**
   * 高亮匹配文本
   */
  private highlightMatch(text: string): string {
    if (!this.searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 按类别分组
   */
  private groupByCategory(commands: Command[]): Record<string, Command[]> {
    return commands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<string, Command[]>);
  }

  /**
   * 获取类别标签
   */
  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      navigation: '🧭 导航',
      agent: '🤖 Agent',
      session: '💬 会话',
      action: '⚡ 动作',
      settings: '⚙️ 设置',
    };
    return labels[category] || category;
  }

  /**
   * 更新选中状态
   */
  private updateSelection(): void {
    if (!this.listEl) return;

    this.listEl.querySelectorAll('.command-palette-item').forEach(item => {
      const index = parseInt(item.getAttribute('data-index') || '0');
      item.classList.toggle('selected', index === this.selectedIndex);
    });

    // 滚动到可见
    const selectedItem = this.listEl.querySelector('.command-palette-item.selected');
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * 处理键盘事件
   */
  private handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.filteredCommands[this.selectedIndex]) {
          this.executeCommand(this.filteredCommands[this.selectedIndex].id);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  /**
   * 执行命令
   */
  private async executeCommand(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (!command) return;

    this.close();
    
    try {
      await command.action();
      this.onCommandExecute?.();
    } catch (error) {
      console.error('Command execution failed:', error);
    }
  }

  /**
   * 打开命令面板
   */
  open(): void {
    if (!this.panelEl) {
      this.createPanel();
    }

    this.isOpen = true;
    this.searchQuery = '';
    this.selectedIndex = 0;
    
    if (this.inputEl) {
      this.inputEl.value = '';
    }

    this.filterCommands();
    this.renderCommands();
    this.panelEl?.classList.remove('hidden');
    
    // 延迟聚焦以确保动画完成
    setTimeout(() => {
      this.inputEl?.focus();
    }, 50);
  }

  /**
   * 关闭命令面板
   */
  close(): void {
    this.isOpen = false;
    this.panelEl?.classList.add('hidden');
  }

  /**
   * 切换命令面板
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 设置命令执行回调
   */
  onExecute(callback: () => void): void {
    this.onCommandExecute = callback;
  }
}

// 导出单例
export const commandPalette = new CommandPalette();

/**
 * 初始化命令面板样式
 */
export function initCommandPaletteStyles(): void {
  if (document.getElementById('command-palette-styles')) return;

  const style = document.createElement('style');
  style.id = 'command-palette-styles';
  style.textContent = `
    /* 命令面板样式 */
    .command-palette-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      z-index: 2000;
      opacity: 1;
      visibility: visible;
      transition: opacity 0.15s, visibility 0.15s;
    }

    .command-palette-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .command-palette-container {
      width: min(600px, 90vw);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      transform: translateY(0);
      transition: transform 0.15s;
    }

    .command-palette-overlay.hidden .command-palette-container {
      transform: translateY(-10px);
    }

    .command-palette-input-wrapper {
      padding: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .command-palette-input {
      width: 100%;
      height: 40px;
      padding: 0 14px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }

    .command-palette-input:focus {
      border-color: var(--accent-color);
    }

    .command-palette-list {
      max-height: 50vh;
      overflow-y: auto;
      padding: 8px;
    }

    .command-palette-empty {
      text-align: center;
      padding: 32px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .command-palette-category {
      margin-bottom: 8px;
    }

    .command-palette-category:last-child {
      margin-bottom: 0;
    }

    .command-palette-category-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 10px;
    }

    .command-palette-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s;
    }

    .command-palette-item:hover,
    .command-palette-item.selected {
      background: rgba(47, 129, 247, 0.12);
    }

    .command-palette-item.selected {
      background: rgba(47, 129, 247, 0.16);
    }

    .command-palette-item .command-name {
      flex: 1;
      font-size: 14px;
      color: var(--text-primary);
    }

    .command-palette-item .command-name mark {
      background: rgba(47, 129, 247, 0.3);
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }

    .command-palette-item .command-shortcut {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-tertiary);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
    }

    .command-palette-item .command-desc {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .command-palette-footer {
      display: flex;
      gap: 16px;
      padding: 10px 14px;
      border-top: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-muted);
    }

    .command-palette-footer kbd {
      display: inline-block;
      padding: 2px 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-family: inherit;
      font-size: 10px;
      margin-right: 4px;
    }
  `;

  document.head.appendChild(style);
}
