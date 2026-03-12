// src/dom.ts — DOM element references

export const addAgentBtnEl = document.getElementById('add-agent-btn') as HTMLButtonElement;
export const agentListEl = document.getElementById('agent-list') as HTMLDivElement;
export const sessionListEl = document.getElementById('session-list') as HTMLDivElement;
export const chatMessagesEl = document.getElementById('chat-messages') as HTMLDivElement;
export const messageInputEl = document.getElementById('message-input') as HTMLTextAreaElement;
export const sendBtnEl = document.getElementById('send-btn') as HTMLButtonElement;
export const addAgentModalEl = document.getElementById('add-agent-modal') as HTMLDivElement;
export const closeModalBtnEl = document.getElementById('close-modal') as HTMLButtonElement;
export const cancelAddAgentBtnEl = document.getElementById('cancel-add-agent') as HTMLButtonElement;
export const confirmAddAgentBtnEl = document.getElementById('confirm-add-agent') as HTMLButtonElement;
export const workspacePathInputEl = document.getElementById('workspace-path') as HTMLInputElement;
export const browseWorkspacePathBtnEl = document.getElementById('browse-workspace-path') as HTMLButtonElement;
export const renameAgentModalEl = document.getElementById('rename-agent-modal') as HTMLDivElement;
export const closeRenameAgentModalBtnEl = document.getElementById(
  'close-rename-agent-modal'
) as HTMLButtonElement;
export const cancelRenameAgentBtnEl = document.getElementById(
  'cancel-rename-agent'
) as HTMLButtonElement;
export const confirmRenameAgentBtnEl = document.getElementById(
  'confirm-rename-agent'
) as HTMLButtonElement;
export const renameAgentNameInputEl = document.getElementById('rename-agent-name') as HTMLInputElement;
export const currentAgentNameEl = document.getElementById('current-agent-name') as HTMLHeadingElement;
export const currentAgentStatusEl = document.getElementById('current-agent-status') as HTMLSpanElement;
export const currentAgentModelBtnEl = document.getElementById('current-agent-model-btn') as HTMLButtonElement;
export const currentAgentModelTextEl = document.getElementById('current-agent-model-text') as HTMLSpanElement;
export const currentAgentModelMenuEl = document.getElementById('current-agent-model-menu') as HTMLDivElement;
export const toggleThinkBtnEl = document.getElementById('toggle-think-btn') as HTMLButtonElement;
export const openToolCallsBtnEl = document.getElementById('open-tool-calls-btn') as HTMLButtonElement;
export const openGitChangesBtnEl = document.getElementById('open-git-changes-btn') as HTMLButtonElement;
export const toolCallsPanelEl = document.getElementById('tool-calls-panel') as HTMLDivElement;
export const toolCallsListEl = document.getElementById('tool-calls-list') as HTMLDivElement;
export const closeToolPanelBtnEl = document.getElementById('close-tool-panel') as HTMLButtonElement;
export const gitChangesPanelEl = document.getElementById('git-changes-panel') as HTMLDivElement;
export const gitChangesListEl = document.getElementById('git-changes-list') as HTMLDivElement;
export const gitChangesRefreshTimeEl = document.getElementById('git-changes-refresh-time') as HTMLSpanElement;
export const refreshGitChangesBtnEl = document.getElementById('refresh-git-changes') as HTMLButtonElement;
export const closeGitChangesPanelBtnEl = document.getElementById('close-git-panel') as HTMLButtonElement;
export const newSessionBtnEl = document.getElementById('new-session-btn') as HTMLButtonElement;
export const clearChatBtnEl = document.getElementById('clear-chat-btn') as HTMLButtonElement;
export const connectionStatusEl = document.getElementById('connection-status') as HTMLDivElement;
export const clearAllSessionsBtnEl = document.getElementById('clear-all-sessions') as HTMLButtonElement;
export const inputStatusHintEl = document.getElementById('input-status-hint') as HTMLSpanElement;
export const slashCommandMenuEl = document.getElementById('slash-command-menu') as HTMLDivElement;
export const artifactPreviewModalEl = document.getElementById('artifact-preview-modal') as HTMLDivElement;
export const closeArtifactPreviewBtnEl = document.getElementById('close-artifact-preview') as HTMLButtonElement;
export const artifactPreviewPathEl = document.getElementById('artifact-preview-path') as HTMLDivElement;
export const artifactPreviewFrameEl = document.getElementById('artifact-preview-frame') as HTMLIFrameElement;
export const gitDiffModalEl = document.getElementById('git-diff-modal') as HTMLDivElement;
export const closeGitDiffBtnEl = document.getElementById('close-git-diff') as HTMLButtonElement;
export const gitDiffPathEl = document.getElementById('git-diff-path') as HTMLSpanElement;
export const gitDiffContentEl = document.getElementById('git-diff-content') as HTMLPreElement;
export const openSettingsBtnEl = document.getElementById('open-settings-btn') as HTMLButtonElement;
export const settingsModalEl = document.getElementById('settings-modal') as HTMLDivElement;
export const closeSettingsModalBtnEl = document.getElementById(
  'close-settings-modal'
) as HTMLButtonElement;
export const closeSettingsFooterBtnEl = document.getElementById(
  'close-settings-footer-btn'
) as HTMLButtonElement;
export const themeToggleBtnEl = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
export const autoReconnectModeSelectEl = document.getElementById(
  'auto-reconnect-mode-select'
) as HTMLSelectElement;
export const notificationSoundSelectEl = document.getElementById('notification-sound-select') as HTMLSelectElement;
export const notificationDelayMinuteInputEl = document.getElementById(
  'notification-delay-minute'
) as HTMLInputElement;
export const notificationDelaySecondInputEl = document.getElementById(
  'notification-delay-second'
) as HTMLInputElement;
export const notificationSoundUploadBtnEl = document.getElementById(
  'notification-sound-upload-btn'
) as HTMLButtonElement;
export const notificationSoundUploadInputEl = document.getElementById(
  'notification-sound-upload-input'
) as HTMLInputElement;
export const appVersionEl = document.getElementById('app-version') as HTMLDivElement;

