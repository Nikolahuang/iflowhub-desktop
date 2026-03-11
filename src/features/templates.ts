// src/features/templates.ts — Prompt 模板库功能
import { state } from '../store';
import { escapeHtml } from '../lib/html';
import type { PromptTemplate, PromptTemplateCategory } from '../types';

const PROMPT_TEMPLATES_STORAGE_KEY = 'iflow-prompt-templates';

// 内置模板分类
export const BUILTIN_CATEGORIES: PromptTemplateCategory[] = [
  { id: 'coding', name: '编程开发', icon: '💻', order: 1 },
  { id: 'writing', name: '写作创作', icon: '✍️', order: 2 },
  { id: 'analysis', name: '分析研究', icon: '📊', order: 3 },
  { id: 'translation', name: '翻译润色', icon: '🌐', order: 4 },
  { id: 'assistant', name: '日常助手', icon: '🤖', order: 5 },
  { id: 'custom', name: '自定义', icon: '⭐', order: 99 },
];

// 内置模板
export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'builtin-code-review',
    name: '代码审查',
    description: '对代码进行全面审查，找出潜在问题和改进建议',
    content: `请对以下代码进行全面审查，重点关注：
1. 代码质量和可读性
2. 潜在的 bug 和边界情况
3. 性能优化建议
4. 安全隐患
5. 最佳实践建议

代码：
\`\`\`
{{code}}
\`\`\``,
    category: 'coding',
    variables: ['code'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-explain-code',
    name: '代码解释',
    description: '详细解释代码的功能和实现逻辑',
    content: `请详细解释以下代码的功能、实现逻辑和关键点：

\`\`\`
{{code}}
\`\`\`

要求：
1. 逐行或逐块解释代码功能
2. 说明使用的设计模式或算法
3. 指出关键的技术要点`,
    category: 'coding',
    variables: ['code'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-refactor',
    name: '代码重构',
    description: '重构代码以提高质量和可维护性',
    content: `请重构以下代码，使其更加清晰、高效和可维护：

\`\`\`
{{code}}
\`\`\`

重构目标：
1. 提高代码可读性
2. 减少重复代码
3. 优化性能
4. 增强可测试性

请提供重构后的代码和改动说明。`,
    category: 'coding',
    variables: ['code'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-write-article',
    name: '文章撰写',
    description: '根据主题和大纲撰写文章',
    content: `请根据以下信息撰写一篇文章：

主题：{{topic}}
大纲：{{outline}}
风格：{{style}}

要求：
1. 结构清晰，逻辑连贯
2. 内容充实，论据充分
3. 语言流畅，易于理解
4. 适当使用小标题分段`,
    category: 'writing',
    variables: ['topic', 'outline', 'style'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-summarize',
    name: '内容总结',
    description: '将长文本压缩为简洁的摘要',
    content: `请将以下内容总结为简洁的摘要：

{{content}}

要求：
1. 保留核心观点和关键信息
2. 控制在 200 字以内
3. 使用要点形式呈现`,
    category: 'analysis',
    variables: ['content'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-translate',
    name: '翻译润色',
    description: '将文本翻译为指定语言并进行润色',
    content: `请将以下文本翻译为{{targetLanguage}}，并进行润色：

原文：
{{text}}

要求：
1. 翻译准确，表达地道
2. 保持原文风格和语气
3. 适当润色，使译文更加流畅`,
    category: 'translation',
    variables: ['text', 'targetLanguage'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-meeting-minutes',
    name: '会议纪要',
    description: '将会议记录整理为结构化的会议纪要',
    content: `请将以下会议记录整理为结构化的会议纪要：

{{meetingNotes}}

格式要求：
1. 会议基本信息
2. 讨论要点
3. 决议事项
4. 待办事项（含负责人和截止日期）`,
    category: 'assistant',
    variables: ['meetingNotes'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
  {
    id: 'builtin-daily-plan',
    name: '日程规划',
    description: '根据任务列表制定日程安排',
    content: `请根据以下任务帮我制定今日日程规划：

任务列表：
{{tasks}}

工作时间：{{workHours}}

要求：
1. 合理分配时间，考虑优先级
2. 为重要任务预留缓冲时间
3. 安排适当的休息间隔`,
    category: 'assistant',
    variables: ['tasks', 'workHours'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isBuiltin: true,
  },
];

// 初始化模板库
export function initPromptTemplates() {
  state.promptTemplateCategories = [...BUILTIN_CATEGORIES];
  
  // 加载用户自定义模板
  const storedTemplates = localStorage.getItem(PROMPT_TEMPLATES_STORAGE_KEY);
  const customTemplates: PromptTemplate[] = storedTemplates 
    ? JSON.parse(storedTemplates).map((t: PromptTemplate) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }))
    : [];
  
  // 合并内置模板和自定义模板
  state.promptTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];
}

// 保存自定义模板到 localStorage
export function saveCustomTemplates() {
  const customTemplates = state.promptTemplates.filter(t => !t.isBuiltin);
  localStorage.setItem(PROMPT_TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
}

// 添加新模板
export function addPromptTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
  const newTemplate: PromptTemplate = {
    ...template,
    id: `custom-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltin: false,
  };
  state.promptTemplates.push(newTemplate);
  saveCustomTemplates();
  return newTemplate;
}

// 更新模板
export function updatePromptTemplate(id: string, updates: Partial<PromptTemplate>) {
  const index = state.promptTemplates.findIndex(t => t.id === id);
  if (index !== -1 && !state.promptTemplates[index].isBuiltin) {
    state.promptTemplates[index] = {
      ...state.promptTemplates[index],
      ...updates,
      updatedAt: new Date(),
    };
    saveCustomTemplates();
    return true;
  }
  return false;
}

// 删除模板
export function deletePromptTemplate(id: string) {
  const index = state.promptTemplates.findIndex(t => t.id === id);
  if (index !== -1 && !state.promptTemplates[index].isBuiltin) {
    state.promptTemplates.splice(index, 1);
    saveCustomTemplates();
    return true;
  }
  return false;
}

// 根据分类获取模板
export function getTemplatesByCategory(categoryId: string) {
  return state.promptTemplates.filter(t => t.category === categoryId);
}

// 搜索模板
export function searchPromptTemplates(query: string) {
  const lowerQuery = query.toLowerCase();
  return state.promptTemplates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.content.toLowerCase().includes(lowerQuery)
  );
}

// 替换模板中的变量
export function resolveTemplateVariables(content: string, variables: Record<string, string>) {
  let resolved = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    resolved = resolved.replace(regex, value);
  }
  return resolved;
}

// 从模板内容中提取变量名
export function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

// 渲染模板列表 HTML
export function renderPromptTemplateList(filter?: string): string {
  let templates = filter 
    ? searchPromptTemplates(filter)
    : state.promptTemplates;
  
  if (templates.length === 0) {
    return `<div class="template-empty">暂无匹配的模板</div>`;
  }
  
  // 按分类分组
  const grouped: Record<string, PromptTemplate[]> = {};
  for (const template of templates) {
    if (!grouped[template.category]) {
      grouped[template.category] = [];
    }
    grouped[template.category].push(template);
  }
  
  const html: string[] = [];
  
  for (const category of state.promptTemplateCategories) {
    const categoryTemplates = grouped[category.id];
    if (!categoryTemplates || categoryTemplates.length === 0) continue;
    
    html.push(`
      <div class="template-category">
        <div class="template-category-header">
          <span class="template-category-icon">${category.icon}</span>
          <span class="template-category-name">${escapeHtml(category.name)}</span>
          <span class="template-category-count">${categoryTemplates.length}</span>
        </div>
        <div class="template-list">
          ${categoryTemplates.map(t => renderTemplateItem(t)).join('')}
        </div>
      </div>
    `);
  }
  
  return html.join('');
}

// 渲染单个模板项
function renderTemplateItem(template: PromptTemplate): string {
  return `
    <div class="template-item" data-template-id="${template.id}">
      <div class="template-item-header">
        <span class="template-name">${escapeHtml(template.name)}</span>
        ${template.isBuiltin ? '<span class="template-builtin-badge">内置</span>' : ''}
      </div>
      <div class="template-description">${escapeHtml(template.description)}</div>
      <div class="template-preview">${escapeHtml(template.content.slice(0, 100))}${template.content.length > 100 ? '...' : ''}</div>
      <div class="template-actions">
        <button type="button" class="template-use-btn" data-template-id="${template.id}">使用</button>
        <button type="button" class="template-preview-btn" data-template-id="${template.id}">预览</button>
        ${!template.isBuiltin ? `<button type="button" class="template-delete-btn" data-template-id="${template.id}">删除</button>` : ''}
      </div>
    </div>
  `;
}

// 渲染模板变量输入表单
export function renderTemplateVariableForm(template: PromptTemplate): string {
  const variables = extractTemplateVariables(template.content);
  
  if (variables.length === 0) {
    return `
      <div class="template-variable-form">
        <div class="template-preview-content">${escapeHtml(template.content)}</div>
      </div>
    `;
  }
  
  return `
    <div class="template-variable-form">
      <div class="template-form-header">
        <h4>${escapeHtml(template.name)}</h4>
        <p>${escapeHtml(template.description)}</p>
      </div>
      <div class="template-form-fields">
        ${variables.map(v => `
          <div class="template-field">
            <label for="var-${v}">${escapeHtml(v)}</label>
            <textarea id="var-${v}" name="${v}" placeholder="请输入 ${escapeHtml(v)}" rows="2"></textarea>
          </div>
        `).join('')}
      </div>
      <div class="template-form-actions">
        <button type="button" class="btn-secondary template-cancel-btn">取消</button>
        <button type="button" class="btn-primary template-apply-btn" data-template-id="${template.id}">应用模板</button>
      </div>
    </div>
  `;
}
