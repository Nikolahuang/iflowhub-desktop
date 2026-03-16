// iFlow Workspace - Main Entry
import { state } from './store';
import {
  applyTheme,
  syncAppVersion,
  setupEventListeners,
  setupTauriEventListeners,
  setSendButtonMode,
  refreshComposerState,
  initializeBackgroundImage,
} from './features/app';
import { loadAgents, updateCurrentAgentModelUI, updateCurrentAgentThinkUI } from './features/agents';
import { warmUpArtifactPreviewFrame } from './features/ui';
import { initPromptTemplates } from './features/templates';
import { initCommandPaletteStyles } from './features/command-palette';
import { initFavoritesStyles } from './features/favorites';
import { initBranchStyles, branchManager } from './features/branch';
import { initShortcutStyles, initShortcutHelp } from './features/shortcuts';
import { 
  initEnhancementsStyles, 
  themeAccentManager, 
  fontManager, 
  permissionManager,
  createContextIndicator,
  updateContextIndicator 
} from './features/enhancements';
import { initMarket } from './features/market';
import { initSkillsMarket } from './features/skills';

async function init() {
  console.log('Initializing app...');
  
  try {
    // 应用主题
    applyTheme(state.currentTheme);
    
    // 应用主题强调色
    themeAccentManager.applyAccent();
    
    // 应用字体
    fontManager.applyFont();
    
    // 同步版本
    await syncAppVersion();
    
    // 加载 Agents
    await loadAgents();
    
    // 初始化模板库
    initPromptTemplates();
    
    // 初始化命令面板
    initCommandPaletteStyles();
    
    // 初始化收藏夹
    initFavoritesStyles();
    
    // 初始化对话分支
    initBranchStyles();
    
    // 初始化快捷键系统
    initShortcutStyles();
    
    // 初始化市场功能
    initMarket();
    
    // 初始化 Skills 市场功能
    initSkillsMarket();
    
    // 初始化增强功能（上下文余量、权限模式、主题颜色）
    initEnhancementsStyles();
    
    // 设置事件监听
    setupEventListeners();
    setupTauriEventListeners();
    
    // 初始化背景图片
    initializeBackgroundImage();
    
    // 预热 Artifact 预览
    warmUpArtifactPreviewFrame();
    
    // 设置发送按钮模式
    setSendButtonMode('send', true);
    
    // 更新 UI 状态
    updateCurrentAgentModelUI();
    updateCurrentAgentThinkUI();
    refreshComposerState();
    
    // 初始化快捷键帮助（延迟显示）
    setTimeout(() => {
      initShortcutHelp();
    }, 1000);
    
    // 监听 Agent 选择事件，初始化分支管理器
    window.addEventListener('select-agent', ((e: CustomEvent) => {
      branchManager.init(e.detail);
    }) as EventListener);
    
    // 添加上下文指示器到输入区域底部
    const inputHints = document.querySelector('.input-hints');
    if (inputHints) {
      const contextIndicator = createContextIndicator();
      inputHints.appendChild(contextIndicator);
    }
    
    // 定期更新上下文指示器
    setInterval(() => {
      if (state.currentAgentId) {
        const modelId = state.modelOptionsCacheByAgent[state.currentAgentId]?.[0]?.value;
        updateContextIndicator(modelId);
      }
    }, 5000);
    
    console.log('App initialized');
    console.log('Press Ctrl+Shift+P to open command palette');
    console.log(`Permission mode: ${permissionManager.getMode()}`);
    console.log(`Theme accent: ${themeAccentManager.getAccent()}`);
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// 确保 DOM 完全加载后再初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
  });
} else {
  init().catch(console.error);
}
