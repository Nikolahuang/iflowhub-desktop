// src/features/memory.ts - 本地记忆与智能上下文管理

// 记忆条目接口
interface MemoryEntry {
  id: string;
  agentId: string;
  sessionId: string;
  content: string;
  summary: string;
  keywords: string[];
  timestamp: number;
  embedding?: number[];
  tokenCount: number;
}

// 向量数据库接口（简化版，使用余弦相似度）
class SimpleVectorStore {
  private entries: MemoryEntry[] = [];
  private readonly STORAGE_KEY = 'iflow-memory-store';

  constructor() {
    this.load();
  }

  private load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        this.entries = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load memory store:', e);
    }
  }

  private save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
    } catch (e) {
      console.error('Failed to save memory store:', e);
    }
  }

  // 添加记忆
  add(entry: MemoryEntry) {
    this.entries.push(entry);
    // 限制最大条目数
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }
    this.save();
  }

  // 搜索相似内容
  search(query: string, agentId: string, limit: number = 5): MemoryEntry[] {
    const queryKeywords = this.extractKeywords(query);
    
    // 计算相似度分数
    const scored = this.entries
      .filter(e => e.agentId === agentId)
      .map(entry => {
        const keywordScore = this.calculateKeywordScore(queryKeywords, entry.keywords);
        const recencyScore = 1 / (1 + (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24)); // 时间衰减
        return { entry, score: keywordScore * 0.7 + recencyScore * 0.3 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(s => s.entry);
  }

  // 提取关键词（简化版 TF-IDF）
  extractKeywords(text: string): string[] {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'it', 'its', 'for', 'with', 'from', 'to'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));

    // 词频统计
    const freq: Record<string, number> = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);

    // 返回高频词
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // 计算关键词相似度
  private calculateKeywordScore(query: string[], target: string[]): number {
    if (query.length === 0 || target.length === 0) return 0;
    const intersection = query.filter(w => target.includes(w));
    return intersection.length / Math.max(query.length, target.length);
  }

  // 获取所有记忆
  getAll(agentId?: string): MemoryEntry[] {
    if (agentId) {
      return this.entries.filter(e => e.agentId === agentId);
    }
    return this.entries;
  }

  // 清除记忆
  clear(agentId?: string) {
    if (agentId) {
      this.entries = this.entries.filter(e => e.agentId !== agentId);
    } else {
      this.entries = [];
    }
    this.save();
  }

  // 统计
  stats(): { total: number; totalTokens: number } {
    return {
      total: this.entries.length,
      totalTokens: this.entries.reduce((sum, e) => sum + e.tokenCount, 0)
    };
  }
}

// 估算 token 数量（简化版）
function estimateTokens(text: string): number {
  // 英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// 生成摘要（简化版：提取关键句）
function generateSummary(text: string, maxLength: number = 200): string {
  const sentences = text.split(/[。！？\n]+/).filter(s => s.trim());
  if (sentences.length === 0) return text.slice(0, maxLength);
  
  // 提取前几句话作为摘要
  let summary = '';
  for (const sentence of sentences) {
    if (summary.length + sentence.length > maxLength) break;
    summary += sentence + '。';
  }
  return summary || text.slice(0, maxLength);
}

// 导出单例
export const memoryStore = new SimpleVectorStore();

// 智能上下文管理器
export class ContextManager {
  private readonly MAX_CONTEXT_TOKENS = 4000; // 保留给当前对话的 token 数

  // 存储消息到记忆
  storeMessage(agentId: string, sessionId: string, content: string, _role: 'user' | 'assistant') {
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      sessionId,
      content,
      summary: generateSummary(content),
      keywords: memoryStore['extractKeywords'](content),
      timestamp: Date.now(),
      tokenCount: estimateTokens(content)
    };

    memoryStore.add(entry);
    return entry;
  }

  // 获取智能上下文（核心功能）
  getSmartContext(
    agentId: string,
    currentQuery: string,
    maxTokens: number = this.MAX_CONTEXT_TOKENS
  ): string {
    // 1. 搜索相关记忆
    const relevantMemories = memoryStore.search(currentQuery, agentId, 5);
    
    // 2. 构建上下文
    let context = '';
    let usedTokens = 0;

    // 添加相关记忆摘要
    for (const memory of relevantMemories) {
      if (usedTokens + memory.tokenCount > maxTokens * 0.3) break;
      context += `[历史相关] ${memory.summary}\n`;
      usedTokens += estimateTokens(memory.summary);
    }

    return context;
  }

  // 压缩长文本
  compressText(text: string, targetTokens: number): string {
    const totalTokens = estimateTokens(text);
    if (totalTokens <= targetTokens) return text;

    // 分段处理
    const paragraphs = text.split(/\n\n+/);
    const compressed: string[] = [];
    let usedTokens = 0;

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);
      if (usedTokens + paraTokens > targetTokens) {
        // 尝试摘要
        const summary = generateSummary(para, Math.floor((targetTokens - usedTokens) * 4));
        if (summary) {
          compressed.push(summary);
        }
        break;
      }
      compressed.push(para);
      usedTokens += paraTokens;
    }

    return compressed.join('\n\n');
  }

  // 分析并给出上下文建议
  analyzeContext(messages: { role: string; content: string }[]): {
    totalTokens: number;
    warning: string | null;
    suggestion: string | null;
  } {
    const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    
    let warning: string | null = null;
    let suggestion: string | null = null;

    if (totalTokens > 50000) {
      warning = '上下文非常长，可能超出模型限制';
      suggestion = '建议：开启新会话，或使用 /compact 命令压缩历史';
    } else if (totalTokens > 20000) {
      warning = '上下文较长，部分模型可能无法处理';
      suggestion = '建议：简化当前消息，或分步执行任务';
    }

    return { totalTokens, warning, suggestion };
  }
}

// 导出单例
export const contextManager = new ContextManager();

// 初始化样式
export function initMemoryStyles() {
  // 添加记忆管理相关样式
  const style = document.createElement('style');
  style.textContent = `
    .memory-stats {
      font-size: 11px;
      color: var(--text-muted);
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      margin-top: 8px;
    }
    
    .memory-stats-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-right: 12px;
    }
    
    .context-warning {
      background: #fef3c7;
      color: #92400e;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .context-warning.danger {
      background: #fee2e2;
      color: #991b1b;
    }
  `;
  document.head.appendChild(style);
}

// 更新上下文指示器显示
export function updateContextDisplay(agentId: string | null) {
  if (!agentId) return;
  
  const stats = memoryStore.stats();
  const indicator = document.querySelector('.context-indicator') as HTMLElement;
  if (!indicator) return;

  const memCount = stats.total;
  const totalTokens = stats.totalTokens;
  
  indicator.innerHTML = `
    <span class="memory-stats-item" title="存储的记忆条目">
      📚 ${memCount} 条记忆
    </span>
    <span class="memory-stats-item" title="估算的 token 数量">
      🔢 ~${Math.round(totalTokens / 1000)}k tokens
    </span>
  `;
}
