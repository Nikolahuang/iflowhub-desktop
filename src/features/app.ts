// src/features/app.ts — all application logic (extracted from main.ts)
import {
  onStreamMessage,
  onToolCall,
  onCommandRegistry,
  onModelRegistry,
  onAcpSession,
  onTaskFinish,
  onAgentError,
  onAgentWarning,
} from '../services/events';
import {
  getVersion,
  sendLongMessage as tauriSendMessage,
  stopMessage,
  pickFolder,
} from '../services/tauri';
import { generateAcpSessionId, streamTypeToRole } from '../lib/utils';
import { escapeHtml } from '../lib/html';
import type { Message, SlashMenuItem, ComposerState, StreamMessageType, ThemeMode, ExportFormat } from '../types';
import { state, canUseConversationQuickAction } from '../store';
import {
  initPromptTemplates,
  renderPromptTemplateList,
  renderTemplateVariableForm,
  resolveTemplateVariables,
  deletePromptTemplate,
  addPromptTemplate,
  updatePromptTemplate,
  extractTemplateVariables,
} from './templates';
import {
  exportCurrentSession,
} from './export';
import {
  addAgentBtnEl,
  agentListEl,
  sessionListEl,
  chatMessagesEl,
  messageInputEl,
  sendBtnEl,
  addAgentModalEl,
  closeModalBtnEl,
  cancelAddAgentBtnEl,
  confirmAddAgentBtnEl,
  workspacePathInputEl,
  browseWorkspacePathBtnEl,
  renameAgentModalEl,
  closeRenameAgentModalBtnEl,
  cancelRenameAgentBtnEl,
  confirmRenameAgentBtnEl,
  renameAgentNameInputEl,
  currentAgentModelBtnEl,
  currentAgentModelMenuEl,
  toggleThinkBtnEl,
  openToolCallsBtnEl,
  openGitChangesBtnEl,
  toolCallsPanelEl,
  toolCallsListEl,
  closeToolPanelBtnEl,
  gitChangesListEl,
  refreshGitChangesBtnEl,
  closeGitChangesPanelBtnEl,
  newSessionBtnEl,
  clearChatBtnEl,
  clearAllSessionsBtnEl,
  inputStatusHintEl,
  slashCommandMenuEl,
  artifactPreviewModalEl,
  closeArtifactPreviewBtnEl,
  gitDiffModalEl,
  closeGitDiffBtnEl,
  openSettingsBtnEl,
  settingsModalEl,
  closeSettingsModalBtnEl,
  closeSettingsFooterBtnEl,
  themeToggleBtnEl,
  autoReconnectModeSelectEl,
  notificationSoundSelectEl,
  notificationDelayMinuteInputEl,
  notificationDelaySecondInputEl,
  notificationSoundUploadBtnEl,
  notificationSoundUploadInputEl,
  appVersionEl,
  backgroundImageUploadBtnEl,
  backgroundImageUploadInputEl,
  backgroundImageRemoveBtnEl,
  backgroundImagePreviewEl,
  backgroundImageOpacityEl,
  openTemplatesBtnEl,
  templatesModalEl,
  closeTemplatesModalBtnEl,
  templateSearchEl,
  addTemplateBtnEl,
  templatesListEl,
  templateVariablesModalEl,
  closeTemplateVariablesModalBtnEl,
  templateVariablesTitleEl,
  templateVariablesBodyEl,
  exportSessionBtnEl,
  exportModalEl,
  closeExportModalBtnEl,
  cancelExportBtnEl,
  confirmExportBtnEl,
  exportIncludeTimestampsEl,
  exportIncludeToolCallsEl,
  exportIncludeSystemEl,
  templateEditorModalEl,
  closeTemplateEditorModalBtnEl,
  templateEditorTitleEl,
  templateNameInputEl,
  templateDescriptionInputEl,
  templateCategorySelectEl,
  templateContentInputEl,
  cancelTemplateEditorBtnEl,
  saveTemplateBtnEl,
  renameSessionModalEl,
  closeRenameSessionModalBtnEl,
  cancelRenameSessionBtnEl,
  confirmRenameSessionBtnEl,
  renameSessionTitleInputEl,
} from '../dom';
import {
  saveSessions,
  saveSessionMessages,
} from './storage';
import {
  applyAcpSessionBinding,
  onSessionListClick,
  clearCurrentAgentSessions,
  renderSessionList,
  startNewSession,
  clearChat,
  getMessagesForSession,
  findSessionById,
  touchCurrentSession,
  touchSessionById,
  closeRenameSessionModal,
  confirmRenameSession,
} from './sessions';
import {
  isCurrentAgentBusy,
  applyAgentRegistry,
  applyAgentModelRegistry,
  onAgentListClick,
  addAgent,
  hideRenameAgentModal,
  submitRenameAgent,
  mergeToolCalls,
  resetToolCallsForAgent,
  openCurrentAgentToolCallsPanel,
  closeCurrentAgentModelMenu,
  toggleCurrentAgentModelMenu,
  onCurrentAgentModelMenuClick,
  handleLocalModelCommand,
  handleLocalAgentCommand,
  type AutoReconnectMode,
  getAutoReconnectMode,
  setAutoReconnectMode,
  syncAgentModelFromAboutContent,
  toggleCurrentAgentThink,
  refreshAgentGitChanges,
  refreshCurrentAgentGitChanges,
  showGitChangesForAgent,
  showError,
  showSuccess,
} from './agents';
import {
  renderMessages,
  scrollToBottom,
  onChatMessagesClick,
  onToolCallsClick,
  closeArtifactPreviewModal,
  closeGitDiffModal,
  onGitChangesClick,
} from './ui';

const SEND_BUTTON_SEND_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
`;
const SEND_BUTTON_STOP_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
  </svg>
`;
const DEFAULT_SLASH_COMMANDS: ReadonlyArray<{ command: string; description: string }> = [
  { command: '/help', description: '显示帮助与命令说明' },
  { command: '/model list', description: '查看可选模型列表' },
  { command: '/model current', description: '查看当前模型（客户端记录）' },
  { command: '/model <name|编号>', description: '切换当前 Agent 模型（本地实现）' },
  { command: '/directory show', description: '查看当前会话可见目录' },
  { command: '/directory add <path>', description: '添加额外目录到会话上下文' },
  { command: '/commands', description: '列出可用命令' },
  { command: '/tools', description: '查看工具列表' },
  { command: '/memory show', description: '查看当前记忆' },
  { command: '/stats', description: '查看会话统计' },
  { command: '/mcp list', description: '查看 MCP 列表' },
  { command: '/agents list', description: '查看可用 Agent' },
  { command: '/agents autoreconnect', description: '查看自动重连模式（last/all/off）' },
  { command: '/agents autoreconnect <last|all|off>', description: '设置自动重连模式' },
];
// 初始化
// 主题管理
const THEME_STORAGE_KEY = 'iflow-theme';
const THEME_CYCLE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<ThemeMode, string> = { system: '◑', light: '☀', dark: '☾' };
const THEME_TITLE: Record<ThemeMode, string> = { system: '跟随系统', light: '亮色模式', dark: '暗色模式' };
const NOTIFICATION_SOUND_STORAGE_KEY = 'iflow-notification-sound';
const NOTIFICATION_CUSTOM_SOUND_STORAGE_KEY = 'iflow-notification-custom-sound';
const NOTIFICATION_CUSTOM_SOUND_NAME_STORAGE_KEY = 'iflow-notification-custom-sound-name';
const NOTIFICATION_DELAY_STORAGE_KEY = 'iflow-notification-delay-ms';
const AUTO_RECONNECT_MODE_DEFAULT: AutoReconnectMode = 'last';
const NOTIFICATION_SOUND_NONE = 'none';
const NOTIFICATION_SOUND_CUSTOM = 'custom-upload';
const NOTIFICATION_SOUND_DEFAULT = 'short-01.mp3';
const NOTIFICATION_DEFAULT_DELAY_MS = 5000;
const NOTIFICATION_MAX_DELAY_MS = 59 * 60 * 1000 + 59 * 1000;
const NOTIFICATION_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

interface NotificationSoundOption {
  id: string;
  label: string;
  src: string | null;
}

const NOTIFICATION_BUILTIN_SOUND_OPTIONS: ReadonlyArray<NotificationSoundOption> = [
  { id: NOTIFICATION_SOUND_NONE, label: '关闭', src: null },
  {
    id: 'short-01.mp3',
    label: '铃声01',
    src: '/audio/bell/short-01.mp3',
  },
  {
    id: 'short-02.wav',
    label: '铃声02',
    src: '/audio/bell/short-02.wav',
  },
  {
    id: 'short-03.mp3',
    label: '铃声03',
    src: '/audio/bell/short-03.mp3',
  },
  {
    id: 'short-04.mp3',
    label: '铃声04',
    src: '/audio/bell/short-04.mp3',
  },
  {
    id: 'short-05.mp3',
    label: '铃声05',
    src: '/audio/bell/short-05.mp3',
  },
  {
    id: 'short-06.wav',
    label: '铃声06',
    src: '/audio/bell/short-06.wav',
  },
  {
    id: 'short-07.mp3',
    label: '铃声07',
    src: '/audio/bell/short-07.mp3',
  },
  {
    id: 'short-08.mp3',
    label: '铃声08',
    src: '/audio/bell/short-08.mp3',
  },
];
const notificationAudioEl = new Audio();
notificationAudioEl.preload = 'auto';
let notificationSoundTimerId: number | null = null;

