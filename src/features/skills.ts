// src/features/skills.ts - Skills 市场功能
import {
  searchSkills,
  listInstalledSkills,
  installSkillApi,
  getPopularSkills,
  uploadSkill,
  uninstallSkill,
} from '../services/tauri';
import type { SkillItem, SkillSearchResponse } from '../types';
import { state } from '../store';
import { escapeHtml } from '../lib/html';

// 简单的通知函数
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

// 解析 Skills 搜索响应
function parseSkillSearchResponse(response: SkillSearchResponse): SkillItem[] {
  if (!response.success || !response.items) {
    return [];
  }

  return response.items;
}

// 获取当前工作空间路径
function getCurrentWorkspacePath(): string | null {
  if (state.currentAgentId) {
    const agent = state.agents.find(a => a.id === state.currentAgentId);
    if (agent?.workspacePath) {
      return agent.workspacePath;
    }
  }
  return null;
}

// 加载热门 Skills
export async function loadPopularSkills(): Promise<void> {
  showLoading('正在加载热门 Skills...');

  try {
    const response = await getPopularSkills();

    if (!response.success) {
      showError(response.error || '加载 Skills 失败');
      return;
    }

    const items = parseSkillSearchResponse(response);
    state.skillItems = items;
    renderSkillMarket();
    
    if (items.length > 0) {
      showSuccess(`成功加载 ${items.length} 个 Skills`);
    }
  } catch (error) {
    console.error('Load popular skills error:', error);
    showError(`加载 Skills 失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 搜索 Skills
export async function searchSkillItems(query: string): Promise<void> {
  if (!query.trim()) {
    await loadPopularSkills();
    return;
  }

  showLoading(`正在搜索 "${query}"...`);

  try {
    const response = await searchSkills(query);

    if (!response.success) {
      showError(response.error || '搜索 Skills 失败');
      return;
    }

    const items = parseSkillSearchResponse(response);
    state.skillItems = items;
    state.skillSearchQuery = query;
    state.skillSearchResults = items;
    renderSkillMarket();
    
    if (items.length === 0) {
      showSuccess('未找到匹配的 Skills');
    } else {
      showSuccess(`找到 ${items.length} 个匹配的 Skills`);
    }
  } catch (error) {
    console.error('Search skills error:', error);
    showError(`搜索失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 安装 Skill
export async function installSkillItem(skill: SkillItem): Promise<void> {
  const workspacePath = getCurrentWorkspacePath();
  if (!workspacePath) {
    showError('请先连接一个 Agent');
    return;
  }

  showLoading(`正在安装 ${skill.name}...`);

  try {
    const response = await installSkillApi(
      workspacePath,
      skill.repoUrl || '',
      skill.path || '',
      skill.name
    );

    if (!response.success) {
      showError(response.error || '安装失败');
      return;
    }

    showSuccess(`${skill.name} 安装成功！请重启 Agent 以激活此 Skill。`);
    
    // 重新加载已安装列表
    await loadInstalledSkills();
    // 更新市场列表中的安装状态
    state.skillItems = state.skillItems.map(item => 
      item.name === skill.name ? { ...item, installed: true } : item
    );
    renderSkillMarket();
  } catch (error) {
    console.error('Install skill error:', error);
    showError(`安装失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 加载已安装的 Skills
export async function loadInstalledSkills(): Promise<void> {
  const workspacePath = getCurrentWorkspacePath();
  
  if (!workspacePath) {
    state.installedSkills = [];
    renderInstalledSkills();
    return;
  }

  showLoading('正在加载已安装的 Skills...');

  try {
    const response = await listInstalledSkills(workspacePath);

    if (!response.success) {
      showError(response.error || '加载失败');
      return;
    }

    const items = parseSkillSearchResponse(response);
    state.installedSkills = items;
    renderInstalledSkills();
  } catch (error) {
    console.error('Load installed skills error:', error);
    showError(`加载失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 渲染 Skills 市场
export function renderSkillMarket(): void {
  const container = document.getElementById('skill-market-container');
  if (!container) {
    return;
  }

  if (state.skillItems.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <div class="market-empty-icon">🎯</div>
        <h3>Skills 市场</h3>
        <p>搜索或浏览可用的 Skills</p>
        <div class="market-instructions">
          <strong>什么是 Skills？</strong>
          <p>Skills 是可扩展的能力模块，可以为 Agent 添加特定功能和专业知识。</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.skillItems
    .map(
      (item) => `
    <div class="market-item ${item.installed ? 'installed' : ''}">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        ${item.installed ? '<span class="market-item-badge installed">已安装</span>' : ''}
        ${item.category ? `<span class="skill-tag">${escapeHtml(item.category)}</span>` : ''}
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
      ${item.author ? `<div class="market-item-meta">作者: ${escapeHtml(item.author)}</div>` : ''}
      ${item.stars !== undefined ? `<div class="market-item-meta">⭐ ${item.stars} stars</div>` : ''}
      <div class="skill-actions">
        <button
          class="market-item-install-btn"
          data-skill-name="${escapeHtml(item.name)}"
          data-skill-repo="${escapeHtml(item.repoUrl || '')}"
          data-skill-path="${escapeHtml(item.path || '')}"
          ${item.installed ? 'disabled' : ''}
        >
          ${item.installed ? '已安装' : '安装'}
        </button>
        ${item.repoUrl ? `<a href="${escapeHtml(item.repoUrl)}" target="_blank" class="skill-repo-link">
          查看仓库
        </a>` : ''}
      </div>
    </div>
  `
    )
    .join('');
}

// 渲染已安装的 Skills
export function renderInstalledSkills(): void {
  const container = document.getElementById('installed-skills-container');
  if (!container) {
    return;
  }

  // 构建提示信息
  const activationHint = `
    <div class="skill-activation-hint">
      <div class="hint-icon">💡</div>
      <div class="hint-content">
        <strong>如何激活 Skills</strong>
        <p>Skills 已安装到工作空间，需要在 Agent 启动时加载。请<span class="hint-highlight">断开并重新连接 Agent</span>以激活新安装的 Skills。</p>
        <p class="hint-note">激活后，在对话中输入相关问题，智能体会自动使用对应的 Skill。</p>
      </div>
    </div>
  `;

  if (state.installedSkills.length === 0) {
    container.innerHTML = `
      <div class="market-empty">
        <div class="market-empty-icon">🎯</div>
        <p>暂无已安装的 Skills</p>
        <p class="market-empty-hint">从"市场"标签页安装或"上传"本地 SKILL.md 文件</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activationHint + state.installedSkills
    .map(
      (item) => `
    <div class="market-item installed">
      <div class="market-item-header">
        <h3 class="market-item-name">${escapeHtml(item.name)}</h3>
        <span class="market-item-badge installed">已安装</span>
      </div>
      <p class="market-item-description">${escapeHtml(item.description)}</p>
      ${item.path ? `<div class="market-item-meta">路径: <code>${escapeHtml(item.path)}</code></div>` : ''}
      <div class="skill-actions">
        <button class="btn-danger btn-sm" data-uninstall-skill="${escapeHtml(item.name)}">卸载</button>
      </div>
    </div>
  `
    )
    .join('');
}

// 处理 Skills 市场点击事件
export function handleSkillMarketClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const installBtn = target.closest('button[data-skill-name]') as HTMLButtonElement | null;

  if (installBtn?.dataset.skillName) {
    event.preventDefault();
    event.stopPropagation();
    
    const skill = state.skillItems.find(s => s.name === installBtn.dataset.skillName);
    if (skill) {
      void installSkillItem(skill);
    }
  }
}

// 处理已安装 Skills 点击事件（卸载）
export function handleInstalledSkillsClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const uninstallBtn = target.closest('button[data-uninstall-skill]') as HTMLButtonElement | null;

  if (uninstallBtn?.dataset.uninstallSkill) {
    event.preventDefault();
    event.stopPropagation();
    
    const skill = state.installedSkills.find(s => s.name === uninstallBtn.dataset.uninstallSkill);
    if (skill) {
      void uninstallSkillItem(skill);
    }
  }
}

// 卸载已安装的 Skill
export async function uninstallSkillItem(skill: SkillItem): Promise<void> {
  const workspacePath = getCurrentWorkspacePath();
  if (!workspacePath) {
    showError('请先连接一个 Agent');
    return;
  }

  // 确认卸载
  if (!confirm(`确定要卸载 Skill "${skill.name}" 吗？`)) {
    return;
  }

  showLoading(`正在卸载 ${skill.name}...`);

  try {
    const response = await uninstallSkill(workspacePath, skill.name);

    if (!response.success) {
      showError(response.error || '卸载失败');
      return;
    }

    showSuccess(`${skill.name} 已卸载`);
    
    // 重新加载已安装列表
    await loadInstalledSkills();
    // 更新市场列表中的安装状态
    state.skillItems = state.skillItems.map(item => 
      item.name === skill.name ? { ...item, installed: false } : item
    );
    renderSkillMarket();
  } catch (error) {
    console.error('Uninstall skill error:', error);
    showError(`卸载失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 上传本地 Skill 文件
export async function uploadSkillFile(file: File): Promise<void> {
  const workspacePath = getCurrentWorkspacePath();
  if (!workspacePath) {
    showError('请先连接一个 Agent');
    return;
  }

  // 验证文件类型
  if (!file.name.endsWith('.md')) {
    showError('只支持 .md 格式的文件');
    return;
  }

  showLoading(`正在上传 ${file.name}...`);

  try {
    // 读取文件内容
    const content = await file.text();
    
    // 从文件名提取 skill 名称（去掉 .md 后缀）
    const skillName = file.name.replace(/\.md$/i, '').replace(/SKILL$/i, '').trim() || 'custom-skill';

    const response = await uploadSkill(workspacePath, skillName, content);

    if (!response.success) {
      showError(response.error || '上传失败');
      return;
    }

    showSuccess(`${skillName} 上传成功！请重启 Agent 以激活此 Skill。`);
    
    // 重新加载已安装列表
    await loadInstalledSkills();
    // 切换到已安装标签
    const installedTab = document.querySelector('#skills-market-modal .modal-tab[data-tab="skills-installed"]') as HTMLElement;
    installedTab?.click();
  } catch (error) {
    console.error('Upload skill error:', error);
    showError(`上传失败: ${String(error)}`);
  } finally {
    hideLoading();
  }
}

// 初始化 Skills 市场功能
export function initSkillsMarket(): void {
  // Skills 市场按钮
  document.getElementById('open-skills-market-btn')?.addEventListener('click', () => {
    document.getElementById('skills-market-modal')?.classList.remove('hidden');
    // 自动加载热门 Skills
    void loadPopularSkills();
  });

  // 关闭 Skills 市场弹窗
  document.getElementById('close-skills-market-modal')?.addEventListener('click', () => {
    document.getElementById('skills-market-modal')?.classList.add('hidden');
  });

  // 刷新 Skills 市场
  document.getElementById('refresh-skills-market-btn')?.addEventListener('click', () => {
    const searchInput = document.getElementById('skill-search-input') as HTMLInputElement;
    const query = searchInput?.value || '';
    void searchSkillItems(query);
  });

  // 刷新已安装的 Skills
  document.getElementById('refresh-installed-skills-btn')?.addEventListener('click', () => {
    void loadInstalledSkills();
  });

  // Skills 市场容器点击事件
  document.getElementById('skill-market-container')?.addEventListener('click', handleSkillMarketClick);

  // 已安装 Skills 容器点击事件（卸载）
  document.getElementById('installed-skills-container')?.addEventListener('click', handleInstalledSkillsClick);

  // 搜索框回车事件
  const searchInput = document.getElementById('skill-search-input') as HTMLInputElement;
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      void searchSkillItems(searchInput.value);
    }
  });

  // 标签页切换（Skills 市场）
  document.querySelectorAll('#skills-market-modal .modal-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.dataset.tab;
      if (!tabName) return;

      // 切换标签样式
      document.querySelectorAll('#skills-market-modal .modal-tab').forEach((t) => {
        t.classList.remove('active');
      });
      target.classList.add('active');

      // 切换内容显示
      document.querySelectorAll('#skills-market-modal .market-tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      const targetContent = document.getElementById(`${tabName}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // 加载对应的数据
      if (tabName === 'skills-market') {
        void loadPopularSkills();
      } else if (tabName === 'skills-installed') {
        void loadInstalledSkills();
      } else if (tabName === 'skills-upload') {
        // 上传标签页不需要加载数据
      }
    });
  });

  // 文件上传按钮
  const uploadInput = document.getElementById('skill-upload-input') as HTMLInputElement;
  uploadInput?.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      void uploadSkillFile(files[0]);
      // 清空 input 以便重复上传同一文件
      uploadInput.value = '';
    }
  });

  // 拖拽上传支持
  const dropZone = document.getElementById('skill-upload-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = (e as DragEvent).dataTransfer?.files;
      if (files && files.length > 0) {
        void uploadSkillFile(files[0]);
      }
    });
  }
}