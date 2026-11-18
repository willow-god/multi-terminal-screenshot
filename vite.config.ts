import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 端影 · Vite 构建配置（文档：https://vitejs.dev/config/）
export default defineConfig({
  base: '/',
  plugins: [vue()]
})
