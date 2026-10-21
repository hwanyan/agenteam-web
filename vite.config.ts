import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地后端地址，需与后端 AGENTEAM_HTTP_ADDR 一致（默认 :8080）。
const BACKEND = 'http://localhost:8080'

export default defineConfig({
  // 部署在 https://xxx/agenteam/ 子路径下，必须设置 base，
  // 否则打包后的 index.html 会引用 /assets/... 导致 404 白屏。
  base: '/agenteam/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
    },
  },
})