// 背景图片相关元素
export const backgroundImageUploadInputEl = document.getElementById(
  'background-image-upload-input'
) as HTMLInputElement;
export const backgroundImageUploadBtnEl = document.getElementById(
  'background-image-upload-btn'
) as HTMLButtonElement;
export const backgroundImageRemoveBtnEl = document.getElementById(
  'background-image-remove-btn'
) as HTMLButtonElement;
export const backgroundImagePreviewEl = document.getElementById(
  'background-image-preview'
) as HTMLDivElement;
export const backgroundImageOpacityEl = document.getElementById(
  'background-image-opacity'
) as HTMLInputElement;

// 模板库相关元素
export const openTemplatesBtnEl = document.getElementById('open-templates-btn') as HTMLButtonElement;
export const templatesModalEl = document.getElementById('templates-modal') as HTMLDivElement;
export const closeTemplatesModalBtnEl = document.getElementById('close-templates-modal') as HTMLButtonElement;
export const templateSearchEl = document.getElementById('template-search') as HTMLInputElement;
export const addTemplateBtnEl = document.getElementById('add-template-btn') as HTMLButtonElement;
export const templatesListEl = document.getElementById('templates-list') as HTMLDivElement;

// 模板变量弹窗
export const templateVariablesModalEl = document.getElementById('template-variables-modal') as HTMLDivElement;
export const closeTemplateVariablesModalBtnEl = document.getElementById('close-template-variables-modal') as HTMLButtonElement;
export const templateVariablesTitleEl = document.getElementById('template-variables-title') as HTMLHeadingElement;
export const templateVariablesBodyEl = document.getElementById('template-variables-body') as HTMLDivElement;

// 导出功能相关元素
export const exportSessionBtnEl = document.getElementById('export-session-btn') as HTMLButtonElement;
export const exportModalEl = document.getElementById('export-modal') as HTMLDivElement;
export const closeExportModalBtnEl = document.getElementById('close-export-modal') as HTMLButtonElement;
export const cancelExportBtnEl = document.getElementById('cancel-export-btn') as HTMLButtonElement;
export const confirmExportBtnEl = document.getElementById('confirm-export-btn') as HTMLButtonElement;
export const exportIncludeTimestampsEl = document.getElementById('export-include-timestamps') as HTMLInputElement;
export const exportIncludeToolCallsEl = document.getElementById('export-include-tool-calls') as HTMLInputElement;
export const exportIncludeSystemEl = document.getElementById('export-include-system') as HTMLInputElement;

