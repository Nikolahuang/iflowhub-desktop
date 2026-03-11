// src/config.ts - centralized runtime configuration

export const TIMEOUTS = {
  artifactPreview: 12000,
  gitDiff: 12000,
  messageSend: 300000,  // 5 minutes for complex tasks
} as const;
