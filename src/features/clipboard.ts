// src/features/clipboard.ts — 智能剪贴板助手功能
import { escapeHtml } from '../lib/html';
import type { SlashMenuItem } from '../types';

// 剪贴板历史记录
export interface ClipboardHistoryItem {
  id: string;
  content: string;
  type: 'text' | 'code' | 'url' | 'image';
  timestamp: Date;
  preview: string;
}

// 剪贴板操作类型
export type ClipboardAction = 'explain' | 'summarize' | 'translate' | 'format' | 'fix' | 'review';

// 预定义的剪贴板处理动作
export const CLIPBOARD_ACTIONS: ReadonlyArray<{ id: ClipboardAction; label: string; icon: string; prompt: string }> = [
  {
    id: 'explain',
    label: '解释',
    icon: '💡',
    prompt: '请解释以下内容：\n\n{{content}}',
  },
  {
    id: 'summarize',
    label: '总结',
    icon: '📝',
    prompt: '请总结以下内容的要点：\n\n{{content}}',
  },
  {
    id: 'translate',
    label: '翻译',
    icon: '🌐',
    prompt: '请将以下内容翻译成中文：\n\n{{content}}',
  },
  {
    id: 'format',
    label: '格式化',
    icon: '✨',
    prompt: '请格式化以下内容，使其更清晰易读：\n\n{{content}}',
  },
  {
    id: 'fix',
    label: '修正',
    icon: '🔧',
    prompt: '请检查并修正以下内容中的错误：\n\n{{content}}',
  },
  {
    id: 'review',
    label: '审查',
    icon: '🔍',
    prompt: '请审查以下内容并提供改进建议：\n\n{{content}}',
  },
];

// 剪贴板历史存储（内存中，最多保存 20 条）
const MAX_CLIPBOARD_HISTORY = 20;
let clipboardHistory: ClipboardHistoryItem[] = [];

// 检测内容类型
export function detectContentType(content: string): 'text' | 'code' | 'url' | 'image' {
  const trimmed = content.trim();
  
  // URL 检测
  if (/^https?:\/\//i.test(trimmed)) {
    return 'url';
  }
  
  // 代码检测（简单启发式）
  if (
    /^(function|const|let|var|class|import|export|if|for|while|def |fn |pub |async |await )/m.test(trimmed) ||
    /[{}\[\]();]/.test(trimmed) ||
    /```[\s\S]*```/.test(trimmed)
  ) {
    return 'code';
  }
  
  // Base64 图片检测
  if (/^data:image\//i.test(trimmed)) {
    return 'image';
  }
  
  return 'text';
}

// 生成预览文本
function generatePreview(content: string, maxLength = 100): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength) + '...';
}

// 添加到剪贴板历史
export function addToClipboardHistory(content: string): ClipboardHistoryItem {
  const type = detectContentType(content);
  const item: ClipboardHistoryItem = {
    id: `clip-${Date.now()}`,
    content,
    type,
    timestamp: new Date(),
    preview: generatePreview(content),
  };
  
  clipboardHistory.unshift(item);
  
  // 保持历史记录上限
  if (clipboardHistory.length > MAX_CLIPBOARD_HISTORY) {
    clipboardHistory = clipboardHistory.slice(0, MAX_CLIPBOARD_HISTORY);
  }
  
  return item;
}

// 获取剪贴板历史
export function getClipboardHistory(): ClipboardHistoryItem[] {
  return [...clipboardHistory];
}

// 清空剪贴板历史
export function clearClipboardHistory() {
  clipboardHistory = [];
}

// 删除单条历史记录
export function deleteFromClipboardHistory(id: string) {
  const index = clipboardHistory.findIndex(item => item.id === id);
  if (index !== -1) {
    clipboardHistory.splice(index, 1);
  }
}

// 获取处理后的 Prompt
export function getClipboardActionPrompt(actionId: ClipboardAction, content: string): string {
  const action = CLIPBOARD_ACTIONS.find(a => a.id === actionId);
  if (!action) {
    return content;
  }
  return action.prompt.replace('{{content}}', content);
}

// 渲染剪贴板助手面板
export function renderClipboardPanel(content: string): string {
  const type = detectContentType(content);
  const typeLabels: Record<string, string> = {
    text: '📝 文本',
    code: '💻 代码',
    url: '🔗 链接',
    image: '🖼️ 图片',
  };
  
  return `
    <div class="clipboard-assistant-panel">
      <div class="clipboard-content-preview">
        <div class="clipboard-type-badge">${typeLabels[type]}</div>
        <div class="clipboard-preview-text">${escapeHtml(generatePreview(content, 200))}</div>
      </div>
      <div class="clipboard-actions">
        <div class="clipboard-actions-title">选择操作</div>
        <div class="clipboard-action-buttons">
          ${CLIPBOARD_ACTIONS.map(action => `
            <button type="button" class="clipboard-action-btn" data-action="${action.id}">
              <span class="action-icon">${action.icon}</span>
              <span class="action-label">${action.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="clipboard-history-section">
        <div class="clipboard-history-header">
          <span>历史记录</span>
          <button type="button" class="clear-history-btn">清空</button>
        </div>
        <div class="clipboard-history-list">
          ${clipboardHistory.length === 0 
            ? '<div class="history-empty">暂无历史记录</div>'
            : clipboardHistory.slice(0, 5).map(item => `
              <div class="history-item" data-history-id="${item.id}">
                <span class="history-type">${getTypeIcon(item.type)}</span>
                <span class="history-preview">${escapeHtml(item.preview)}</span>
                <button type="button" class="history-use-btn" data-history-id="${item.id}">使用</button>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    text: '📝',
    code: '💻',
    url: '🔗',
    image: '🖼️',
  };
  return icons[type] || '📝';
}

// 渲染剪贴板快捷入口
export function renderClipboardQuickAccess(): string {
  return `
    <button type="button" id="clipboard-quick-btn" class="btn-secondary clipboard-quick-btn" title="智能剪贴板助手">
      📋 剪贴板
    </button>
  `;
}

// 检测剪贴板内容变化的辅助函数（需要在 Tauri 后端支持）
export async function checkClipboardChange(): Promise<string | null> {
  try {
    // 使用浏览器 API（受限）
    const text = await navigator.clipboard.readText();
    return text || null;
  } catch {
    return null;
  }
}

// 扩展 SlashMenu 以支持剪贴板操作
export function buildClipboardSlashItems(): SlashMenuItem[] {
  return CLIPBOARD_ACTIONS.map(action => ({
    id: `clipboard-${action.id}`,
    label: `/clipboard ${action.id}`,
    insertText: `/clipboard ${action.id}`,
    description: `${action.icon} ${action.label}剪贴板内容`,
    hint: 'clipboard',
    category: 'builtin' as const,
    searchable: `clipboard ${action.id} ${action.label}`.toLowerCase(),
  }));
}

// 处理剪贴板相关的 Slash 命令
export async function handleClipboardSlashCommand(command: string): Promise<string | null> {
  const match = command.match(/^\/clipboard\s+(\w+)/);
  if (!match) {
    return null;
  }
  
  const actionId = match[1] as ClipboardAction;
  const action = CLIPBOARD_ACTIONS.find(a => a.id === actionId);
  if (!action) {
    return null;
  }
  
  try {
    const content = await navigator.clipboard.readText();
    if (!content) {
      return null;
    }
    
    addToClipboardHistory(content);
    return getClipboardActionPrompt(actionId, content);
  } catch {
    return null;
  }
}
