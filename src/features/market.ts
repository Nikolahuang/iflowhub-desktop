// src/features/market.ts - MCP 和 Agent 市场功能
import {
  installMcp,
  listInstalledMcp,
  installAgent,
  listInstalledAgents,
  getLocalMcpMarket,
  getLocalAgentMarket,
} from '../services/tauri';
import type {
  McpMarketItem,
  AgentMarketItem,
  MarketResponse,
} from '../types';
import { state } from '../store';
import { escapeHtml } from '../lib/html';

// 简单的通知函数（临时实现）
function showLoading(message: string): void {
  console.log('Loading:', message);
}

function hideLoading(): void {
  console.log('Loading complete');
}

function showSuccess(message: string): void {
  console.log('Success:', message);
  alert(message);
}

function showError(message: string): void {
  console.error('Error:', message);
  alert(message);
}

// 解析 MCP 市场响应
function parseMcpMarketResponse(response: MarketResponse): McpMarketItem[] {
  if (!response.success || !response.items) {
    return [];
  }

  // 检查是否是交互式响应（包含 message 字段）
  const items = response.items as unknown;
  
  // 如果是包含 message 的对象，说明是交互式命令
  if (typeof items === 'object' && items !== null && 'message' in items) {
    const obj = items as Record<string, unknown>;
    const message = obj.message as string | undefined;
    if (message) {
      showError(message);
    }
    return [];
  }

  // 否则尝试作为数组处理
  const itemsArray = items as unknown[];
  const result: McpMarketItem[] = [];
  
  for (const item of itemsArray) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const obj = item as Record<string, unknown>;
    const name = obj.name as string | undefined;
    const description = obj.description as string | undefined;
    const version = obj.version as string | undefined;
    const author = obj.author as string | undefined;
    const category = obj.category as string | undefined;
    const installed = Boolean(obj.installed);

    if (!name) {
      continue;
    }

    result.push({
      name,
      description: description || '',
      version,
      author,
      category,
      installed,
    });
  }
  
  return result;
}

// 显示市场说明
function showMarketInstructions(type: 'mcp' | 'agent'): void {
  const title = type === 'mcp' ? 'MCP 市场' : 'Agent 市场';
  const url = type === 'mcp' ? 'https://platform.iflow.cn/mcp' : 'https://platform.iflow.cn/agents';
  
  const message = `
${title} 使用说明：

1. 在 iFlow CLI 命令行界面中执行：
   - MCP: ${type === 'mcp' ? '/mcp online' : '/agents online'}

2. 使用上下箭头浏览，数字键安装

3. 或者访问 iFlow 开放平台：
   ${url}

当前版本需要通过 iFlow CLI 进行交互操作。
  `.trim();

  alert(message);
}

// 解析 Agent 市场响应
function parseAgentMarketResponse(response: MarketResponse): AgentMarketItem[] {
  if (!response.success || !response.items) {
    return [];
  }

  // 检查是否是交互式响应（包含 message 字段）
  const items = response.items as unknown;
  
  // 如果是包含 message 的对象，说明是交互式命令
  if (typeof items === 'object' && items !== null && 'message' in items) {
    const obj = items as Record<string, unknown>;
    const message = obj.message as string | undefined;
    if (message) {
      showError(message);
    }
    return [];
  }

  // 否则尝试作为数组处理
  const itemsArray = items as unknown[];
  const result: AgentMarketItem[] = [];
  
  for (const item of itemsArray) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const obj = item as Record<string, unknown>;
    const name = obj.name as string | undefined;
    const description = obj.description as string | undefined;
    const agentType = obj.agentType as string | undefined;
    const category = obj.category as string | undefined;
    const installed = Boolean(obj.installed);

    if (!name) {
      continue;
    }

    result.push({
      name,
      description: description || '',
      agentType,
      category,
      installed,
    });
  }
  
  return result;
}

