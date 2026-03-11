// src/features/quickcommands.ts — 快捷命令系统
import { escapeHtml } from '../lib/html';
import type { SlashMenuItem } from '../types';

// 快捷命令定义
export interface QuickCommand {
  id: string;
  name: string;
  shortcut?: string;  // 快捷键，如 'Ctrl+Shift+K'
  template: string;   // 要插入的文本模板
  description: string;
  category: 'navigation' | 'editing' | 'session' | 'tools' | 'custom';
  isBuiltin?: boolean;
}

// 内置快捷命令
export const BUILTIN_QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'qc-continue',
    name: '继续',
    shortcut: 'Ctrl+K',
    template: '请继续',
    description: '让 AI 继续之前的回答',
    category: 'editing',
    isBuiltin: true,
  },
  {
    id: 'qc-ok',
    name: '确认',
    shortcut: 'Ctrl+Enter',
    template: '好的',
    description: '简单确认回复',
    category: 'editing',
    isBuiltin: true,
  },
  {
    id: 'qc-explain',
    name: '解释代码',
    shortcut: 'Ctrl+Shift+E',
    template: '请详细解释以下代码的功能和实现原理：\n\n{{selection}}',
    description: '解释选中的代码',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-review',
    name: '代码审查',
    shortcut: 'Ctrl+Shift+R',
    template: '请对以下代码进行全面审查，关注代码质量、潜在问题、性能优化和安全风险：\n\n{{selection}}',
    description: '审查选中的代码',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-refactor',
    name: '重构建议',
    shortcut: 'Ctrl+Shift+F',
    template: '请分析以下代码并提供重构建议，使其更加清晰、高效和可维护：\n\n{{selection}}',
    description: '获取重构建议',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-test',
    name: '生成测试',
    shortcut: 'Ctrl+Shift+T',
    template: '请为以下代码生成单元测试用例：\n\n{{selection}}',
    description: '生成测试用例',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-docs',
    name: '生成文档',
    shortcut: 'Ctrl+Shift+D',
    template: '请为以下代码生成文档注释：\n\n{{selection}}',
    description: '生成代码文档',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-translate',
    name: '翻译',
    shortcut: 'Ctrl+Shift+Y',
    template: '请将以下内容翻译成中文：\n\n{{selection}}',
    description: '翻译选中内容',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-summarize',
    name: '总结',
    shortcut: 'Ctrl+Shift+S',
    template: '请总结以下内容的核心要点：\n\n{{selection}}',
    description: '总结选中内容',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-fix',
    name: '修复问题',
    shortcut: 'Ctrl+Shift+X',
    template: '请检查并修复以下内容中的问题：\n\n{{selection}}',
    description: '修复代码问题',
    category: 'tools',
    isBuiltin: true,
  },
  {
    id: 'qc-new-session',
    name: '新建会话',
    shortcut: 'Ctrl+N',
    template: '',
    description: '创建新的会话',
    category: 'session',
    isBuiltin: true,
  },
  {
    id: 'qc-clear',
    name: '清空会话',
    shortcut: 'Ctrl+L',
    template: '',
    description: '清空当前会话',
    category: 'session',
    isBuiltin: true,
  },
];

// 用户自定义命令存储
const CUSTOM_COMMANDS_STORAGE_KEY = 'iflow-custom-quick-commands';

// 初始化快捷命令
export function initQuickCommands() {
  const stored = localStorage.getItem(CUSTOM_COMMANDS_STORAGE_KEY);
  const customCommands: QuickCommand[] = stored 
    ? JSON.parse(stored) 
    : [];
  return [...BUILTIN_QUICK_COMMANDS, ...customCommands];
}

// 获取所有快捷命令
export function getQuickCommands(): QuickCommand[] {
  return initQuickCommands();
}

// 按分类获取命令
export function getCommandsByCategory(category: string): QuickCommand[] {
  return getQuickCommands().filter(cmd => cmd.category === category);
}

// 搜索命令
export function searchQuickCommands(query: string): QuickCommand[] {
  const lowerQuery = query.toLowerCase();
  return getQuickCommands().filter(cmd => 
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery) ||
    cmd.template.toLowerCase().includes(lowerQuery)
  );
}

// 添加自定义命令
export function addCustomCommand(command: Omit<QuickCommand, 'id' | 'isBuiltin'>): QuickCommand {
  const newCommand: QuickCommand = {
    ...command,
    id: `qc-custom-${Date.now()}`,
    isBuiltin: false,
  };
  
  const customCommands = getCustomCommands();
  customCommands.push(newCommand);
  saveCustomCommands(customCommands);
  
  return newCommand;
}

// 更新自定义命令
export function updateCustomCommand(id: string, updates: Partial<QuickCommand>): boolean {
  const customCommands = getCustomCommands();
  const index = customCommands.findIndex(cmd => cmd.id === id);
  
  if (index === -1) {
    return false;
  }
  
  customCommands[index] = { ...customCommands[index], ...updates };
  saveCustomCommands(customCommands);
  return true;
}

// 删除自定义命令
export function deleteCustomCommand(id: string): boolean {
  const customCommands = getCustomCommands();
  const index = customCommands.findIndex(cmd => cmd.id === id);
  
  if (index === -1) {
    return false;
  }
  
  customCommands.splice(index, 1);
  saveCustomCommands(customCommands);
  return true;
}

