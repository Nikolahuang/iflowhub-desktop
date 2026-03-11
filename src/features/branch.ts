/**
 * 对话分支功能
 * 类似 Git 分支，可从历史消息分叉出新对话
 */

import type { Message } from '../types';

export interface ConversationBranch {
  id: string;
  name: string;
  parentMessageId?: string;
  parentBranchId?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface BranchStore {
  branches: Record<string, ConversationBranch>;
  rootBranchId: string;
}

const STORAGE_KEY_PREFIX = 'iflow-branches-';

class BranchManager {
  private store: BranchStore | null = null;
  private currentBranchId: string = '';
  private agentId: string = '';
  private modalEl: HTMLElement | null = null;

  /**
   * 初始化分支管理器
   */
  init(agentId: string): void {
    this.agentId = agentId;
    this.load();
    
    // 如果没有当前分支，创建根分支
    if (!this.currentBranchId && this.store) {
      this.currentBranchId = this.store.rootBranchId;
    }
  }

  /**
   * 从存储加载分支数据
   */
  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + this.agentId);
      if (data) {
        this.store = JSON.parse(data);
      } else {
        // 创建新的分支存储
        const rootId = this.generateId();
        this.store = {
          branches: {
            [rootId]: {
              id: rootId,
              name: '主分支',
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          },
          rootBranchId: rootId,
        };
        this.currentBranchId = rootId;
        this.save();
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
      this.createDefaultStore();
    }
  }

