/**
 * 智能收藏夹功能
 * 支持收藏重要对话片段，标签分类，快速检索
 */

export interface FavoriteItem {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  summary: string;
  tags: string[];
  createdAt: number;
  messageType: 'user' | 'assistant';
  sessionId?: string;
}

interface FavoritesStore {
  items: FavoriteItem[];
  tags: string[];
}

const STORAGE_KEY = 'iflow-favorites';

class FavoritesManager {
  private store: FavoritesStore = { items: [], tags: [] };
  private modalEl: HTMLElement | null = null;

  constructor() {
    this.load();
  }

  /**
   * 从存储加载收藏数据
   */
  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.store = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  }

  /**
   * 保存收藏数据到存储
   */
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }

  /**
   * 添加收藏
   */
  add(item: Omit<FavoriteItem, 'id' | 'createdAt'>): FavoriteItem {
    const newItem: FavoriteItem = {
      ...item,
      id: this.generateId(),
      createdAt: Date.now(),
    };

    this.store.items.unshift(newItem);

    // 添加新标签
    item.tags.forEach(tag => {
      if (!this.store.tags.includes(tag)) {
        this.store.tags.push(tag);
      }
    });

    this.save();
    this.dispatchEvent('favorite-added', newItem);
    return newItem;
  }

  /**
   * 删除收藏
   */
  remove(id: string): void {
    const index = this.store.items.findIndex(item => item.id === id);
    if (index !== -1) {
      const removed = this.store.items.splice(index, 1)[0];
      this.save();
      this.dispatchEvent('favorite-removed', removed);
    }
  }

  /**
   * 更新收藏
   */
  update(id: string, updates: Partial<FavoriteItem>): void {
    const item = this.store.items.find(i => i.id === id);
    if (item) {
      Object.assign(item, updates);
      
      // 更新标签列表
      if (updates.tags) {
        updates.tags.forEach(tag => {
          if (!this.store.tags.includes(tag)) {
            this.store.tags.push(tag);
          }
        });
      }
      
      this.save();
      this.dispatchEvent('favorite-updated', item);
    }
  }

  /**
   * 获取所有收藏
   */
  getAll(): FavoriteItem[] {
    return [...this.store.items];
  }

  /**
   * 按标签筛选
   */
  getByTag(tag: string): FavoriteItem[] {
    return this.store.items.filter(item => item.tags.includes(tag));
  }

  /**
   * 搜索收藏
   */
  search(query: string): FavoriteItem[] {
    const q = query.toLowerCase();
    return this.store.items.filter(item =>
      item.content.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /**
   * 获取所有标签
   */
  getTags(): string[] {
    return [...this.store.tags];
  }

  /**
   * 按标签分组统计
   */
  getTagStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.store.items.forEach(item => {
      item.tags.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });
    });
    return stats;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 派发事件
   */
  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * 创建收藏弹窗 UI
   */
  createModal(): HTMLElement {
    if (this.modalEl) return this.modalEl;

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'favorites-modal';
    this.modalEl.className = 'modal hidden';
    this.modalEl.innerHTML = `
      <div class="modal-content favorites-modal-content">
        <div class="modal-header">
          <h3>⭐ 收藏夹</h3>
          <button class="btn-icon close-favorites-modal" aria-label="关闭">×</button>
        </div>
        <div class="favorites-toolbar">
          <input type="text" class="favorites-search-input" placeholder="搜索收藏..." />
          <div class="favorites-tags-filter"></div>
        </div>
        <div class="modal-body favorites-modal-body">
          <div class="favorites-list"></div>
        </div>
        <div class="favorites-footer">
          <span class="favorites-count">共 0 条收藏</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // 绑定事件
    this.modalEl.querySelector('.close-favorites-modal')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });

    const searchInput = this.modalEl.querySelector('.favorites-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.renderList((e.target as HTMLInputElement).value);
    });

    return this.modalEl;
  }

  /**
   * 渲染收藏列表
   */
  private renderList(searchQuery = '', filterTag = ''): void {
    const listEl = this.modalEl?.querySelector('.favorites-list');
    if (!listEl) return;

    let items = searchQuery 
      ? this.search(searchQuery)
      : this.getAll();

    if (filterTag) {
      items = items.filter(item => item.tags.includes(filterTag));
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="favorites-empty">
          <div class="favorites-empty-icon">📭</div>
          <p>${searchQuery ? '未找到匹配的收藏' : '暂无收藏内容'}</p>
          <p class="favorites-empty-hint">在对话中点击收藏按钮即可添加</p>
        </div>
      `;
    } else {
      listEl.innerHTML = items.map(item => `
        <div class="favorite-item" data-id="${item.id}">
          <div class="favorite-header">
            <span class="favorite-type ${item.messageType}">${item.messageType === 'user' ? '👤 用户' : '🤖 助手'}</span>
            <span class="favorite-agent">${item.agentName}</span>
            <span class="favorite-time">${this.formatTime(item.createdAt)}</span>
          </div>
          <div class="favorite-summary">${this.escapeHtml(item.summary)}</div>
          <div class="favorite-content-preview">${this.escapeHtml(item.content.substring(0, 200))}${item.content.length > 200 ? '...' : ''}</div>
          <div class="favorite-tags">
            ${item.tags.map(tag => `<span class="favorite-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
          <div class="favorite-actions">
            <button class="favorite-action-btn copy-favorite" title="复制内容">📋 复制</button>
            <button class="favorite-action-btn use-favorite" title="使用此内容">💬 使用</button>
            <button class="favorite-action-btn edit-tags-favorite" title="编辑标签">🏷️ 标签</button>
            <button class="favorite-action-btn delete-favorite danger" title="删除">🗑️ 删除</button>
          </div>
        </div>
      `).join('');

      // 绑定操作按钮事件
      listEl.querySelectorAll('.favorite-item').forEach(itemEl => {
        const id = itemEl.getAttribute('data-id') || '';
        const item = items.find(i => i.id === id);
        if (!item) return;

        itemEl.querySelector('.copy-favorite')?.addEventListener('click', () => {
          navigator.clipboard.writeText(item.content);
          this.showToast('已复制到剪贴板');
        });

        itemEl.querySelector('.use-favorite')?.addEventListener('click', () => {
          this.useFavorite(item);
        });

        itemEl.querySelector('.edit-tags-favorite')?.addEventListener('click', () => {
          this.editTags(item);
        });

        itemEl.querySelector('.delete-favorite')?.addEventListener('click', () => {
          if (confirm('确定要删除这条收藏吗？')) {
            this.remove(id);
            this.renderList(searchQuery, filterTag);
          }
        });
      });
    }

    // 更新计数
    const countEl = this.modalEl?.querySelector('.favorites-count');
    if (countEl) {
      countEl.textContent = `共 ${items.length} 条收藏`;
    }
  }

  /**
   * 渲染标签筛选
   */
  private renderTagFilter(): void {
    const tagsEl = this.modalEl?.querySelector('.favorites-tags-filter');
    if (!tagsEl) return;

    const tags = this.getTags();
    if (tags.length === 0) {
      tagsEl.innerHTML = '';
      return;
    }

    const stats = this.getTagStats();
    tagsEl.innerHTML = `
      <span class="tag-filter-label">标签:</span>
      ${tags.map(tag => `
        <button class="tag-filter-btn" data-tag="${tag}">
          ${this.escapeHtml(tag)} (${stats[tag]})
        </button>
      `).join('')}
    `;

    tagsEl.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag') || '';
        const isActive = btn.classList.contains('active');
        
        tagsEl.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        
        if (!isActive) {
          btn.classList.add('active');
          this.renderList('', tag);
        } else {
          this.renderList('');
        }
      });
    });
  }

  /**
   * 使用收藏内容
   */
  private useFavorite(item: FavoriteItem): void {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    if (input) {
      input.value = item.content;
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this.closeModal();
  }

  /**
   * 编辑标签
   */
  private editTags(item: FavoriteItem): void {
    const newTags = prompt('编辑标签 (用逗号分隔):', item.tags.join(', '));
    if (newTags !== null) {
      const tags = newTags.split(',').map(t => t.trim()).filter(t => t);
      this.update(item.id, { tags });
      this.renderList();
      this.renderTagFilter();
    }
  }

  /**
   * 显示 Toast 提示
   */
  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'favorites-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-CN');
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
   * 打开收藏夹弹窗
   */
  openModal(): void {
    if (!this.modalEl) {
      this.createModal();
    }
    this.renderList();
    this.renderTagFilter();
    this.modalEl?.classList.remove('hidden');
  }

  /**
   * 关闭收藏夹弹窗
   */
  closeModal(): void {
    this.modalEl?.classList.add('hidden');
  }

  /**
   * 切换收藏夹弹窗
   */
  toggleModal(): void {
    if (this.modalEl?.classList.contains('hidden')) {
      this.openModal();
    } else {
      this.closeModal();
    }
  }
}

// 导出单例
export const favoritesManager = new FavoritesManager();

/**
 * 初始化收藏夹样式
 */
export function initFavoritesStyles(): void {
  if (document.getElementById('favorites-styles')) return;

  const style = document.createElement('style');
  style.id = 'favorites-styles';
  style.textContent = `
    /* 收藏夹弹窗样式 */
    .favorites-modal-content {
      width: min(800px, 92vw);
      height: min(85vh, 700px);
      display: flex;
      flex-direction: column;
    }

    .favorites-toolbar {
      display: flex;
      gap: 12px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      align-items: center;
    }

    .favorites-search-input {
      flex: 1;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 14px;
    }

    .favorites-search-input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .favorites-tags-filter {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }

    .tag-filter-label {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .tag-filter-btn {
      padding: 4px 10px;
      font-size: 11px;
      border: 1px solid var(--border-color);
      border-radius: 999px;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .tag-filter-btn:hover,
    .tag-filter-btn.active {
      border-color: var(--accent-color);
      background: rgba(47, 129, 247, 0.12);
      color: var(--text-primary);
    }

    .favorites-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .favorites-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .favorites-empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-secondary);
    }

    .favorites-empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .favorites-empty p {
      margin: 0;
      font-size: 14px;
    }

    .favorites-empty-hint {
      margin-top: 8px !important;
      font-size: 12px !important;
      color: var(--text-muted);
    }

    .favorite-item {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      transition: border-color 0.2s;
    }

    .favorite-item:hover {
      border-color: var(--accent-color);
    }

    .favorite-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .favorite-type {
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--bg-tertiary);
    }

    .favorite-type.user {
      color: var(--accent-color);
    }

    .favorite-type.assistant {
      color: var(--success-text);
    }

    .favorite-agent {
      color: var(--text-secondary);
    }

    .favorite-time {
      margin-left: auto;
      color: var(--text-muted);
    }

    .favorite-summary {
      font-weight: 500;
      font-size: 14px;
      margin-bottom: 6px;
      color: var(--text-primary);
    }

    .favorite-content-preview {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 10px;
      padding: 10px;
      background: var(--bg-secondary);
      border-radius: var(--radius-sm);
    }

    .favorite-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .favorite-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(47, 129, 247, 0.12);
      color: var(--accent-color);
    }

    .favorite-actions {
      display: flex;
      gap: 8px;
    }

    .favorite-action-btn {
      padding: 4px 10px;
      font-size: 11px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .favorite-action-btn:hover {
      border-color: var(--accent-color);
      background: rgba(47, 129, 247, 0.1);
    }

    .favorite-action-btn.danger:hover {
      border-color: var(--error-color);
      background: rgba(248, 81, 73, 0.1);
      color: #f85149;
    }

    .favorites-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Toast 提示 */
    .favorites-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 10px 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      opacity: 0;
      transition: all 0.3s;
      z-index: 3000;
    }

    .favorites-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* 消息容器需要相对定位 */
    .message {
      position: relative;
    }

    /* 收藏按钮 - 始终显示但半透明，悬停时完全显示 */
    .message-favorite-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      cursor: pointer;
      opacity: 0.3;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      z-index: 10;
    }

    .message:hover .message-favorite-btn {
      opacity: 1;
    }

    .message-favorite-btn:hover {
      background: var(--accent-color);
      color: white;
      transform: scale(1.1);
    }

    .message-favorite-btn.favorited {
      opacity: 1;
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.2);
    }

    .message-favorite-btn.favorited:hover {
      color: white;
      background: var(--accent-color);
    }

    /* 多选模式下的消息样式 */
    .message.selectable {
      cursor: pointer;
    }

    .message.selected {
      background: rgba(47, 129, 247, 0.1);
      border-left: 3px solid var(--accent-color);
    }

    .message.select-checkbox {
      position: absolute;
      left: -30px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: transparent;
      transition: all 0.2s;
    }

    .message.selected .select-checkbox {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: white;
    }

    /* 右键菜单样式 */
    .message-context-menu {
      position: fixed;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 150px;
      z-index: 1000;
    }

    .message-context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--text-primary);
      transition: background 0.15s;
    }

    .message-context-menu-item:hover {
      background: var(--bg-tertiary);
    }

    .message-context-menu-item.danger {
      color: #ef4444;
    }

    .message-context-menu-divider {
      height: 1px;
      background: var(--border-color);
      margin: 4px 0;
    }

    /* 多选工具栏 */
    .multi-select-toolbar {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 100;
    }

    .multi-select-toolbar .selected-count {
      font-size: 14px;
      color: var(--text-secondary);
    }

    .multi-select-toolbar .btn-primary {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .multi-select-toolbar .btn-primary:hover {
      opacity: 0.9;
    }

    .multi-select-toolbar .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .multi-select-toolbar .btn-secondary:hover {
      background: var(--bg-secondary);
    }
  `;

  document.head.appendChild(style);
}