// 浏览 MCP 市场（从本地数据文件读取）
export async function loadMcpMarket(): Promise<void> {
  showLoading('正在加载 MCP 市场...');

  try {
    const response = await getLocalMcpMarket();

    if (!response.success) {
      showError(response.error || '加载 MCP 市场失败');
      return;
    }

    const items = parseMcpMarketResponse(response);
    
    // 如果返回空列表，显示使用说明
    if (items.length === 0) {
      showMarketInstructions('mcp');
      state.mcpMarketItems = [];
      renderMcpMarket();
      return;
    }
    
    state.mcpMarketItems = items;
    renderMcpMarket();
    showSuccess(`成功加载 ${items.length} 个 MCP 工具`);
  } catch (error) {
    console.error('Load MCP market error:', error);
    showError(`加载 MCP 市场失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 安装 MCP
export async function installMcpItem(name: string): Promise<void> {
  if (!state.currentAgentId) {
    showError('请先连接一个 Agent');
    return;
  }

  showLoading(`正在安装 ${name}...`);

  try {
    const response = await installMcp(state.currentAgentId, name);

    if (!response.success) {
      showError(response.error || '安装失败');
      return;
    }

    showSuccess(response.message || `${name} 安装成功`);
    // 重新加载市场列表
    await loadMcpMarket();
  } catch (error) {
    console.error('Install MCP error:', error);
    showError(`安装失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 列出已安装的 MCP
export async function loadInstalledMcp(): Promise<void> {
  if (!state.currentAgentId) {
    showError('请先连接一个 Agent');
    return;
  }

  showLoading('正在加载已安装的 MCP...');

  try {
    const response = await listInstalledMcp(state.currentAgentId);

    if (!response.success) {
      showError(response.error || '加载失败');
      return;
    }

    const items = parseMcpMarketResponse(response);
    state.installedMcpItems = items;

    renderInstalledMcp();
  } catch (error) {
    console.error('Load installed MCP error:', error);
    showError(`加载失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 浏览 Agent 市场（从本地数据文件读取）
export async function loadAgentMarket(): Promise<void> {
  showLoading('正在加载 Agent 市场...');

  try {
    const response = await getLocalAgentMarket();

    if (!response.success) {
      showError(response.error || '加载 Agent 市场失败');
      return;
    }

    const items = parseAgentMarketResponse(response);
    
    // 如果返回空列表，显示使用说明
    if (items.length === 0) {
      showMarketInstructions('agent');
      state.agentMarketItems = [];
      renderAgentMarket();
      return;
    }
    
    state.agentMarketItems = items;
    renderAgentMarket();
    showSuccess(`成功加载 ${items.length} 个 Agent`);
  } catch (error) {
    console.error('Load agent market error:', error);
    showError(`加载 Agent 市场失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 安装 Agent
export async function installAgentItem(name: string): Promise<void> {
  if (!state.currentAgentId) {
    showError('请先连接一个 Agent');
    return;
  }

  showLoading(`正在安装 ${name}...`);

  try {
    const response = await installAgent(state.currentAgentId, name);

    if (!response.success) {
      showError(response.error || '安装失败');
      return;
    }

    showSuccess(response.message || `${name} 安装成功`);
    // 重新加载市场列表
    await loadAgentMarket();
  } catch (error) {
    console.error('Install agent error:', error);
    showError(`安装失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 列出已安装的 Agent
export async function loadInstalledAgents(): Promise<void> {
  if (!state.currentAgentId) {
    showError('请先连接一个 Agent');
    return;
  }

  showLoading('正在加载已安装的 Agent...');

  try {
    const response = await listInstalledAgents(state.currentAgentId);

    if (!response.success) {
      showError(response.error || '加载失败');
      return;
    }

    const items = parseAgentMarketResponse(response);
    state.installedAgentItems = items;

    renderInstalledAgents();
  } catch (error) {
    console.error('Load installed agents error:', error);
    showError(`加载失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 渲染 MCP 市场
export function renderMcpMarket(): void {
  const container = document.getElementById('mcp-market-container');
  if (!container) {
    return;
  }

  if (state.mcpMarketItems.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <div class="market-empty-icon">🛒</div>
        <h3>MCP 市场</h3>
        <p>暂无可用的 MCP 工具</p>
        <a href="https://platform.iflow.cn/mcp" target="_blank" class="market-link">
          🌐 访问 iFlow MCP 市场
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = state.mcpMarketItems
    .map(
      (item) => `
    <div class="market-item ${item.installed ? 'installed' : ''}">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        ${item.installed ? '<span class="market-item-badge installed">已安装</span>' : ''}
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
      <div class="market-item-meta-row">
        ${item.category ? `<span class="market-item-tag">${escapeHtml(item.category)}</span>` : ''}
        ${item.author ? `<span class="market-item-meta">作者: ${escapeHtml(item.author)}</span>` : ''}
      </div>
      <button
        class="market-item-install-btn"
        data-mcp-name="${escapeHtml(item.name)}"
        ${item.installed ? 'disabled' : ''}
      >
        ${item.installed ? '已安装' : '安装'}
      </button>
    </div>
  `
    )
    .join('');
}

// 渲染已安装的 MCP
export function renderInstalledMcp(): void {
  const container = document.getElementById('installed-mcp-container');
  if (!container) {
    return;
  }

  if (state.installedMcpItems.length === 0) {
    container.innerHTML = '<div class="market-empty">暂无已安装的 MCP 工具</div>';
    return;
  }

  container.innerHTML = state.installedMcpItems
    .map(
      (item) => `
    <div class="market-item installed">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        <span class="market-item-badge installed">已安装</span>
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
    </div>
  `
    )
    .join('');
}

// 渲染 Agent 市场
export function renderAgentMarket(): void {
  const container = document.getElementById('agent-market-container');
  if (!container) {
    return;
  }

  if (state.agentMarketItems.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <div class="market-empty-icon">🤖</div>
        <h3>Agent 市场</h3>
        <p>暂无可用的 Agent</p>
        <a href="https://platform.iflow.cn/agents" target="_blank" class="market-link">
          🌐 访问 iFlow Agent 市场
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = state.agentMarketItems
    .map(
      (item) => `
    <div class="market-item ${item.installed ? 'installed' : ''}">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        ${item.installed ? '<span class="market-item-badge installed">已安装</span>' : ''}
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
      <div class="market-item-meta-row">
        ${item.agentType ? `<span class="market-item-tag">${escapeHtml(item.agentType)}</span>` : ''}
        ${item.category ? `<span class="market-item-tag">${escapeHtml(item.category)}</span>` : ''}
      </div>
      <button
        class="market-item-install-btn"
        data-agent-name="${escapeHtml(item.name)}"
        ${item.installed ? 'disabled' : ''}
      >
        ${item.installed ? '已安装' : '安装'}
      </button>
    </div>
  `
    )
    .join('');
}

// 渲染已安装的 Agent
export function renderInstalledAgents(): void {
  const container = document.getElementById('installed-agents-container');
  if (!container) {
    return;
  }

  if (state.installedAgentItems.length === 0) {
    container.innerHTML = '<div class="market-empty">暂无已安装的 Agent</div>';
    return;
  }

  container.innerHTML = state.installedAgentItems
    .map(
      (item) => `
    <div class="market-item installed">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        <span class="market-item-badge installed">已安装</span>
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
    </div>
  `
    )
    .join('');
}

// 处理 MCP 市场点击事件
export function handleMcpMarketClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const installBtn = target.closest('button[data-mcp-name]') as HTMLButtonElement | null;

  if (installBtn?.dataset.mcpName) {
    event.preventDefault();
    event.stopPropagation();
    void installMcpItem(installBtn.dataset.mcpName);
  }
}

// 处理 Agent 市场点击事件
export function handleAgentMarketClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const installBtn = target.closest('button[data-agent-name]') as HTMLButtonElement | null;

  if (installBtn?.dataset.agentName) {
    event.preventDefault();
    event.stopPropagation();
    void installAgentItem(installBtn.dataset.agentName);
  }
}

// 初始化市场功能
export function initMarket(): void {
  // MCP 市场按钮
  document.getElementById('open-mcp-market-btn')?.addEventListener('click', () => {
    document.getElementById('mcp-market-modal')?.classList.remove('hidden');
    // 自动加载市场（无需连接 Agent）
    void loadMcpMarket();
  });

  // 关闭 MCP 市场弹窗
  document.getElementById('close-mcp-market-modal')?.addEventListener('click', () => {
    document.getElementById('mcp-market-modal')?.classList.add('hidden');
  });

  // 刷新 MCP 市场
  document.getElementById('refresh-mcp-market-btn')?.addEventListener('click', () => {
    void loadMcpMarket();
  });

  // 刷新已安装的 MCP
  document.getElementById('refresh-installed-mcp-btn')?.addEventListener('click', () => {
    if (!state.currentAgentId) {
      showError('请先连接一个 Agent');
      return;
    }
    void loadInstalledMcp();
  });

  // MCP 市场容器点击事件
  document.getElementById('mcp-market-container')?.addEventListener('click', handleMcpMarketClick);

  // Agent 市场按钮
  document.getElementById('open-agent-market-btn')?.addEventListener('click', () => {
    document.getElementById('agent-market-modal')?.classList.remove('hidden');
    // 自动加载市场（无需连接 Agent）
    void loadAgentMarket();
  });

  // 关闭 Agent 市场弹窗
  document.getElementById('close-agent-market-modal')?.addEventListener('click', () => {
    document.getElementById('agent-market-modal')?.classList.add('hidden');
  });

  // 刷新 Agent 市场
  document.getElementById('refresh-agent-market-btn')?.addEventListener('click', () => {
    void loadAgentMarket();
  });

  // 刷新已安装的 Agent
  document.getElementById('refresh-installed-agent-btn')?.addEventListener('click', () => {
    if (!state.currentAgentId) {
      showError('请先连接一个 Agent');
      return;
    }
    void loadInstalledAgents();
  });

  // Agent 市场容器点击事件
  document.getElementById('agent-market-container')?.addEventListener('click', handleAgentMarketClick);

  // 标签页切换（MCP 市场）
  document.querySelectorAll('#mcp-market-modal .modal-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.dataset.tab;
      if (!tabName) return;

      // 切换标签样式
      document.querySelectorAll('#mcp-market-modal .modal-tab').forEach((t) => {
        t.classList.remove('active');
      });
      target.classList.add('active');

      // 切换内容显示
      document.querySelectorAll('#mcp-market-modal .market-tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      const targetContent = document.getElementById(`${tabName}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // 加载对应的数据
      if (tabName === 'mcp-market') {
        void loadMcpMarket();
      } else if (tabName === 'mcp-installed') {
        if (!state.currentAgentId) {
          showError('请先连接一个 Agent 以查看已安装的 MCP');
          return;
        }
        void loadInstalledMcp();
      }
    });
  });

  // 标签页切换（Agent 市场）
  document.querySelectorAll('#agent-market-modal .modal-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.dataset.tab;
      if (!tabName) return;

      // 切换标签样式
      document.querySelectorAll('#agent-market-modal .modal-tab').forEach((t) => {
        t.classList.remove('active');
      });
      target.classList.add('active');

      // 切换内容显示
      document.querySelectorAll('#agent-market-modal .market-tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      const targetContent = document.getElementById(`${tabName}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // 加载对应的数据
      if (tabName === 'agent-market') {
        void loadAgentMarket();
      } else if (tabName === 'agent-installed') {
        if (!state.currentAgentId) {
          showError('请先连接一个 Agent 以查看已安装的 Agent');
          return;
        }
        void loadInstalledAgents();
      }
    });
  });
}