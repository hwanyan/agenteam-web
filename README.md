# Agent Runtime 平台 · 前端

基于 React + TypeScript + Vite 实现，通过 REST/JSON（grpc-gateway）与后端交互。

## 交互设计

- 左侧边栏：`+ 新增团队` 按钮 + 团队列表。
- 点击“新增团队”：打开一个新 Tab，用于填写团队名称并创建；创建成功后该 Tab
  自动切换为团队详情页（展示自动生成的主 Agent 卡片）。
- 点击主 Agent 卡片：弹出配置弹窗（名称 / Prompt / 模型 / MCP 工具 / Skill），
  右下角“保存”会调用后端 `UpdateAgent`，服务端据此重新加载该 Agent。
- 点击“进入工作区”：打开一个新 Tab，可与该团队的主 Agent 对话；发送消息采用
  流式接口（`sendMessageStream`），Agent 回复以打字机效果逐字显示。

## 目录结构

```
src/api/client.ts          后端 REST 接口封装（含登录 / 注册，自动携带登录 token，401 自动退出）
src/auth/session.ts        登录态存储（token + 用户信息，localStorage 持久化）
src/types.ts               与后端 protojson 对应的类型定义
src/state/useAppState.ts   Tab / 团队列表状态管理
src/components/            AuthPage / Sidebar / TabsBar / TeamTab / WorkspaceTab / AgentConfigModal
```

## 运行

```bash
npm install
npm run dev
```

默认访问 `http://localhost:5173`。接口请求使用同源相对路径（如 `/v1/teams`），
由 `vite.config.ts` 的 `proxy` 转发到 `http://localhost:8080`，因此浏览器侧不存在跨域，
后端也无需配置 CORS。后端端口变化时请同步修改 `vite.config.ts` 里的 `BACKEND`。

生产构建使用 `.env.production` 中的 `VITE_API_BASE_URL=/api/agenteam`，由 nginx 反代到后端，同样是同源。

## 登录与鉴权

不再使用构建时注入的静态 `VITE_AUTH_TOKEN`（已移除，前端产物里不含任何凭证）。
用户先在登录 / 注册页完成身份认证，之后所有请求自动携带 `Authorization: Bearer <登录后获得的 token>`。

- **登录 / 注册**：`src/components/AuthPage.tsx`。注册需要先发送邮箱验证码（60 秒冷却）。账号体系由 hwan 认证服务统一提供，
  与 agently 共用同一套用户，后端 agenteam 代理 `POST /v1/auth:{sendVerifyCode,register,login,refresh,logout}`（路径风格与 agently 一致）。
- **登录态**：`src/auth/session.ts`，token 与用户信息存放在 `localStorage`（键 `agenteam.auth.token` / `agenteam.auth.user`），刷新页面不丢失。
- **自动退出**：业务接口返回 `401`（token 过期、已被登出）时清掉登录态，页面自动回到登录页。`503`（认证服务暂不可用）不会触发退出。
- **退出登录**：侧边栏底部「退出登录」会先通知后端吊销会话，再清掉本地登录态；切换账号时主界面整体重建，不残留上一个用户的数据。

注意：token 存在 `localStorage` 中，页面内任何同源脚本都能读取，因此前端不得渲染未转义的不可信 HTML（Markdown 组件须保持转义）。
