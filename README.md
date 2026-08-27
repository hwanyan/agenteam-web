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
src/api/client.ts          后端 REST 接口封装
src/types.ts               与后端 protojson 对应的类型定义
src/state/useAppState.ts   Tab / 团队列表状态管理
src/components/            Sidebar / TabsBar / TeamTab / WorkspaceTab / AgentConfigModal
```

## 运行

```bash
npm install
npm run dev
```

默认访问 `http://localhost:5173`，接口默认请求 `http://localhost:8080`
（可通过 `.env.local` 中的 `VITE_API_BASE_URL` 覆盖）。

请确保后端服务（见 `agenteam` 后端仓库 README）已启动。