const AUTO_RECONNECT_MODE_LABELS: Record<AutoReconnectMode, string> = {
  last: '最后一个',
  all: '全部',
  off: '关闭',
};

function normalizeAutoReconnectMode(rawValue: string | null | undefined): AutoReconnectMode {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'last' || normalized === 'all' || normalized === 'off') {
    return normalized;
  }
  return AUTO_RECONNECT_MODE_DEFAULT;
}

function setupAutoReconnectModeSelector() {
  const mode = getAutoReconnectMode();
  autoReconnectModeSelectEl.value = mode;
  autoReconnectModeSelectEl.title = `刷新后重连：${AUTO_RECONNECT_MODE_LABELS[mode]}`;
}

function onAutoReconnectModeChange() {
  const mode = normalizeAutoReconnectMode(autoReconnectModeSelectEl.value);
  setAutoReconnectMode(mode);
  autoReconnectModeSelectEl.value = mode;
  autoReconnectModeSelectEl.title = `刷新后重连：${AUTO_RECONNECT_MODE_LABELS[mode]}`;
}


export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  if (mode !== 'system') root.classList.add(`theme-${mode}`);
  themeToggleBtnEl.textContent = `主题：${THEME_ICON[mode]}`;
  themeToggleBtnEl.title = THEME_TITLE[mode];
}

function showSettingsModal() {
  settingsModalEl.classList.remove('hidden');
  
  // 初始化权限模式选择器
  import('./enhancements').then(({ permissionManager, themeAccentManager, fontManager }) => {
    // 权限模式
    const permissionSelector = document.getElementById('permission-mode-selector');
    if (permissionSelector) {
      const currentMode = permissionManager.getMode();
      permissionSelector.querySelectorAll('.permission-mode-btn').forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        btn.classList.toggle('active', mode === currentMode);
        btn.addEventListener('click', () => {
          const newMode = btn.getAttribute('data-mode') as 'yolo' | 'smart' | 'confirm';
          if (newMode) {
            permissionManager.setMode(newMode);
            permissionSelector.querySelectorAll('.permission-mode-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-mode') === newMode);
            });
          }
        });
      });
    }

    // 主题强调色
    const accentPicker = document.getElementById('accent-color-picker');
    if (accentPicker) {
      const accents = themeAccentManager.getAvailableAccents();
      const currentAccent = themeAccentManager.getAccent();
      accentPicker.innerHTML = accents.map(accent => `
        <button 
          class="accent-color-btn ${accent.id === currentAccent ? 'active' : ''}" 
          data-accent="${accent.id}"
          title="${accent.name}"
          style="background-color: ${accent.color}"
          type="button"
        ></button>
      `).join('');
      
      accentPicker.querySelectorAll('.accent-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const accent = btn.getAttribute('data-accent') as any;
          if (accent) {
            themeAccentManager.setAccent(accent);
            accentPicker.querySelectorAll('.accent-color-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-accent') === accent);
            });
          }
        });
      });
    }

    // 字体选择器
    const fontSelector = document.getElementById('font-selector');
    if (fontSelector) {
      const fonts = fontManager.getAvailableFonts();
      const currentFont = fontManager.getFont();
      fontSelector.innerHTML = fonts.map(font => `
        <button 
          class="font-btn ${font.id === currentFont ? 'active' : ''}" 
          data-font="${font.id}"
          type="button"
        >${font.name}</button>
      `).join('');
      
      fontSelector.querySelectorAll('.font-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const font = btn.getAttribute('data-font') as any;
          if (font) {
            fontManager.setFont(font);
            fontSelector.querySelectorAll('.font-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-font') === font);
            });
          }
        });
      });
    }
  });

  // 初始化消息超时设置
  const timeoutSelect = document.getElementById('message-timeout-select') as HTMLSelectElement;
  if (timeoutSelect) {
    // 设置当前值
    const currentValue = state.messageTimeoutMs.toString();
    const options = Array.from(timeoutSelect.options);
    const matchingOption = options.find(opt => opt.value === currentValue);
    if (matchingOption) {
      timeoutSelect.value = currentValue;
    } else {
      // 如果当前值不在选项中，选择最接近的
      timeoutSelect.value = '0';
    }
    
    // 监听变化
    timeoutSelect.addEventListener('change', () => {
      const newValue = parseInt(timeoutSelect.value, 10);
      state.messageTimeoutMs = newValue;
      localStorage.setItem('iflow-message-timeout-ms', newValue.toString());
      console.log(`Message timeout set to: ${newValue === 0 ? 'unlimited' : newValue + 'ms'}`);
    });
  }

  // 初始化对话模式
  const modeSelector = document.getElementById('mode-selector');
  if (modeSelector) {
    // 设置当前值
    const currentMode = state.cliMode ? 'cli' : 'conversation';
    modeSelector.querySelectorAll('.mode-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      btn.classList.toggle('active', mode === currentMode);
      
      btn.addEventListener('click', () => {
        const newMode = btn.getAttribute('data-mode');
        if (newMode) {
          state.cliMode = newMode === 'cli';
          localStorage.setItem('iflow-cli-mode', String(state.cliMode));
          
          modeSelector.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-mode') === newMode);
          });
          
          console.log(`Mode set to: ${newMode}`);
        }
      });
    });
  }

  // 初始化记忆管理
  import('./memory').then(({ memoryStore, initMemoryStyles }) => {
    initMemoryStyles();
    
    // 更新记忆统计显示
    const updateMemoryStats = () => {
      const statsEl = document.getElementById('memory-stats');
      if (!statsEl) return;
      
      const stats = memoryStore.stats();
      statsEl.innerHTML = `
        <div class="memory-stat-item">
          <span>📚 记忆条目:</span>
          <span class="memory-stat-value">${stats.total}</span>
        </div>
        <div class="memory-stat-item">
          <span>🔢 估算 Tokens:</span>
          <span class="memory-stat-value">~${Math.round(stats.totalTokens / 1000)}k</span>
        </div>
      `;
    };
    
    updateMemoryStats();
    
    // 清除记忆按钮
    const clearBtn = document.getElementById('clear-memory-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有记忆吗？这将删除所有存储的对话上下文信息。')) {
          memoryStore.clear();
          updateMemoryStats();
          console.log('Memory cleared');
        }
      });
    }
    
    // 导出记忆按钮
    const exportBtn = document.getElementById('export-memory-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const memories = memoryStore.getAll();
        const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iflow-memory-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }).catch(console.error);
}

function hideSettingsModal() {
  settingsModalEl.classList.add('hidden');
}

function normalizeNotificationDelayMs(delayMs: number | null | undefined): number {
  if (!Number.isFinite(delayMs)) {
    return NOTIFICATION_DEFAULT_DELAY_MS;
  }
  return Math.max(0, Math.min(NOTIFICATION_MAX_DELAY_MS, Math.floor(delayMs as number)));
}

function splitDelayMs(delayMs: number): { minutes: number; seconds: number } {
  const normalized = normalizeNotificationDelayMs(delayMs);
  return {
    minutes: Math.floor(normalized / 60000),
    seconds: Math.floor((normalized % 60000) / 1000),
  };
}

function buildCustomNotificationSoundOption(): NotificationSoundOption | null {
  if (!state.notificationCustomSoundDataUrl) {
    return null;
  }
  const displayName = state.notificationCustomSoundName?.trim() || '未命名音频';
  return {
    id: NOTIFICATION_SOUND_CUSTOM,
    label: `铃声：自定义（${displayName}）`,
    src: state.notificationCustomSoundDataUrl,
  };
}

function buildNotificationSoundOptions(): NotificationSoundOption[] {
  const options = [...NOTIFICATION_BUILTIN_SOUND_OPTIONS];
  const customOption = buildCustomNotificationSoundOption();
  if (customOption) {
    options.push(customOption);
  }
  return options;
}

function normalizeNotificationSoundId(soundId: string | null | undefined): string {
  if (!soundId) {
    return NOTIFICATION_SOUND_DEFAULT;
  }
  const matched = buildNotificationSoundOptions().find((item) => item.id === soundId);
  return matched ? matched.id : NOTIFICATION_SOUND_DEFAULT;
}

function notificationSoundSrcById(soundId: string): string | null {
  const matched = buildNotificationSoundOptions().find((item) => item.id === soundId);
  return matched?.src || null;
}

function applyNotificationSoundSelection(soundId: string) {
  const normalized = normalizeNotificationSoundId(soundId);
  state.notificationSoundId = normalized;
  localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, normalized);
  notificationSoundSelectEl.value = normalized;
}

