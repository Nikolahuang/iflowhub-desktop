// src/store.ts — centralized application state
import type {
  Agent,
  Session,
  Message,
  ToolCall,
  AgentRegistry,
  ModelOption,
  ThinkSupportStatus,
  SlashMenuItem,
  ThemeMode,
  GitFileChange,
  PromptTemplate,
  PromptTemplateCategory,
} from './types';

const NOTIFICATION_DELAY_STORAGE_KEY = 'iflow-notification-delay-ms';
const NOTIFICATION_DEFAULT_DELAY_MS = 5000;
const NOTIFICATION_MAX_DELAY_MS = 59 * 60 * 1000 + 59 * 1000;

function normalizeNotificationDelayMs(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue || '', 10);
  if (!Number.isFinite(parsed)) {
    return NOTIFICATION_DEFAULT_DELAY_MS;
  }
  const normalized = Math.max(0, Math.min(NOTIFICATION_MAX_DELAY_MS, parsed));
  return normalized;
}

export const state = {
  // ── 核心实体 ──────────────────────────────────────────────────────────────
  agents: [] as Agent[],
  currentAgentId: null as string | null,
  currentSessionId: null as string | null,
  messages: [] as Message[],

  // ── 关联数据 ──────────────────────────────────────────────────────────────
  sessionsByAgent: {} as Record<string, Session[]>,
  messagesBySession: {} as Record<string, Message[]>,
  inflightSessionByAgent: {} as Record<string, string>,
  registryByAgent: {} as Record<string, AgentRegistry>,
  toolCallsByAgent: {} as Record<string, ToolCall[]>,
  modelOptionsCacheByAgent: {} as Record<string, ModelOption[]>,
  thinkSupportByModel: {} as Record<string, ThinkSupportStatus>,
  gitChangesByAgent: {} as Record<string, GitFileChange[]>,
  gitChangesLoadingByAgent: {} as Record<string, boolean>,
  gitChangesErrorByAgent: {} as Record<string, string>,
  gitChangesLastRefreshedAtByAgent: {} as Record<string, number>,

  // ── UI 交互状态 ────────────────────────────────────────────────────────────
  modelSelectorOpen: false,
  modelSwitchingAgentId: null as string | null,
  thinkSwitchingAgentId: null as string | null,
  renamingAgentId: null as string | null,

  // slash menu
  slashMenuItems: [] as SlashMenuItem[],
  slashMenuVisible: false,
  slashMenuActiveIndex: 0,

  // artifact preview
  artifactPreviewRequestToken: 0,
  artifactPreviewCacheByKey: new Map<string, string>(),
  artifactPreviewCacheOrder: [] as string[],
  artifactPreviewLastKey: null as string | null,

  // message send timeout
  messageTimeout: null as number | null,
  
  // 可配置的消息超时时间（毫秒），0 表示无限等待
  messageTimeoutMs: (parseInt(localStorage.getItem('iflow-message-timeout-ms') || '0', 10) || 0) as number,

  // CLI 模式：每次发送消息创建新 session（无历史累积）
  // 默认开启 CLI 模式，避免 iFlow session 历史累积导致 Prompt 超长
  cliMode: localStorage.getItem('iflow-cli-mode') !== 'false',

  // theme
  currentTheme: ((localStorage.getItem('iflow-theme') as ThemeMode) || 'system') as ThemeMode,
  notificationSoundId: localStorage.getItem('iflow-notification-sound') || 'bell-happy.wav',
  notificationDelayMs: normalizeNotificationDelayMs(localStorage.getItem(NOTIFICATION_DELAY_STORAGE_KEY)),
  notificationCustomSoundDataUrl: localStorage.getItem('iflow-notification-custom-sound'),
  notificationCustomSoundName: localStorage.getItem('iflow-notification-custom-sound-name'),

  // 背景图片
  backgroundImageDataUrl: localStorage.getItem('iflow-background-image') || '',
  backgroundImageOpacity: parseInt(localStorage.getItem('iflow-background-opacity') || '30', 10),

  // Prompt 模板库
  promptTemplates: [] as PromptTemplate[],
  promptTemplateCategories: [] as PromptTemplateCategory[],
  promptTemplateModalVisible: false,

  // MCP 市场
  mcpMarketItems: [] as import('./types').McpMarketItem[],
  installedMcpItems: [] as import('./types').McpMarketItem[],

  // Agent 市场
  agentMarketItems: [] as import('./types').AgentMarketItem[],
  installedAgentItems: [] as import('./types').AgentMarketItem[],
};

export function canUseConversationQuickAction(): boolean {
  if (!state.currentAgentId || !state.currentSessionId) {
    return false;
  }
  const agent = state.agents.find((item) => item.id === state.currentAgentId);
  return Boolean(agent && agent.status === 'connected' && !state.inflightSessionByAgent[agent.id]);
}
