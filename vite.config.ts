import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 如需在本地开发时连接远程 Cloudflare API，取消下方注释并填入你的域名
    // proxy: {
    //   '/api': {
    //     target: 'https://你的域名.pages.dev',
    //     changeOrigin: true,
    //   },
    // },
  },
  test: { environment: 'jsdom' },
})
