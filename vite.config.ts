import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 部署在 https://xxx/agenteam/ 子路径下，必须设置 base，
  // 否则打包后的 index.html 会引用 /assets/... 导致 404 白屏。
  base: '/agenteam/',
  plugins: [react()],
  server: {
    port: 5173,
  },
})
