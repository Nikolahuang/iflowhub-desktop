import { defineConfig } from "vite";

export default defineConfig(async () => ({
  // 使用相对路径，确保 Tauri 生产环境能正确加载资源
  base: './',
  // Vite options tailored for Tauri development and specifically ignore the "src-tauri" directory
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));