  /**
   * 创建默认存储
   */
  private createDefaultStore(): void {
    const rootId = this.generateId();
    this.store = {
      branches: {
        [rootId]: {
          id: rootId,
          name: '主分支',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      },
      rootBranchId: rootId,
    };
    this.currentBranchId = rootId;
  }

  /**
   * 保存分支数据
   */
  private save(): void {
    if (!this.store) return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + this.agentId, JSON.stringify(this.store));
    } catch (e) {
      console.error('Failed to save branches:', e);
    }
  }

  /**
   * 获取当前分支
   */
  getCurrentBranch(): ConversationBranch | null {
    if (!this.store || !this.currentBranchId) return null;
    return this.store.branches[this.currentBranchId] || null;
  }

  /**
   * 获取所有分支
   */
  getAllBranches(): ConversationBranch[] {
    if (!this.store) return [];
    return Object.values(this.store.branches).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 切换分支
   */
  switchBranch(branchId: string): Message[] {
    if (!this.store || !this.store.branches[branchId]) {
      return [];
    }
    
    this.currentBranchId = branchId;
    return this.store.branches[branchId].messages;
  }

  /**
   * 从指定消息创建新分支
   */
  createBranchFromMessage(messageId: string, name?: string): ConversationBranch | null {
    if (!this.store) return null;

    const currentBranch = this.getCurrentBranch();
    if (!currentBranch) return null;

    // 找到分支点
    const messageIndex = currentBranch.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;

    // 创建新分支
    const newBranchId = this.generateId();
    const newBranch: ConversationBranch = {
      id: newBranchId,
      name: name || `分支 ${Object.keys(this.store.branches).length}`,
      parentMessageId: messageId,
      parentBranchId: this.currentBranchId,
      messages: currentBranch.messages.slice(0, messageIndex + 1),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.store.branches[newBranchId] = newBranch;
    this.currentBranchId = newBranchId;
    this.save();

    this.dispatchEvent('branch-created', newBranch);
    return newBranch;
  }

  /**
   * 创建空分支
   */
  createEmptyBranch(name?: string): ConversationBranch | null {
    if (!this.store) return null;

    const newBranchId = this.generateId();
    const newBranch: ConversationBranch = {
      id: newBranchId,
      name: name || `新分支 ${Object.keys(this.store.branches).length}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.store.branches[newBranchId] = newBranch;
    this.currentBranchId = newBranchId;
    this.save();

    this.dispatchEvent('branch-created', newBranch);
    return newBranch;
  }

  /**
   * 删除分支
   */
  deleteBranch(branchId: string): boolean {
    if (!this.store) return false;
    
    // 不能删除根分支
    if (branchId === this.store.rootBranchId) {
      return false;
    }

    delete this.store.branches[branchId];

    // 如果删除的是当前分支，切换到根分支
    if (this.currentBranchId === branchId) {
      this.currentBranchId = this.store.rootBranchId;
    }

    this.save();
    this.dispatchEvent('branch-deleted', branchId);
    return true;
  }

  /**
   * 重命名分支
   */
  renameBranch(branchId: string, name: string): boolean {
    if (!this.store || !this.store.branches[branchId]) return false;
    
    this.store.branches[branchId].name = name;
    this.save();
    this.dispatchEvent('branch-updated', this.store.branches[branchId]);
    return true;
  }

  /**
   * 更新当前分支的消息
   */
  updateCurrentMessages(messages: Message[]): void {
    if (!this.store || !this.currentBranchId) return;
    
    const branch = this.store.branches[this.currentBranchId];
    if (branch) {
      branch.messages = messages;
      branch.updatedAt = Date.now();
      this.save();
    }
  }

  /**
   * 获取分支历史树
   */
  getBranchTree(): BranchTreeNode[] {
    if (!this.store) return [];

    const buildTree = (branchId: string, depth: number): BranchTreeNode[] => {
      const branch = this.store!.branches[branchId];
      if (!branch) return [];

      const node: BranchTreeNode = {
        branch,
        depth,
        children: [],
      };

      // 找到以当前分支为父分支的子分支
      Object.values(this.store!.branches)
        .filter(b => b.parentBranchId === branchId)
        .forEach(childBranch => {
          node.children.push(...buildTree(childBranch.id, depth + 1));
        });

      return [node];
    };

    return buildTree(this.store.rootBranchId, 0);
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 派发事件
   */
  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * 创建分支管理弹窗
   */
  createModal(): HTMLElement {
    if (this.modalEl) return this.modalEl;

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'branch-modal';
    this.modalEl.className = 'modal hidden';
    this.modalEl.innerHTML = `
      <div class="modal-content branch-modal-content">
        <div class="modal-header">
          <h3>🌳 对话分支</h3>
          <button class="btn-icon close-branch-modal" aria-label="关闭">×</button>
        </div>
        <div class="branch-toolbar">
          <button class="btn-primary btn-compact create-branch-btn">+ 新建分支</button>
        </div>
        <div class="modal-body branch-modal-body">
          <div class="branch-tree"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // 绑定事件
    this.modalEl.querySelector('.close-branch-modal')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });

    this.modalEl.querySelector('.create-branch-btn')?.addEventListener('click', () => {
      const name = prompt('分支名称:', `分支 ${this.getAllBranches().length + 1}`);
      if (name) {
        this.createEmptyBranch(name);
        this.renderTree();
      }
    });

    return this.modalEl;
  }

  /**
   * 渲染分支树
   */
  private renderTree(): void {
    const treeEl = this.modalEl?.querySelector('.branch-tree');
    if (!treeEl || !this.store) return;

    const branches = this.getAllBranches();
    
    if (branches.length === 0) {
      treeEl.innerHTML = `
        <div class="branch-empty">
          <p>暂无分支</p>
        </div>
      `;
      return;
    }

    treeEl.innerHTML = branches.map(branch => {
      const isCurrent = branch.id === this.currentBranchId;
      const isRoot = branch.id === this.store!.rootBranchId;
      const messageCount = branch.messages.length;
      
      return `
        <div class="branch-item ${isCurrent ? 'current' : ''}" data-id="${branch.id}">
          <div class="branch-icon">${isRoot ? '🏠' : '🌿'}</div>
          <div class="branch-info">
            <div class="branch-name">${this.escapeHtml(branch.name)}</div>
            <div class="branch-meta">
              <span>${messageCount} 条消息</span>
              <span>·</span>
              <span>${this.formatTime(branch.updatedAt)}</span>
            </div>
          </div>
          <div class="branch-actions">
            ${isCurrent ? '<span class="branch-current-badge">当前</span>' : `
              <button class="branch-action-btn switch-branch" title="切换到此分支">切换</button>
            `}
            ${!isRoot ? `<button class="branch-action-btn delete-branch danger" title="删除分支">🗑️</button>` : ''}
            <button class="branch-action-btn rename-branch" title="重命名">✏️</button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定事件
    treeEl.querySelectorAll('.branch-item').forEach(itemEl => {
      const id = itemEl.getAttribute('data-id') || '';
      const branch = branches.find(b => b.id === id);
      if (!branch) return;

      itemEl.querySelector('.switch-branch')?.addEventListener('click', () => {
        const messages = this.switchBranch(id);
        this.dispatchEvent('branch-switched', { branchId: id, messages });
        this.renderTree();
      });

      itemEl.querySelector('.delete-branch')?.addEventListener('click', () => {
        if (confirm('确定要删除此分支吗？')) {
          this.deleteBranch(id);
          this.renderTree();
        }
      });

      itemEl.querySelector('.rename-branch')?.addEventListener('click', () => {
        const name = prompt('新名称:', branch.name);
        if (name) {
          this.renameBranch(id, name);
          this.renderTree();
        }
      });
    });
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * HTML 转义
   */
  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 打开分支弹窗
   */
  openModal(): void {
    if (!this.modalEl) {
      this.createModal();
    }
    this.renderTree();
    this.modalEl?.classList.remove('hidden');
  }

  /**
   * 关闭分支弹窗
   */
  closeModal(): void {
    this.modalEl?.classList.add('hidden');
  }

  /**
   * 切换分支弹窗
   */
  toggleModal(): void {
    if (this.modalEl?.classList.contains('hidden')) {
      this.openModal();
    } else {
      this.closeModal();
    }
  }

  /**
   * 获取当前分支 ID
   */
  getCurrentBranchId(): string {
    return this.currentBranchId;
  }
}

export interface BranchTreeNode {
  branch: ConversationBranch;
  depth: number;
  children: BranchTreeNode[];
}

// 导出单例
export const branchManager = new BranchManager();

/**
 * 初始化分支样式
 */
export function initBranchStyles(): void {
  if (document.getElementById('branch-styles')) return;

  const style = document.createElement('style');
  style.id = 'branch-styles';
  style.textContent = `
    /* 分支弹窗样式 */
    .branch-modal-content {
      width: min(600px, 90vw);
      height: min(70vh, 500px);
      display: flex;
      flex-direction: column;
    }

    .branch-toolbar {
      display: flex;
      justify-content: flex-end;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .branch-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .branch-empty {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .branch-tree {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .branch-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all 0.2s;
    }

    .branch-item:hover {
      border-color: var(--accent-color);
    }

    .branch-item.current {
      border-color: var(--success-color);
      background: rgba(35, 134, 54, 0.08);
    }

    .branch-icon {
      font-size: 20px;
    }

    .branch-info {
      flex: 1;
      min-width: 0;
    }

    .branch-name {
      font-weight: 500;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .branch-meta {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      gap: 6px;
    }

    .branch-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .branch-current-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--success-color);
      color: white;
    }

    .branch-action-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .branch-action-btn:hover {
      border-color: var(--accent-color);
      background: rgba(47, 129, 247, 0.1);
    }

    .branch-action-btn.danger:hover {
      border-color: var(--error-color);
      background: rgba(248, 81, 73, 0.1);
      color: #f85149;
    }

    /* 消息分支按钮 */
    .message-branch-btn {
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    }

    .message-branch-btn:hover {
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
  `;

  document.head.appendChild(style);
}
