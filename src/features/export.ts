// src/features/export.ts — 会话导出功能
import { invoke } from '@tauri-apps/api/core';
import { state } from '../store';
import { formatTime } from '../lib/utils';
import { escapeHtml } from '../lib/html';
import { formatMessageContent } from '../lib/markdown';
import type { Session, Message, ExportFormat, ExportOptions } from '../types';

// 默认导出选项
const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'markdown',
  includeTimestamps: true,
  includeToolCalls: false,
  includeSystemMessages: false,
};

// 将会话导出为 Markdown 格式
export function exportToMarkdown(
  session: Session,
  messages: Message[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const lines: string[] = [];
  
  // 标题
  lines.push(`# ${session.title}`);
  lines.push('');
  
  // 元信息
  lines.push(`> 创建时间: ${formatTime(session.createdAt)}`);
  lines.push(`> 更新时间: ${formatTime(session.updatedAt)}`);
  if (session.messageCountHint) {
    lines.push(`> 消息数: ${session.messageCountHint}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // 消息内容
  for (const msg of messages) {
    // 过滤系统消息
    if (msg.role === 'system' && !options.includeSystemMessages) {
      continue;
    }
    
    const roleLabel = getRoleLabel(msg.role);
    const timestamp = options.includeTimestamps ? ` *(${formatTime(msg.timestamp)})*` : '';
    
    if (msg.role === 'thought') {
      lines.push(`### 💭 思考过程${timestamp}`);
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>点击展开</summary>');
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    } else {
      lines.push(`### ${roleLabel}${timestamp}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      
      // 工具调用
      if (options.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0) {
        lines.push('**工具调用:**');
        lines.push('```json');
        lines.push(JSON.stringify(msg.toolCalls, null, 2));
        lines.push('```');
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}

// 将会话导出为 JSON 格式
export function exportToJson(
  session: Session,
  messages: Message[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const exportData = {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      source: session.source,
    },
    messages: messages
      .filter(msg => options.includeSystemMessages || msg.role !== 'system')
      .map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        ...(options.includeToolCalls && msg.toolCalls ? { toolCalls: msg.toolCalls } : {}),
      })),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  
  return JSON.stringify(exportData, null, 2);
}

// 将会话导出为 HTML 格式
export function exportToHtml(
  session: Session,
  messages: Message[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const messageHtml = messages
    .filter(msg => options.includeSystemMessages || msg.role !== 'system')
    .map(msg => {
      const roleLabel = getRoleLabel(msg.role);
      const timestamp = options.includeTimestamps 
        ? `<span class="timestamp">${escapeHtml(formatTime(msg.timestamp))}</span>` 
        : '';
      
      if (msg.role === 'thought') {
        return `
          <div class="message thought">
            <div class="message-header">💭 思考过程 ${timestamp}</div>
            <details>
              <summary>点击展开</summary>
              <div class="message-content">${formatMessageContent(msg.content)}</div>
            </details>
          </div>
        `;
      }
      
      const avatar = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
      
      return `
        <div class="message ${msg.role}">
          <div class="message-header">
            <span class="avatar">${avatar}</span>
            <span class="role">${escapeHtml(roleLabel)}</span>
            ${timestamp}
          </div>
          <div class="message-content">${formatMessageContent(msg.content)}</div>
          ${options.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0 
            ? `<div class="tool-calls"><pre>${escapeHtml(JSON.stringify(msg.toolCalls, null, 2))}</pre></div>` 
            : ''}
        </div>
      `;
    })
    .join('');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.title)} - FlowHub 导出</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --border-color: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-color: #2f81f7;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg-primary: #ffffff;
        --bg-secondary: #f6f8fa;
        --border-color: #d0d7de;
        --text-primary: #1f2328;
        --text-secondary: #636c76;
        --accent-color: #0969da;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 40px 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { margin-bottom: 8px; }
    .meta { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    .message { margin-bottom: 24px; border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
    .message-header { background: var(--bg-secondary); padding: 12px 16px; display: flex; align-items: center; gap: 8px; }
    .avatar { font-size: 20px; }
    .role { font-weight: 600; }
    .timestamp { color: var(--text-secondary); font-size: 12px; margin-left: auto; }
    .message-content { padding: 16px; }
    .message.user .message-header { background: rgba(47, 129, 247, 0.1); }
    .message.thought { background: var(--bg-secondary); }
    .message.thought details { padding: 12px 16px; }
    .tool-calls { background: var(--bg-secondary); padding: 12px; margin-top: 12px; }
    .tool-calls pre { font-size: 12px; overflow-x: auto; }
    code { background: rgba(110, 118, 129, 0.2); padding: 2px 6px; border-radius: 4px; }
    pre { background: var(--bg-secondary); padding: 12px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 24px 0; }
    a { color: var(--accent-color); }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background: var(--bg-secondary); }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.title)}</h1>
  <div class="meta">
    <span>📅 创建: ${escapeHtml(formatTime(session.createdAt))}</span>
    <span>📝 更新: ${escapeHtml(formatTime(session.updatedAt))}</span>
    <span>💬 消息: ${messages.length}</span>
  </div>
  <hr>
  <div class="messages">
    ${messageHtml}
  </div>
  <hr>
  <footer style="text-align: center; color: var(--text-secondary); font-size: 12px;">
    由 FlowHub 导出 · ${escapeHtml(new Date().toLocaleString('zh-CN'))}
  </footer>
</body>
</html>`;
}

// 将会话导出为纯文本格式
export function exportToTxt(
  session: Session,
  messages: Message[],
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const lines: string[] = [];
  
  lines.push(`会话: ${session.title}`);
  lines.push(`创建时间: ${formatTime(session.createdAt)}`);
  lines.push(`更新时间: ${formatTime(session.updatedAt)}`);
  lines.push('');
  lines.push('='.repeat(50));
  lines.push('');
  
  for (const msg of messages) {
    if (msg.role === 'system' && !options.includeSystemMessages) {
      continue;
    }
    
    const roleLabel = getRoleLabel(msg.role);
    const timestamp = options.includeTimestamps ? ` [${formatTime(msg.timestamp)}]` : '';
    
    lines.push(`【${roleLabel}】${timestamp}`);
    lines.push(msg.content);
    
    if (options.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('[工具调用]');
      lines.push(JSON.stringify(msg.toolCalls, null, 2));
    }
    
    lines.push('');
    lines.push('-'.repeat(30));
    lines.push('');
  }
  
  return lines.join('\n');
}

// 获取角色标签
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    user: '👤 用户',
    assistant: '🤖 助手',
    system: '⚙️ 系统',
    thought: '💭 思考',
  };
  return labels[role] || role;
}

// 导出会话（统一入口）
export function exportSession(
  session: Session,
  messages: Message[],
  format: ExportFormat = 'markdown',
  options: Partial<ExportOptions> = {}
): string {
  const finalOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  
  switch (format) {
    case 'json':
      return exportToJson(session, messages, finalOptions);
    case 'html':
      return exportToHtml(session, messages, finalOptions);
    case 'txt':
      return exportToTxt(session, messages, finalOptions);
    case 'markdown':
    default:
      return exportToMarkdown(session, messages, finalOptions);
  }
}

// 获取导出文件扩展名
export function getExportFileExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    markdown: 'md',
    json: 'json',
    html: 'html',
    txt: 'txt',
  };
  return extensions[format];
}

// 获取导出 MIME 类型
export function getExportMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    markdown: 'text/markdown',
    json: 'application/json',
    html: 'text/html',
    txt: 'text/plain',
  };
  return mimeTypes[format];
}

// 下载导出文件
export async function downloadExportFile(
  content: string,
  filename: string,
  _format: ExportFormat
): Promise<string | null> {
  try {
    // 使用 Tauri 命令保存文件
    const savedPath = await invoke<string>('save_export_file', {
      content,
      defaultFilename: filename,
    });
    return savedPath;
  } catch (error) {
    // 如果是用户取消，不显示错误
    if (String(error).includes('取消')) {
      return null;
    }
    throw error;
  }
}

// 导出当前会话
export async function exportCurrentSession(
  format: ExportFormat = 'markdown',
  options: Partial<ExportOptions> = {}
): Promise<string | null> {
  // 检查是否有当前会话
  if (!state.currentSessionId) {
    console.error('导出失败：没有当前会话');
    return null;
  }

  // 检查是否有当前 Agent
  if (!state.currentAgentId) {
    console.error('导出失败：没有选择 Agent');
    return null;
  }

  // 查找会话
  const agentSessions = state.sessionsByAgent[state.currentAgentId];
  if (!agentSessions) {
    console.error('导出失败：找不到当前 Agent 的会话列表');
    return null;
  }

  const session = agentSessions.find(s => s.id === state.currentSessionId);

  if (!session) {
    console.error('导出失败：找不到当前会话');
    return null;
  }

  // 获取消息
  const messages = state.messagesBySession[state.currentSessionId] || [];
  if (messages.length === 0) {
    console.warn('警告：会话中没有消息');
  }

  // 生成导出内容
  const content = exportSession(session, messages, format, options);

  // 生成文件名（移除特殊字符）
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeTitle = session.title
    .replace(/[<>:"/\\|?*]/g, '_') // 移除非法文件名字符
    .slice(0, 30)
    .trim() || '未命名会话';
  const filename = `${safeTitle}_${timestamp}.${getExportFileExtension(format)}`;

  // 保存文件
  const savedPath = await downloadExportFile(content, filename, format);

  if (savedPath) {
    console.log(`导出成功：${savedPath}`);
    return savedPath;
  }

  return null;
}

// 渲染导出选项面板
export function renderExportOptionsPanel(): string {
  return `
    <div class="export-panel">
      <div class="export-panel-header">
        <h3>📤 导出会话</h3>
      </div>
      <div class="export-panel-body">
        <div class="export-format-group">
          <label>导出格式</label>
          <div class="export-format-options">
            <label class="export-format-option">
              <input type="radio" name="export-format" value="markdown" checked>
              <span>Markdown (.md)</span>
            </label>
            <label class="export-format-option">
              <input type="radio" name="export-format" value="html">
              <span>HTML (.html)</span>
            </label>
            <label class="export-format-option">
              <input type="radio" name="export-format" value="json">
              <span>JSON (.json)</span>
            </label>
            <label class="export-format-option">
              <input type="radio" name="export-format" value="txt">
              <span>纯文本 (.txt)</span>
            </label>
          </div>
        </div>
        <div class="export-options-group">
          <label class="export-checkbox">
            <input type="checkbox" id="export-include-timestamps" checked>
            <span>包含时间戳</span>
          </label>
          <label class="export-checkbox">
            <input type="checkbox" id="export-include-tool-calls">
            <span>包含工具调用</span>
          </label>
          <label class="export-checkbox">
            <input type="checkbox" id="export-include-system">
            <span>包含系统消息</span>
          </label>
        </div>
      </div>
      <div class="export-panel-footer">
        <button type="button" class="btn-secondary export-cancel-btn">取消</button>
        <button type="button" class="btn-primary export-confirm-btn">导出</button>
      </div>
    </div>
  `;
}