// 模板编辑器相关元素
export const templateEditorModalEl = document.getElementById('template-editor-modal') as HTMLDivElement;
export const closeTemplateEditorModalBtnEl = document.getElementById('close-template-editor-modal') as HTMLButtonElement;
export const templateEditorTitleEl = document.getElementById('template-editor-title') as HTMLHeadingElement;
export const templateNameInputEl = document.getElementById('template-name-input') as HTMLInputElement;
export const templateDescriptionInputEl = document.getElementById('template-description-input') as HTMLInputElement;
export const templateCategorySelectEl = document.getElementById('template-category-select') as HTMLSelectElement;
export const templateContentInputEl = document.getElementById('template-content-input') as HTMLTextAreaElement;
export const cancelTemplateEditorBtnEl = document.getElementById('cancel-template-editor-btn') as HTMLButtonElement;
export const saveTemplateBtnEl = document.getElementById('save-template-btn') as HTMLButtonElement;

// 会话重命名相关元素
export const renameSessionModalEl = document.getElementById('rename-session-modal') as HTMLDivElement;
export const closeRenameSessionModalBtnEl = document.getElementById('close-rename-session-modal') as HTMLButtonElement;
export const cancelRenameSessionBtnEl = document.getElementById('cancel-rename-session') as HTMLButtonElement;
export const confirmRenameSessionBtnEl = document.getElementById('confirm-rename-session') as HTMLButtonElement;
export const renameSessionTitleInputEl = document.getElementById('rename-session-title') as HTMLInputElement;

// MCP 市场相关元素
export const openMcpMarketBtnEl = document.getElementById('open-mcp-market-btn') as HTMLButtonElement;
export const mcpMarketModalEl = document.getElementById('mcp-market-modal') as HTMLDivElement;
export const closeMcpMarketModalBtnEl = document.getElementById('close-mcp-market-modal') as HTMLButtonElement;
export const refreshMcpMarketBtnEl = document.getElementById('refresh-mcp-market-btn') as HTMLButtonElement;
export const refreshInstalledMcpBtnEl = document.getElementById('refresh-installed-mcp-btn') as HTMLButtonElement;
export const mcpMarketContainerEl = document.getElementById('mcp-market-container') as HTMLDivElement;
export const installedMcpContainerEl = document.getElementById('installed-mcp-container') as HTMLDivElement;

// Agent 市场相关元素
export const openAgentMarketBtnEl = document.getElementById('open-agent-market-btn') as HTMLButtonElement;
export const agentMarketModalEl = document.getElementById('agent-market-modal') as HTMLDivElement;
export const closeAgentMarketModalBtnEl = document.getElementById('close-agent-market-modal') as HTMLButtonElement;
export const refreshAgentMarketBtnEl = document.getElementById('refresh-agent-market-btn') as HTMLButtonElement;
export const refreshInstalledAgentBtnEl = document.getElementById('refresh-installed-agent-btn') as HTMLButtonElement;
export const agentMarketContainerEl = document.getElementById('agent-market-container') as HTMLDivElement;
export const installedAgentsContainerEl = document.getElementById('installed-agents-container') as HTMLDivElement;

// 收藏夹相关元素
export const openFavoritesBtnEl = document.getElementById('open-favorites-btn') as HTMLButtonElement;
export const favoritesModalEl = document.getElementById('favorites-modal') as HTMLDivElement;
export const closeFavoritesModalBtnEl = document.getElementById('close-favorites-modal') as HTMLButtonElement;
export const favoritesListEl = document.getElementById('favorites-list') as HTMLDivElement;

// 分支相关元素
export const openBranchBtnEl = document.getElementById('open-branch-btn') as HTMLButtonElement;
export const branchModalEl = document.getElementById('branch-modal') as HTMLDivElement;
export const closeBranchModalBtnEl = document.getElementById('close-branch-modal') as HTMLButtonElement;
export const branchListEl = document.getElementById('branch-list') as HTMLDivElement;