function applyNotificationDelaySelection(delayMs: number) {
  const normalized = normalizeNotificationDelayMs(delayMs);
  state.notificationDelayMs = normalized;
  localStorage.setItem(NOTIFICATION_DELAY_STORAGE_KEY, String(normalized));
  const { minutes, seconds } = splitDelayMs(normalized);
  notificationDelayMinuteInputEl.value = String(minutes);
  notificationDelaySecondInputEl.value = String(seconds);
}

function normalizeNotificationDelayInput(rawValue: string): number {
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(59, parsed));
}

function applyNotificationDelayFromInputs() {
  const minutes = normalizeNotificationDelayInput(notificationDelayMinuteInputEl.value);
  const seconds = normalizeNotificationDelayInput(notificationDelaySecondInputEl.value);
  const totalMs = minutes * 60000 + seconds * 1000;
  applyNotificationDelaySelection(totalMs);
}

function isSupportedAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) {
    return true;
  }
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

async function onUploadNotificationSound() {
  const file = notificationSoundUploadInputEl.files?.[0];
  if (!file) {
    return;
  }

  try {
    if (!isSupportedAudioFile(file)) {
      showError('请选择可播放的音频文件（如 mp3/wav/ogg/m4a）');
      return;
    }
    if (file.size > NOTIFICATION_MAX_UPLOAD_BYTES) {
      showError('上传失败：音频文件需小于 4MB');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    localStorage.setItem(NOTIFICATION_CUSTOM_SOUND_STORAGE_KEY, dataUrl);
    localStorage.setItem(NOTIFICATION_CUSTOM_SOUND_NAME_STORAGE_KEY, file.name);
    state.notificationCustomSoundDataUrl = dataUrl;
    state.notificationCustomSoundName = file.name;

    setupNotificationSoundSelector();
    applyNotificationSoundSelection(NOTIFICATION_SOUND_CUSTOM);
    await playTaskFinishSound();
  } catch (error) {
    console.error('Upload notification sound failed:', error);
    showError(`上传铃声失败: ${String(error)}`);
  } finally {
    notificationSoundUploadInputEl.value = '';
  }
}

export function setupNotificationSoundSelector() {
  const soundOptions = buildNotificationSoundOptions();
  notificationSoundSelectEl.innerHTML = soundOptions.map((item) => {
    return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`;
  }).join('');

  const saved = normalizeNotificationSoundId(state.notificationSoundId);
  applyNotificationSoundSelection(saved);
}

export function setupNotificationDelayInputs() {
  applyNotificationDelaySelection(state.notificationDelayMs);
}

export async function playTaskFinishSound() {
  const source = notificationSoundSrcById(state.notificationSoundId);
  if (!source) {
    return;
  }

  try {
    notificationAudioEl.pause();
    notificationAudioEl.currentTime = 0;
    notificationAudioEl.src = source;
    await notificationAudioEl.play();
  } catch (error) {
    console.warn('Play task finish sound failed:', error);
  }
}

export function scheduleTaskFinishSound() {
  if (notificationSoundTimerId !== null) {
    window.clearTimeout(notificationSoundTimerId);
    notificationSoundTimerId = null;
  }

  const delayMs = normalizeNotificationDelayMs(state.notificationDelayMs);
  if (delayMs === 0) {
    void playTaskFinishSound();
    return;
  }

  notificationSoundTimerId = window.setTimeout(() => {
    notificationSoundTimerId = null;
    void playTaskFinishSound();
  }, delayMs);
}


export async function syncAppVersion() {
  try {
    const version = await getVersion();
    appVersionEl.textContent = `v${version}`;
  } catch (error) {
    console.error('Load app version failed:', error);
    appVersionEl.textContent = 'v--';
  }
}

export function setSendButtonMode(mode: 'send' | 'stop', disabled: boolean) {
  sendBtnEl.disabled = disabled;
  sendBtnEl.classList.toggle('btn-stop', mode === 'stop');
  sendBtnEl.setAttribute('aria-label', mode === 'stop' ? '停止生成' : '发送消息');
  sendBtnEl.title = mode === 'stop' ? '停止生成' : '发送消息';
  sendBtnEl.innerHTML = mode === 'stop' ? SEND_BUTTON_STOP_ICON : SEND_BUTTON_SEND_ICON;
}

export function setComposerState(state: ComposerState, hint: string) {
  messageInputEl.classList.remove('composer-ready', 'composer-busy', 'composer-disabled');
  messageInputEl.classList.add(`composer-${state}`);
  inputStatusHintEl.textContent = hint;

  if (state === 'ready') {
    messageInputEl.disabled = false;
    setSendButtonMode('send', false);
    messageInputEl.placeholder = '输入消息，或输入 / 查看命令...';
    updateSlashCommandMenu();
    return;
  }

  messageInputEl.disabled = true;
  if (state === 'busy') {
    setSendButtonMode('stop', false);
    messageInputEl.placeholder = '正在回复中，可点击停止按钮中断';
  } else {
    setSendButtonMode('send', true);
    messageInputEl.placeholder = '请选择 Agent 后开始对话...';
  }
  hideSlashCommandMenu();
}

export function refreshComposerState() {
  const currentAgent = state.currentAgentId ? state.agents.find((agent) => agent.id === state.currentAgentId) : null;
  const isConnected = currentAgent?.status === 'connected';
  const hasSession = Boolean(state.currentSessionId);
  const isBusy = isCurrentAgentBusy();

  // 更新导出按钮状态
  exportSessionBtnEl.disabled = !hasSession;

  if (!hasSession) {
    setComposerState('disabled', '请选择在线 Agent 与会话后输入');
    newSessionBtnEl.disabled = !isConnected;
    clearChatBtnEl.disabled = true;
    return;
  }

  if (isBusy) {
    setComposerState('busy', '正在回复中，可点击停止按钮中断');
    newSessionBtnEl.disabled = true;
    clearChatBtnEl.disabled = true;
    return;
  }

  if (!isConnected) {
    setComposerState('ready', '当前 Agent 离线，仅可输入本地命令（如 /agents autoreconnect）');
    messageInputEl.placeholder = '输入本地命令，例如 /agents autoreconnect';
    newSessionBtnEl.disabled = true;
    clearChatBtnEl.disabled = false;
    return;
  }

  setComposerState('ready', '当前会话已完成，可继续输入（输入 / 可查看命令）');
  newSessionBtnEl.disabled = false;
  clearChatBtnEl.disabled = false;
}

// 设置 Tauri 事件监听
export function setupTauriEventListeners() {
  console.log('Setting up Tauri event listeners...');

  onStreamMessage((payload) => {
    if (!payload.agentId || !payload.content) {
      return;
    }

    if (payload.agentId === state.currentAgentId && state.messageTimeout) {
      clearTimeout(state.messageTimeout);
      state.messageTimeout = null;
    }

    const targetSessionId =
      state.inflightSessionByAgent[payload.agentId] ||
      (payload.agentId === state.currentAgentId ? state.currentSessionId : null);

    if (!targetSessionId) {
      return;
    }

    appendStreamMessage(payload.agentId, targetSessionId, payload.content, payload.type);
  });

  onToolCall((payload) => {
    if (payload.agentId && Array.isArray(payload.toolCalls)) {
      mergeToolCalls(payload.agentId, payload.toolCalls);
    }
  });

  onCommandRegistry((payload) => {
    if (!payload.agentId) {
      return;
    }

    applyAgentRegistry(payload.agentId, payload.commands, payload.mcpServers);
  });

  onModelRegistry((payload) => {
    if (!payload.agentId) {
      return;
    }

    applyAgentModelRegistry(payload.agentId, payload.models, payload.currentModel);
  });

  onAcpSession((payload) => {
    if (!payload.agentId || !payload.sessionId) {
      return;
    }
    applyAcpSessionBinding(payload.agentId, payload.sessionId);
  });

  onTaskFinish((payload) => {
    if (!payload.agentId) {
      return;
    }

    const targetSessionId = state.inflightSessionByAgent[payload.agentId];
    if (targetSessionId) {
      delete state.inflightSessionByAgent[payload.agentId];
    }

    if (payload.agentId === state.currentAgentId) {
      if (state.messageTimeout) {
        clearTimeout(state.messageTimeout);
        state.messageTimeout = null;
      }

      state.messages = state.messages.filter((m) => !m.id.includes('-sending') && !m.id.includes('-processing'));
      renderMessages();
      refreshComposerState();
      void refreshAgentGitChanges(payload.agentId);
      
      // 存储 AI 回复到记忆系统
      import('./memory').then(({ contextManager }) => {
        const lastAssistantMsg = [...state.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg && lastAssistantMsg.content.length > 50 && payload.agentId && state.currentSessionId) {
          contextManager.storeMessage(payload.agentId, state.currentSessionId, lastAssistantMsg.content, 'assistant');
        }
      }).catch(() => {});
    } else if (targetSessionId) {
      const sessionMessages = getMessagesForSession(targetSessionId).filter(
        (m) => !m.id.includes('-sending') && !m.id.includes('-processing')
      );
      state.messagesBySession[targetSessionId] = sessionMessages;
      void saveSessionMessages();
      renderSessionList();
      refreshComposerState();
    }

    scheduleTaskFinishSound();
  });

  onAgentError((payload) => {
    if (payload.agentId) {
      delete state.inflightSessionByAgent[payload.agentId];
    }
    if (payload.agentId && payload.agentId !== state.currentAgentId) {
      return;
    }

    const error = payload.error || '未知错误';
    console.error('[Agent Error]', payload);

    // 检查是否是 WebSocket 连接被拒绝的错误
    if (error.includes('Connection refused') || error.includes('os error 10061') || error.includes('连接被拒绝')) {
      showError(
        `连接错误: iFlow CLI 进程可能已停止运行

原因: ${error}

建议解决方案:
1. 检查 iFlow CLI 是否仍在运行
2. 重新连接 Agent
3. 如果问题持续，请重启应用`
      );
    } else if (error.includes('Failed after')) {
      showError(
        `连接失败: 无法连接到 iFlow CLI

错误: ${error}

建议解决方案:
1. 检查 iFlow CLI 是否正常启动
2. 尝试重新连接 Agent
3. 如问题持续，请重启应用和 iFlow CLI`
      );
    } else {
      showError(`错误: ${error}`);
    }

    refreshComposerState();
  });

  onAgentWarning((payload) => {
    if (payload.agentId && payload.agentId !== state.currentAgentId) {
      return;
    }

    console.warn('[Agent Warning]', payload);

    // 显示警告信息（不作为错误，只是提醒用户）
    if (payload.warning) {
      console.log('[Reconnecting]', payload.warning);
      // 可以在这里显示一个非阻塞的通知，但不中断用户操作
    }
  });
}

// 追加流式消息
export function appendStreamMessage(
  agentId: string,
  sessionId: string,
  content: string,
  messageType: StreamMessageType | undefined
) {
  const sessionMessages = getMessagesForSession(sessionId).filter(
    (m) => !m.id.includes('-sending') && !m.id.includes('-processing')
  );

  const role = streamTypeToRole(messageType);
  let normalizedContent = content;
  if (role === 'thought') {
    normalizedContent = normalizedContent.replace(/^💭\s*/, '');
  }
  if (!normalizedContent.trim()) {
    return;
  }

  let lastMessage = sessionMessages[sessionMessages.length - 1];
  const canAppendToLast = role !== 'system' && role !== 'user' && lastMessage?.role === role;

  if (!canAppendToLast) {
    lastMessage = {
      id: `msg-${Date.now()}`,
      role,
      content: '',
      timestamp: new Date(),
      agentId,
    };
    sessionMessages.push(lastMessage);
  }

  lastMessage.content += normalizedContent;
  lastMessage.timestamp = new Date();
  if (role === 'assistant') {
    syncAgentModelFromAboutContent(agentId, lastMessage.content);
  }
  state.messagesBySession[sessionId] = sessionMessages;
  touchSessionById(sessionId, sessionMessages);
  void saveSessionMessages();

  if (sessionId === state.currentSessionId) {
    state.messages = sessionMessages;
    renderMessages();
    scrollToBottom();
  } else {
    renderSessionList();
  }
}

export function getSlashQueryFromInput(): string | null {
  const firstLine = messageInputEl.value.split('\n')[0].replace(/^\s+/, '');
  if (!firstLine.startsWith('/')) {
    return null;
  }

  if (/\s/.test(firstLine)) {
    return null;
  }

  const token = firstLine.slice(1);
  if (token.includes('/')) {
    return null;
  }

  return token.toLowerCase();
}

export function buildSlashMenuItemsForCurrentAgent(): SlashMenuItem[] {
  const items: SlashMenuItem[] = [];
  const seen = new Set<string>();
  const currentRegistry = state.currentAgentId ? state.registryByAgent[state.currentAgentId] : undefined;

  const pushUnique = (item: SlashMenuItem) => {
    const dedupeKey = item.insertText.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    items.push(item);
  };

  currentRegistry?.commands.forEach((entry, index) => {
    const hint = entry.scope || 'command';
    pushUnique({
      id: `command-${index}-${entry.name}`,
      label: entry.name,
      insertText: entry.name,
      description: entry.description || '已安装命令',
      hint,
      category: 'command',
      searchable: `${entry.name} ${entry.description} ${hint}`.toLowerCase(),
    });
  });

  currentRegistry?.mcpServers.forEach((entry, index) => {
    const commandText = `/mcp get ${entry.name}`;
    const description = entry.description || `查看 MCP 服务 ${entry.name}`;
    pushUnique({
      id: `mcp-${index}-${entry.name}`,
      label: commandText,
      insertText: commandText,
      description,
      hint: 'mcp',
      category: 'mcp',
      searchable: `${commandText} ${entry.name} ${description}`.toLowerCase(),
    });
  });

  DEFAULT_SLASH_COMMANDS.forEach((entry, index) => {
    pushUnique({
      id: `builtin-${index}-${entry.command}`,
      label: entry.command,
      insertText: entry.command,
      description: entry.description,
      hint: 'builtin',
      category: 'builtin',
      searchable: `${entry.command} ${entry.description}`.toLowerCase(),
    });
  });

  return items;
}

export function updateSlashCommandMenu() {
  const query = getSlashQueryFromInput();
  if (query === null || messageInputEl.disabled || !state.currentAgentId) {
    hideSlashCommandMenu();
    return;
  }

  const candidateItems = buildSlashMenuItemsForCurrentAgent();
  const filteredItems =
    query.length === 0
      ? candidateItems
      : candidateItems.filter((item) => item.searchable.includes(query));

  state.slashMenuItems = filteredItems.slice(0, 12);
  if (state.slashMenuItems.length === 0) {
    state.slashMenuVisible = true;
    state.slashMenuActiveIndex = 0;
    slashCommandMenuEl.classList.remove('hidden');
    slashCommandMenuEl.innerHTML = `<div class="slash-command-empty">未找到匹配命令：/${escapeHtml(query)}</div>`;
    return;
  }

  if (!state.slashMenuVisible) {
    state.slashMenuActiveIndex = 0;
  } else if (state.slashMenuActiveIndex >= state.slashMenuItems.length) {
    state.slashMenuActiveIndex = state.slashMenuItems.length - 1;
  }

  state.slashMenuVisible = true;
  slashCommandMenuEl.classList.remove('hidden');
  slashCommandMenuEl.innerHTML = state.slashMenuItems
    .map((item, index) => {
      const activeClass = index === state.slashMenuActiveIndex ? 'active' : '';
      const desc = escapeHtml(item.description || (item.category === 'mcp' ? 'MCP 服务' : '命令'));
      return `
      <button type="button" class="slash-command-item ${activeClass}" data-index="${index}">
        <div class="slash-command-main">
          <div class="slash-command-name">${escapeHtml(item.label)}</div>
          <div class="slash-command-desc">${desc}</div>
        </div>
        <span class="slash-command-hint">${escapeHtml(item.hint)}</span>
      </button>
    `;
    })
    .join('');
  ensureSlashMenuActiveItemVisible();
}

export function hideSlashCommandMenu() {
  state.slashMenuVisible = false;
  state.slashMenuItems = [];
  state.slashMenuActiveIndex = 0;
  slashCommandMenuEl.classList.add('hidden');
  slashCommandMenuEl.innerHTML = '';
}

export function ensureSlashMenuActiveItemVisible() {
  if (!state.slashMenuVisible || state.slashMenuItems.length === 0) {
    return;
  }

  const activeItemEl = slashCommandMenuEl.querySelector(
    `.slash-command-item[data-index="${state.slashMenuActiveIndex}"]`
  ) as HTMLButtonElement | null;

  if (!activeItemEl) {
    return;
  }

  const containerTop = slashCommandMenuEl.scrollTop;
  const containerBottom = containerTop + slashCommandMenuEl.clientHeight;
  const itemTop = activeItemEl.offsetTop;
  const itemBottom = itemTop + activeItemEl.offsetHeight;

  if (itemTop < containerTop) {
    slashCommandMenuEl.scrollTop = itemTop;
    return;
  }

  if (itemBottom > containerBottom) {
    slashCommandMenuEl.scrollTop = itemBottom - slashCommandMenuEl.clientHeight;
  }
}

export function moveSlashMenuSelection(offset: number) {
  if (state.slashMenuItems.length === 0) {
    return;
  }
  const total = state.slashMenuItems.length;
  state.slashMenuActiveIndex = (state.slashMenuActiveIndex + offset + total) % total;
  updateSlashCommandMenu();
}

export function applySlashMenuItem(index: number): boolean {
  const item = state.slashMenuItems[index];
  if (!item) {
    return false;
  }

  messageInputEl.value = `${item.insertText} `;
  messageInputEl.style.height = 'auto';
  messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
  hideSlashCommandMenu();
  messageInputEl.focus();
  return true;
}

export function handleSlashMenuKeydown(event: KeyboardEvent): boolean {
  if (!state.slashMenuVisible) {
    return false;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSlashMenuSelection(1);
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSlashMenuSelection(-1);
    return true;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    hideSlashCommandMenu();
    return true;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    if (state.slashMenuItems.length === 0) {
      hideSlashCommandMenu();
      return true;
    }
    return applySlashMenuItem(state.slashMenuActiveIndex);
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    if (state.slashMenuItems.length === 0) {
      hideSlashCommandMenu();
      return false;
    }
    event.preventDefault();
    return applySlashMenuItem(state.slashMenuActiveIndex);
  }

  return false;
}

// 设置事件监听
export function setupEventListeners() {
  console.log('Setting up event listeners...');
  setupAutoReconnectModeSelector();
  setupNotificationSoundSelector();
  setupNotificationDelayInputs();

  themeToggleBtnEl.addEventListener('click', () => {
    state.currentTheme = THEME_CYCLE[state.currentTheme];
    applyTheme(state.currentTheme);
    localStorage.setItem(THEME_STORAGE_KEY, state.currentTheme);
  });

  // 背景图片事件监听
  backgroundImageUploadBtnEl.addEventListener('click', () => {
    backgroundImageUploadInputEl.click();
  });

  backgroundImageUploadInputEl.addEventListener('change', () => {
    void onUploadBackgroundImage();
  });

  backgroundImageRemoveBtnEl.addEventListener('click', () => {
    onRemoveBackgroundImage();
  });

  backgroundImageOpacityEl.addEventListener('input', () => {
    onBackgroundImageOpacityChange();
  });

  notificationSoundSelectEl.addEventListener('change', () => {
    applyNotificationSoundSelection(notificationSoundSelectEl.value);
    void playTaskFinishSound();
  });
  notificationDelayMinuteInputEl.addEventListener('change', applyNotificationDelayFromInputs);
  notificationDelaySecondInputEl.addEventListener('change', applyNotificationDelayFromInputs);
  notificationDelayMinuteInputEl.addEventListener('blur', applyNotificationDelayFromInputs);
  notificationDelaySecondInputEl.addEventListener('blur', applyNotificationDelayFromInputs);
  notificationSoundUploadBtnEl.addEventListener('click', () => {
    notificationSoundUploadInputEl.click();
  });
  notificationSoundUploadInputEl.addEventListener('change', () => {
    void onUploadNotificationSound();
  });
  autoReconnectModeSelectEl.addEventListener('change', onAutoReconnectModeChange);
  openToolCallsBtnEl.addEventListener('click', () => {
    if (!state.currentAgentId) {
      showError('请先选择 Agent');
      return;
    }
    openCurrentAgentToolCallsPanel();
  });
  openGitChangesBtnEl.addEventListener('click', () => {
    if (!state.currentAgentId) {
      showError('请先选择 Agent');
      return;
    }
    showGitChangesForAgent(state.currentAgentId, true);
    void refreshCurrentAgentGitChanges();
  });
  toggleThinkBtnEl.addEventListener('click', () => {
    void toggleCurrentAgentThink();
  });

  addAgentBtnEl.addEventListener('click', () => {
    addAgentModalEl.classList.remove('hidden');
  });
  openSettingsBtnEl.addEventListener('click', showSettingsModal);
  closeSettingsModalBtnEl.addEventListener('click', hideSettingsModal);
  closeSettingsFooterBtnEl.addEventListener('click', hideSettingsModal);

  closeModalBtnEl.addEventListener('click', hideModal);
  cancelAddAgentBtnEl.addEventListener('click', hideModal);
  closeArtifactPreviewBtnEl.addEventListener('click', closeArtifactPreviewModal);
  closeGitDiffBtnEl.addEventListener('click', closeGitDiffModal);
  artifactPreviewModalEl.addEventListener('click', (event) => {
    if (event.target === artifactPreviewModalEl) {
      closeArtifactPreviewModal();
    }
  });
  gitDiffModalEl.addEventListener('click', (event) => {
    if (event.target === gitDiffModalEl) {
      closeGitDiffModal();
    }
  });
  settingsModalEl.addEventListener('click', (event) => {
    if (event.target === settingsModalEl) {
      hideSettingsModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (!gitDiffModalEl.classList.contains('hidden')) {
      closeGitDiffModal();
      return;
    }
    if (!artifactPreviewModalEl.classList.contains('hidden')) {
      closeArtifactPreviewModal();
      return;
    }
    if (!settingsModalEl.classList.contains('hidden')) {
      hideSettingsModal();
      return;
    }
    if (!renameAgentModalEl.classList.contains('hidden')) {
      hideRenameAgentModal();
    }
  });

  confirmAddAgentBtnEl.addEventListener('click', async () => {
    const nameInput = document.getElementById('agent-name') as HTMLInputElement;
    const pathInput = document.getElementById('iflow-path') as HTMLInputElement;

    const name = nameInput.value.trim() || 'iFlow';
    const iflowPath = pathInput.value.trim() || 'iflow';
    const workspacePath = workspacePathInputEl.value.trim();

    hideModal();
    await addAgent(name, iflowPath, workspacePath);

    nameInput.value = 'iFlow';
    pathInput.value = '';
  });

  browseWorkspacePathBtnEl.addEventListener('click', async () => {
    const originalText = browseWorkspacePathBtnEl.textContent;
    browseWorkspacePathBtnEl.disabled = true;
    browseWorkspacePathBtnEl.textContent = '选择中...';

    try {
      const selectedPath = await pickFolder(workspacePathInputEl.value.trim() || null);
      if (selectedPath) {
        workspacePathInputEl.value = selectedPath;
      }
    } catch (error) {
      console.error('Pick workspace folder failed:', error);
      showError(`选择文件夹失败: ${String(error)}`);
    } finally {
      browseWorkspacePathBtnEl.disabled = false;
      browseWorkspacePathBtnEl.textContent = originalText;
    }
  });

  closeRenameAgentModalBtnEl.addEventListener('click', hideRenameAgentModal);
  cancelRenameAgentBtnEl.addEventListener('click', hideRenameAgentModal);
  renameAgentModalEl.addEventListener('click', (event) => {
    if (event.target === renameAgentModalEl) {
      hideRenameAgentModal();
    }
  });
  confirmRenameAgentBtnEl.addEventListener('click', () => {
    void submitRenameAgent();
  });
  renameAgentNameInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitRenameAgent();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hideRenameAgentModal();
    }
  });

  // 会话重命名弹窗事件
  closeRenameSessionModalBtnEl.addEventListener('click', closeRenameSessionModal);
  cancelRenameSessionBtnEl.addEventListener('click', closeRenameSessionModal);
  renameSessionModalEl.addEventListener('click', (event) => {
    if (event.target === renameSessionModalEl) {
      closeRenameSessionModal();
    }
  });
  confirmRenameSessionBtnEl.addEventListener('click', () => {
    void confirmRenameSession();
  });
  renameSessionTitleInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void confirmRenameSession();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRenameSessionModal();
    }
  });

  messageInputEl.addEventListener('keydown', (e) => {
    if (handleSlashMenuKeydown(e)) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  });

  messageInputEl.addEventListener('input', () => {
    messageInputEl.style.height = 'auto';
    messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
    updateSlashCommandMenu();
    updateCharCounter();
  });

  // 更新字符计数器
  function updateCharCounter() {
    const charCounterEl = document.getElementById('char-counter');
    if (!charCounterEl) return;
    
    const length = messageInputEl.value.length;
    if (length === 0) {
      charCounterEl.textContent = '';
      charCounterEl.className = 'char-counter';
    } else {
      // 格式化显示
      const formatLength = (n: number): string => {
        if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
        return n.toString();
      };
      
      charCounterEl.textContent = `${formatLength(length)} 字符`;
      
      // 根据长度设置警告级别
      if (length > 50000) {
        charCounterEl.className = 'char-counter danger';
        charCounterEl.textContent += ' ⚠️ 可能超长';
      } else if (length > 20000) {
        charCounterEl.className = 'char-counter warning';
      } else {
        charCounterEl.className = 'char-counter';
      }
    }
    
    // 同时更新上下文长度提示
    updateContextLengthHint();
  }

  // 更新上下文长度提示
  function updateContextLengthHint() {
    const hintEl = document.getElementById('context-length-hint');
    if (!hintEl) return;

    const messages = state.messages;
    const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    
    if (messages.length === 0) {
      hintEl.textContent = '';
      hintEl.className = 'context-length-hint';
      return;
    }

    const formatTokens = (n: number): string => {
      if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
      return n.toString();
    };

    const usagePercent = (totalTokens / 32000) * 100; // 使用 32k 作为基准
    
    hintEl.textContent = `📊 ~${formatTokens(totalTokens)} tokens`;
    hintEl.title = `历史消息: ${messages.length} 条\n估算 tokens: ${totalTokens}\n点击清理历史`;

    if (usagePercent > 80) {
      hintEl.className = 'context-length-hint danger';
    } else if (usagePercent > 60) {
      hintEl.className = 'context-length-hint warning';
    } else {
      hintEl.className = 'context-length-hint';
    }
  }

  // 点击上下文提示清理历史
  const contextHintEl = document.getElementById('context-length-hint');
  if (contextHintEl) {
    contextHintEl.addEventListener('click', () => {
      if (confirm('是否清理历史消息？\n\n这将保留最近 10 条消息，删除更早的对话。\n可以避免 "Prompt 超长" 错误。')) {
        compactHistory(10);
        updateContextLengthHint();
      }
    });
  }

  messageInputEl.addEventListener('blur', () => {
    window.setTimeout(() => {
      hideSlashCommandMenu();
    }, 120);
  });

  slashCommandMenuEl.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement;
    const itemEl = target.closest('.slash-command-item[data-index]') as HTMLElement | null;
    if (!itemEl || !itemEl.dataset.index) {
      return;
    }

    event.preventDefault();
    const index = Number(itemEl.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }

    applySlashMenuItem(index);
  });

  sendBtnEl.addEventListener('click', () => {
    if (isCurrentAgentBusy()) {
      void stopCurrentMessage();
      return;
    }
    void sendMessage();
  });
  chatMessagesEl.addEventListener('click', onChatMessagesClick);
  toolCallsListEl.addEventListener('click', onToolCallsClick);
  gitChangesListEl.addEventListener('click', onGitChangesClick);
  currentAgentModelBtnEl.addEventListener('click', (event) => {
    event.stopPropagation();
    void toggleCurrentAgentModelMenu();
  });
  currentAgentModelMenuEl.addEventListener('click', (event) => {
    void onCurrentAgentModelMenuClick(event);
  });
  document.addEventListener('click', onDocumentClick);
  agentListEl.addEventListener('click', onAgentListClick);
  sessionListEl.addEventListener('click', onSessionListClick);

  newSessionBtnEl.addEventListener('click', startNewSession);
  clearChatBtnEl.addEventListener('click', clearChat);
  closeToolPanelBtnEl.addEventListener('click', () => {
    toolCallsPanelEl.classList.add('hidden');
  });
  closeGitChangesPanelBtnEl.addEventListener('click', () => {
    closeGitChangesPanelBtnEl.closest('.git-changes-panel')?.classList.add('hidden');
  });
  refreshGitChangesBtnEl.addEventListener('click', () => {
    void refreshCurrentAgentGitChanges();
  });

  clearAllSessionsBtnEl.addEventListener('click', () => {
    void clearCurrentAgentSessions();
  });

  // 模板库功能
  openTemplatesBtnEl.addEventListener('click', () => {
    initPromptTemplates();
    templatesListEl.innerHTML = renderPromptTemplateList();
    templatesModalEl.classList.remove('hidden');
  });

  closeTemplatesModalBtnEl.addEventListener('click', () => {
    templatesModalEl.classList.add('hidden');
  });

  templatesModalEl.addEventListener('click', (event) => {
    if (event.target === templatesModalEl) {
      templatesModalEl.classList.add('hidden');
    }
  });

  templateSearchEl.addEventListener('input', () => {
    const query = templateSearchEl.value.trim();
    templatesListEl.innerHTML = renderPromptTemplateList(query);
  });

  addTemplateBtnEl.addEventListener('click', () => {
    templateEditorTitleEl.textContent = '新建模板';
    templateNameInputEl.value = '';
    templateDescriptionInputEl.value = '';
    templateCategorySelectEl.value = 'custom';
    templateContentInputEl.value = '';
    templateEditorModalEl.dataset.editId = '';
    templateEditorModalEl.classList.remove('hidden');
  });

  templatesListEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    
    // 使用模板
    const useBtn = target.closest('.template-use-btn') as HTMLButtonElement | null;
    if (useBtn?.dataset.templateId) {
      const template = state.promptTemplates.find(t => t.id === useBtn.dataset.templateId);
      if (template) {
        const variables = extractTemplateVariables(template.content);
        if (variables.length > 0) {
          templateVariablesTitleEl.textContent = template.name;
          templateVariablesBodyEl.innerHTML = renderTemplateVariableForm(template);
          templateVariablesModalEl.dataset.templateId = template.id;
          templateVariablesModalEl.classList.remove('hidden');
        } else {
          // 没有变量，直接使用
          messageInputEl.value = template.content;
          messageInputEl.style.height = 'auto';
          messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
          templatesModalEl.classList.add('hidden');
          messageInputEl.focus();
        }
      }
      return;
    }

    // 预览模板
    const previewBtn = target.closest('.template-preview-btn') as HTMLButtonElement | null;
    if (previewBtn?.dataset.templateId) {
      const template = state.promptTemplates.find(t => t.id === previewBtn.dataset.templateId);
      if (template) {
        templateVariablesTitleEl.textContent = `预览: ${template.name}`;
        templateVariablesBodyEl.innerHTML = `<pre class="template-preview-full">${escapeHtml(template.content)}</pre>`;
        templateVariablesModalEl.dataset.templateId = '';
        templateVariablesModalEl.classList.remove('hidden');
      }
      return;
    }

    // 删除模板
    const deleteBtn = target.closest('.template-delete-btn') as HTMLButtonElement | null;
    if (deleteBtn?.dataset.templateId) {
      if (confirm('确定要删除这个模板吗？')) {
        deletePromptTemplate(deleteBtn.dataset.templateId);
        templatesListEl.innerHTML = renderPromptTemplateList(templateSearchEl.value.trim());
      }
      return;
    }
  });

  closeTemplateVariablesModalBtnEl.addEventListener('click', () => {
    templateVariablesModalEl.classList.add('hidden');
  });

  templateVariablesModalEl.addEventListener('click', (event) => {
    if (event.target === templateVariablesModalEl) {
      templateVariablesModalEl.classList.add('hidden');
    }
  });

  templateVariablesBodyEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const applyBtn = target.closest('.template-apply-btn') as HTMLButtonElement | null;
    if (applyBtn?.dataset.templateId) {
      const template = state.promptTemplates.find(t => t.id === applyBtn.dataset.templateId);
      if (template) {
        const variables: Record<string, string> = {};
        const inputs = templateVariablesBodyEl.querySelectorAll('textarea[name]');
        inputs.forEach(input => {
          variables[input.getAttribute('name')!] = (input as HTMLTextAreaElement).value;
        });
        const resolved = resolveTemplateVariables(template.content, variables);
        messageInputEl.value = resolved;
        messageInputEl.style.height = 'auto';
        messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
        templateVariablesModalEl.classList.add('hidden');
        templatesModalEl.classList.add('hidden');
        messageInputEl.focus();
      }
    }

    const cancelBtn = target.closest('.template-cancel-btn');
    if (cancelBtn) {
      templateVariablesModalEl.classList.add('hidden');
    }
  });

  // 模板编辑器
  closeTemplateEditorModalBtnEl.addEventListener('click', () => {
    templateEditorModalEl.classList.add('hidden');
  });

  cancelTemplateEditorBtnEl.addEventListener('click', () => {
    templateEditorModalEl.classList.add('hidden');
  });

  templateEditorModalEl.addEventListener('click', (event) => {
    if (event.target === templateEditorModalEl) {
      templateEditorModalEl.classList.add('hidden');
    }
  });

  saveTemplateBtnEl.addEventListener('click', () => {
    const name = templateNameInputEl.value.trim();
    const description = templateDescriptionInputEl.value.trim();
    const category = templateCategorySelectEl.value;
    const content = templateContentInputEl.value.trim();

    if (!name || !content) {
      showError('请填写模板名称和内容');
      return;
    }

    const editId = templateEditorModalEl.dataset.editId;
    if (editId) {
      updatePromptTemplate(editId, { name, description, category, content });
    } else {
      addPromptTemplate({ name, description, category, content });
    }

    templateEditorModalEl.classList.add('hidden');
    templatesListEl.innerHTML = renderPromptTemplateList(templateSearchEl.value.trim());
  });

  // 导出功能
  exportSessionBtnEl.addEventListener('click', () => {
    if (!state.currentSessionId) {
      showError('请先选择要导出的会话');
      return;
    }
    exportModalEl.classList.remove('hidden');
  });

  closeExportModalBtnEl.addEventListener('click', () => {
    exportModalEl.classList.add('hidden');
  });

  cancelExportBtnEl.addEventListener('click', () => {
    exportModalEl.classList.add('hidden');
  });

  exportModalEl.addEventListener('click', (event) => {
    if (event.target === exportModalEl) {
      exportModalEl.classList.add('hidden');
    }
  });

  confirmExportBtnEl.addEventListener('click', async () => {
    const formatRadio = exportModalEl.querySelector('input[name="export-format"]:checked') as HTMLInputElement;
    const format = (formatRadio?.value || 'markdown') as ExportFormat;

    const options = {
      includeTimestamps: exportIncludeTimestampsEl.checked,
      includeToolCalls: exportIncludeToolCallsEl.checked,
      includeSystemMessages: exportIncludeSystemEl.checked,
    };

    try {
      const result = await exportCurrentSession(format, options);
      if (result) {
        exportModalEl.classList.add('hidden');
        showSuccess(`会话已保存到：${result}`);
      }
      // 如果 result 为 null，表示用户取消了保存，不显示错误
    } catch (error) {
      console.error('导出错误:', error);
      showError(`导出失败：${error}`);
    }
  });

  // 收藏夹功能
  const openFavoritesBtnEl = document.getElementById('open-favorites-btn');
  openFavoritesBtnEl?.addEventListener('click', () => {
    import('./favorites').then(({ favoritesManager }) => {
      favoritesManager.openModal();
    });
  });

  // 对话分支功能
  const openBranchBtnEl = document.getElementById('open-branch-btn');
  openBranchBtnEl?.addEventListener('click', () => {
    import('./branch').then(({ branchManager }) => {
      branchManager.openModal();
    });
  });

  console.log('Event listeners setup complete');
}

export function hideModal() {
  addAgentModalEl.classList.add('hidden');
}

export function onDocumentClick(event: MouseEvent) {
  if (!state.modelSelectorOpen) {
    return;
  }
  const target = event.target as HTMLElement;
  if (
    target.closest('#current-agent-model-btn') ||
    target.closest('#current-agent-model-menu')
  ) {
    return;
  }
  closeCurrentAgentModelMenu();
}

export async function sendPresetMessage(content: string, blockedHint: string) {
  const text = content.trim();
  if (!text) {
    return;
  }

  if (!canUseConversationQuickAction()) {
    showError(blockedHint);
    return;
  }

  messageInputEl.value = text;
  messageInputEl.style.height = 'auto';
  messageInputEl.style.height = `${messageInputEl.scrollHeight}px`;
  hideSlashCommandMenu();
  await sendMessage();
}

export async function sendQuickReply(text: string) {
  await sendPresetMessage(text, '当前无法快捷发送，请等待回复完成或检查连接状态');
}

export async function retryUserMessageById(messageId: string) {
  const userMessage = state.messages.find((item) => item.id === messageId && item.role === 'user');
  if (!userMessage) {
    showError('未找到可重试的问题');
    return;
  }
  await sendPresetMessage(userMessage.content, '当前无法重试，请等待回复完成或检查连接状态');
}

// 估算 token 数量（简化版）
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// 清理旧消息（保留最近 N 条）
export function compactHistory(keepLast: number = 10) {
  const currentSessionId = state.currentSessionId;
  if (!currentSessionId) return;

  const messages = getMessagesForSession(currentSessionId);
  if (messages.length <= keepLast) {
    showError('历史消息数量较少，无需清理');
    return;
  }

  // 保留最近的 N 条消息
  const keptMessages = messages.slice(-keepLast);
  state.messagesBySession[currentSessionId] = keptMessages;
  state.messages = keptMessages;
  void saveSessionMessages();
  renderMessages();
  console.log(`已清理历史消息，保留最近 ${keepLast} 条`);
}

// 发送消息

export async function sendMessage() {
  const content = messageInputEl.value.trim();
  const requestAgentId = state.currentAgentId;
  const requestSessionId = state.currentSessionId;
  if (!content || !requestSessionId) {
    return;
  }

  // 检测 iFlow session 历史是否过长
  // 注意：前端压缩历史不会影响 iFlow 服务端的 session 历史
  // 唯一的解决方案是新建会话
  const currentMessages = state.messages;
  const historyTokens = currentMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const newTokens = estimateTokens(content);
  const totalTokens = historyTokens + newTokens;
  const WARNING_THRESHOLD = 12000; // 约 12k tokens 警告

  if (totalTokens > WARNING_THRESHOLD && currentMessages.length > 4) {
    const shouldNewSession = confirm(
      `⚠️ 检测到会话历史较长（~${Math.round(totalTokens/1000)}k tokens）\n\n` +
      `iFlow 服务端会累积历史消息，可能导致 "Prompt 超长" 错误。\n\n` +
      `建议：点击"确定"自动开启新会话\n` +
      `      点击"取消"继续当前会话（可能出错）\n\n` +
      `提示：您也可以随时点击工具栏的"➕ 新会话"按钮`
    );
    
    if (shouldNewSession) {
      // 自动新建会话
      startNewSession();
      console.log('已自动创建新会话以避免 Prompt 超长错误');
      // 继续发送消息（使用新会话）
    }
  }

  if (requestAgentId && state.inflightSessionByAgent[requestAgentId]) {
    return;
  }

  const handledByLocalAgentCommand = await handleLocalAgentCommand(content, requestSessionId);
  if (handledByLocalAgentCommand) {
    messageInputEl.value = '';
    messageInputEl.style.height = 'auto';
    hideSlashCommandMenu();
    return;
  }

  if (requestAgentId) {
    const handledByLocalModelCommand = await handleLocalModelCommand(
      content,
      requestAgentId,
      requestSessionId
    );
    if (handledByLocalModelCommand) {
      messageInputEl.value = '';
      messageInputEl.style.height = 'auto';
      hideSlashCommandMenu();
      return;
    }
  }

  if (!requestAgentId) {
    return;
  }

  const requestAgent = state.agents.find((agent) => agent.id === requestAgentId);
  if (requestAgent?.status !== 'connected') {
    showError('当前 Agent 离线，仅支持本地命令。可输入 /agents autoreconnect 重连。');
    return;
  }

  resetToolCallsForAgent(requestAgentId);

  messageInputEl.value = '';
  messageInputEl.style.height = 'auto';
  hideSlashCommandMenu();

  const sendingMessage: Message = {
    id: `msg-${Date.now()}-sending`,
    role: 'system',
    content: '📤 正在发送消息...',
    timestamp: new Date(),
  };
  state.messages.push(sendingMessage);
  renderMessages();
  scrollToBottom();

  const userMessage: Message = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content,
    timestamp: new Date(),
  };
  state.messages.push(userMessage);
  touchCurrentSession();
  renderMessages();
  scrollToBottom();
  state.inflightSessionByAgent[requestAgentId] = requestSessionId;
  refreshComposerState();

  // 存储用户消息到记忆系统
  import('./memory').then(({ contextManager }) => {
    if (content.length > 50) { // 只存储较长的消息
      contextManager.storeMessage(requestAgentId, requestSessionId, content, 'user');
    }
  }).catch(() => {});

  try {
    const targetSession = findSessionById(requestSessionId);
    
    // CLI 模式：不传递 acpSessionId，每次都创建新 session（无历史累积）
    // 对话模式：使用现有 session 的 acpSessionId（保留历史上下文）
    let acpSessionId: string | null = null;
    
    if (state.cliMode) {
      // CLI 模式：不传递 acpSessionId，iFlow 会创建新 session
      acpSessionId = null;
      console.log('[CLI Mode] Sending without session history');
    } else {
      // 对话模式：使用现有 session
      if (targetSession && targetSession.source !== 'iflow-log') {
        if (!targetSession.acpSessionId) {
          targetSession.acpSessionId = generateAcpSessionId();
          void saveSessions();
        }
        acpSessionId = targetSession.acpSessionId;
      }
    }
    
    await tauriSendMessage(requestAgentId, content, acpSessionId);

    state.messages = state.messages.filter((m) => m.id !== sendingMessage.id);
    renderMessages();

    if (state.inflightSessionByAgent[requestAgentId] !== requestSessionId) {
      return;
    }

    // 如果设置了超时时间（非0），则设置超时检测
    const timeoutMs = state.messageTimeoutMs;
    if (timeoutMs > 0) {
      state.messageTimeout = window.setTimeout(() => {
        if (state.inflightSessionByAgent[requestAgentId] !== requestSessionId) {
          return;
        }
        const timeoutMinutes = Math.round(timeoutMs / 60000);
        const timeoutMessage: Message = {
          id: `msg-${Date.now()}-timeout`,
          role: 'system',
          content:
            `⏱️ 响应超时（${timeoutMinutes}分钟）。可能原因：\n1. iFlow 正在处理复杂任务（如代码重构、长文档分析）\n2. 模型响应较慢\n3. 连接已断开\n\n建议：\n- 在设置中选择"无限等待"\n- 检查终端是否有错误日志\n- 尝试重新连接 Agent\n- 简化任务或分步执行`,
          timestamp: new Date(),
        };
        state.messages.push(timeoutMessage);
        renderMessages();

        delete state.inflightSessionByAgent[requestAgentId];
        refreshComposerState();
        showError('响应超时，请检查连接状态');
      }, timeoutMs);
    }
  } catch (error) {
    state.messages = state.messages.filter((m) => m.id !== sendingMessage.id);
    renderMessages();

    if (state.inflightSessionByAgent[requestAgentId] !== requestSessionId) {
      return;
    }

    showError(`发送失败: ${String(error)}`);
    delete state.inflightSessionByAgent[requestAgentId];
    refreshComposerState();
  }
}

export async function stopCurrentMessage() {
  const requestAgentId = state.currentAgentId;
  if (!requestAgentId || !state.inflightSessionByAgent[requestAgentId]) {
    return;
  }

  if (state.messageTimeout) {
    clearTimeout(state.messageTimeout);
    state.messageTimeout = null;
  }

  delete state.inflightSessionByAgent[requestAgentId];
  state.messages = state.messages.filter((m) => !m.id.includes('-sending') && !m.id.includes('-processing'));
  renderMessages();
  refreshComposerState();

  try {
    await stopMessage(requestAgentId);
  } catch (error) {
    showError(`停止请求失败: ${String(error)}`);
  }
}

// 背景图片相关函数
function onUploadBackgroundImage() {
  const file = backgroundImageUploadInputEl.files?.[0];
  if (!file) return;

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件');
    return;
  }

  // 验证文件大小（最大 10MB）
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showError('图片文件过大，请选择小于 10MB 的图片');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    state.backgroundImageDataUrl = dataUrl;
    localStorage.setItem('iflow-background-image', dataUrl);
    applyBackgroundImage();
    updateBackgroundImagePreview();
    backgroundImageRemoveBtnEl.classList.remove('hidden');
  };
  reader.onerror = () => {
    showError('读取图片失败');
  };
  reader.readAsDataURL(file);
}

function onRemoveBackgroundImage() {
  state.backgroundImageDataUrl = '';
  localStorage.removeItem('iflow-background-image');
  
  // 清除 CSS 变量
  document.documentElement.style.removeProperty('--sidebar-bg-opacity');
  document.documentElement.style.removeProperty('--main-content-bg-opacity');
  document.documentElement.style.removeProperty('--toolbar-bg-opacity');
  document.documentElement.style.removeProperty('--sidebar-rgb');
  document.documentElement.style.removeProperty('--main-content-rgb');
  document.documentElement.style.removeProperty('--toolbar-rgb');
  document.documentElement.style.removeProperty('--background-image-opacity');
  
  applyBackgroundImage();
  updateBackgroundImagePreview();
  backgroundImageRemoveBtnEl.classList.add('hidden');
  backgroundImageUploadInputEl.value = '';
}

function onBackgroundImageOpacityChange() {
  const opacity = backgroundImageOpacityEl.value;
  state.backgroundImageOpacity = parseInt(opacity, 10);
  localStorage.setItem('iflow-background-opacity', opacity);
  applyBackgroundImage();

  // 更新显示的值
  const valueDisplay = backgroundImageOpacityEl.nextElementSibling as HTMLElement;
  if (valueDisplay) {
    valueDisplay.textContent = `${opacity}%`;
  }
}

function applyBackgroundImage() {
  const body = document.body;
  const appContainer = document.getElementById('app');

  if (!state.backgroundImageDataUrl) {
    // 移除背景图片
    body.classList.remove('has-background-image');
    body.style.backgroundImage = '';
    body.style.backgroundColor = '';
    if (appContainer) {
      appContainer.style.backgroundColor = '';
    }
    
    // 清除所有 CSS 变量
    document.documentElement.style.removeProperty('--sidebar-bg-opacity');
    document.documentElement.style.removeProperty('--main-content-bg-opacity');
    document.documentElement.style.removeProperty('--toolbar-bg-opacity');
    document.documentElement.style.removeProperty('--sidebar-rgb');
    document.documentElement.style.removeProperty('--main-content-rgb');
    document.documentElement.style.removeProperty('--toolbar-rgb');
    document.documentElement.style.removeProperty('--background-image-opacity');
    return;
  }

  // 应用背景图片到 body
  body.classList.add('has-background-image');
  body.style.backgroundImage = `url(${state.backgroundImageDataUrl})`;
  body.style.backgroundSize = 'cover';
  body.style.backgroundPosition = 'center';
  body.style.backgroundRepeat = 'no-repeat';
  body.style.backgroundAttachment = 'fixed';

  // 确保 appContainer 是透明的
  if (appContainer) {
    appContainer.style.backgroundColor = 'transparent';
  }

  // 透明度逻辑：
  // 0%透明度：0%背景图片可见，100%原始主题蒙版
  // 100%透明度：100%背景图片可见，0%原始主题蒙版
  // 中间值：背景图片和原始主题蒙版的叠加
  const backgroundImageOpacity = state.backgroundImageOpacity / 100;
  const themeMaskOpacity = 1 - backgroundImageOpacity;
  
  // 动态更新 CSS 变量
  const isLight = body.classList.contains('theme-light');
  
  // 根据主题设置背景色
  if (isLight) {
    // 亮色主题
    const sidebarRgb = '246, 248, 250';
    const mainContentRgb = '255, 255, 255';
    const toolbarRgb = '246, 248, 250';
    
    document.documentElement.style.setProperty('--sidebar-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--main-content-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--toolbar-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--sidebar-rgb', sidebarRgb);
    document.documentElement.style.setProperty('--main-content-rgb', mainContentRgb);
    document.documentElement.style.setProperty('--toolbar-rgb', toolbarRgb);
    document.documentElement.style.setProperty('--background-image-opacity', backgroundImageOpacity.toString());
  } else {
    // 暗色主题
    const sidebarRgb = '22, 27, 34';
    const mainContentRgb = '13, 17, 23';
    const toolbarRgb = '22, 27, 34';
    
    document.documentElement.style.setProperty('--sidebar-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--main-content-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--toolbar-bg-opacity', themeMaskOpacity.toString());
    document.documentElement.style.setProperty('--sidebar-rgb', sidebarRgb);
    document.documentElement.style.setProperty('--main-content-rgb', mainContentRgb);
    document.documentElement.style.setProperty('--toolbar-rgb', toolbarRgb);
    document.documentElement.style.setProperty('--background-image-opacity', backgroundImageOpacity.toString());
  }
  
  // 计算不透明度：透明度越高，不透明度越低
  // 100%透明 -> 10%不透明（保持一点可读性）
  // 0%透明 -> 100%不透明（完全实色）
  const sidebarOpacity = 1 - opacity * 0.9;
  const mainContentOpacity = 1 - opacity * 0.9;
  const toolbarOpacity = 1 - opacity * 0.85;
  
  // 根据主题设置背景色
  if (isLight) {
    // 亮色主题
    const sidebarRgb = '246, 248, 250';
    const mainContentRgb = '255, 255, 255';
    const toolbarRgb = '246, 248, 250';
    
    document.documentElement.style.setProperty('--sidebar-bg-opacity', sidebarOpacity.toString());
    document.documentElement.style.setProperty('--main-content-bg-opacity', mainContentOpacity.toString());
    document.documentElement.style.setProperty('--toolbar-bg-opacity', toolbarOpacity.toString());
    document.documentElement.style.setProperty('--sidebar-rgb', sidebarRgb);
    document.documentElement.style.setProperty('--main-content-rgb', mainContentRgb);
    document.documentElement.style.setProperty('--toolbar-rgb', toolbarRgb);
  } else {
    // 暗色主题
    const sidebarRgb = '22, 27, 34';
    const mainContentRgb = '13, 17, 23';
    const toolbarRgb = '22, 27, 34';
    
    document.documentElement.style.setProperty('--sidebar-bg-opacity', sidebarOpacity.toString());
    document.documentElement.style.setProperty('--main-content-bg-opacity', mainContentOpacity.toString());
    document.documentElement.style.setProperty('--toolbar-bg-opacity', toolbarOpacity.toString());
    document.documentElement.style.setProperty('--sidebar-rgb', sidebarRgb);
    document.documentElement.style.setProperty('--main-content-rgb', mainContentRgb);
    document.documentElement.style.setProperty('--toolbar-rgb', toolbarRgb);
  }
}

function updateBackgroundImagePreview() {
  if (!state.backgroundImageDataUrl) {
    backgroundImagePreviewEl.style.backgroundImage = '';
    backgroundImagePreviewEl.innerHTML = '<span class="background-image-placeholder">暂无背景图片</span>';
    return;
  }

  backgroundImagePreviewEl.style.backgroundImage = `url(${state.backgroundImageDataUrl})`;
  backgroundImagePreviewEl.innerHTML = '';
}

export function initializeBackgroundImage() {
  // 初始化背景图片透明度值
  backgroundImageOpacityEl.value = state.backgroundImageOpacity.toString();
  const valueDisplay = backgroundImageOpacityEl.nextElementSibling as HTMLElement;
  if (valueDisplay) {
    valueDisplay.textContent = `${state.backgroundImageOpacity}%`;
  }

  // 应用已保存的背景图片
  if (state.backgroundImageDataUrl) {
    applyBackgroundImage();
    updateBackgroundImagePreview();
    backgroundImageRemoveBtnEl.classList.remove('hidden');
  }
}