// 获取自定义命令
function getCustomCommands(): QuickCommand[] {
  const stored = localStorage.getItem(CUSTOM_COMMANDS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// 保存自定义命令
function saveCustomCommands(commands: QuickCommand[]) {
  localStorage.setItem(CUSTOM_COMMANDS_STORAGE_KEY, JSON.stringify(commands));
}

// 执行快捷命令
export function executeQuickCommand(
  commandId: string, 
  selection?: string
): string | { action: string } | null {
  const command = getQuickCommands().find(cmd => cmd.id === commandId);
  
  if (!command) {
    return null;
  }
  
  // 处理特殊命令
  if (command.id === 'qc-new-session') {
    return { action: 'new-session' };
  }
  if (command.id === 'qc-clear') {
    return { action: 'clear-session' };
  }
  
  // 替换模板中的变量
  let template = command.template;
  if (selection && template.includes('{{selection}}')) {
    template = template.replace('{{selection}}', selection);
  }
  
  return template;
}

// 将快捷命令转换为 SlashMenuItem
export function quickCommandsToSlashItems(): SlashMenuItem[] {
  return getQuickCommands()
    .filter(cmd => cmd.template)  // 只包含有模板的命令
    .map(cmd => ({
      id: cmd.id,
      label: `/${cmd.name.toLowerCase().replace(/\s+/g, '-')}`,
      insertText: cmd.template,
      description: cmd.description + (cmd.shortcut ? ` (${cmd.shortcut})` : ''),
      hint: cmd.shortcut || 'command',
      category: 'builtin' as const,
      searchable: `${cmd.name} ${cmd.description} ${cmd.template}`.toLowerCase(),
    }));
}

// 渲染快捷命令面板
export function renderQuickCommandsPanel(filter?: string): string {
  const commands = filter ? searchQuickCommands(filter) : getQuickCommands();
  
  // 按分类分组
  const grouped: Record<string, QuickCommand[]> = {};
  for (const cmd of commands) {
    if (!grouped[cmd.category]) {
      grouped[cmd.category] = [];
    }
    grouped[cmd.category].push(cmd);
  }
  
  const categoryLabels: Record<string, string> = {
    navigation: '🧭 导航',
    editing: '✏️ 编辑',
    session: '💬 会话',
    tools: '🔧 工具',
    custom: '⭐ 自定义',
  };
  
  const categoryOrder = ['editing', 'tools', 'session', 'navigation', 'custom'];
  
  return `
    <div class="quick-commands-panel">
      <div class="quick-commands-search">
        <input type="text" id="quick-commands-filter" placeholder="搜索命令..." />
      </div>
      <div class="quick-commands-list">
        ${categoryOrder
          .filter(cat => grouped[cat] && grouped[cat].length > 0)
          .map(cat => `
            <div class="quick-commands-category">
              <div class="category-header">${categoryLabels[cat] || cat}</div>
              <div class="category-commands">
                ${grouped[cat].map(cmd => `
                  <button type="button" class="quick-command-item" data-command-id="${cmd.id}">
                    <span class="command-name">${escapeHtml(cmd.name)}</span>
                    ${cmd.shortcut ? `<span class="command-shortcut">${escapeHtml(cmd.shortcut)}</span>` : ''}
                    <span class="command-desc">${escapeHtml(cmd.description)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
      </div>
      <div class="quick-commands-footer">
        <span class="hint">按 Esc 关闭，按 ↑↓ 选择</span>
        <button type="button" id="add-custom-command-btn" class="btn-secondary btn-compact">+ 添加命令</button>
      </div>
    </div>
  `;
}

// 渲染命令编辑表单
export function renderCommandEditor(command?: QuickCommand): string {
  return `
    <div class="command-editor-form">
      <div class="form-group">
        <label for="cmd-name">命令名称</label>
        <input type="text" id="cmd-name" value="${command ? escapeHtml(command.name) : ''}" placeholder="例如：代码格式化" />
      </div>
      <div class="form-group">
        <label for="cmd-shortcut">快捷键（可选）</label>
        <input type="text" id="cmd-shortcut" value="${command?.shortcut || ''}" placeholder="例如：Ctrl+Shift+G" />
      </div>
      <div class="form-group">
        <label for="cmd-category">分类</label>
        <select id="cmd-category">
          <option value="tools" ${command?.category === 'tools' ? 'selected' : ''}>🔧 工具</option>
          <option value="editing" ${command?.category === 'editing' ? 'selected' : ''}>✏️ 编辑</option>
          <option value="custom" ${command?.category === 'custom' ? 'selected' : ''}>⭐ 自定义</option>
        </select>
      </div>
      <div class="form-group">
        <label for="cmd-template">模板内容</label>
        <textarea id="cmd-template" rows="4" placeholder="输入要插入的文本，使用 {{selection}} 表示选中文本">${command ? escapeHtml(command.template) : ''}</textarea>
      </div>
      <div class="form-group">
        <label for="cmd-description">描述</label>
        <input type="text" id="cmd-description" value="${command ? escapeHtml(command.description) : ''}" placeholder="简要描述命令功能" />
      </div>
    </div>
  `;
}

// 注册全局快捷键
export function registerGlobalShortcuts(
  onCommand: (commandId: string) => void
): () => void {
  const handler = (event: KeyboardEvent) => {
    // 构建快捷键字符串
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    // 添加主键
    if (event.key.length === 1) {
      parts.push(event.key.toUpperCase());
    } else if (event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Shift' && event.key !== 'Meta') {
      parts.push(event.key);
    }
    
    const shortcut = parts.join('+');
    
    // 查找匹配的命令
    const command = getQuickCommands().find(cmd => cmd.shortcut === shortcut);
    if (command) {
      event.preventDefault();
      onCommand(command.id);
    }
  };
  
  document.addEventListener('keydown', handler);
  
  // 返回清理函数
  return () => {
    document.removeEventListener('keydown', handler);
  };
}
