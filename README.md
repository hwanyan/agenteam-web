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
- 团队详情页右上角「成员管理 / 团队成员」：弹窗中查看团队成员；owner 可邀请成员（按用户名）、修改角色、移除成员，
  任何成员都可以退出团队。详见下文「团队成员与权限」。

## 团队成员与权限（两套角色，互不相干）

| | 平台角色 | 团队角色 |
| --- | --- | --- |
| 取值 | `user` / `admin` | `owner` / `member` |
| 含义 | 这个人是不是整个平台的管理员 | 这个人在**某个团队**里能做什么 |
| 来源 | hwan auth，登录响应里的 `user.role`（`AuthUser.role`） | agenteam 的 `team_members` 表，团队接口里的 `Team.myRole` |

- 侧边栏默认只列出「我的团队」；**平台管理员**额外有「查看全部团队」开关（对应 `GET /v1/teams?all=true`），管理员越过成员校验，在任何团队内都按 owner 对待。
- **owner**：看到「成员管理」「新增 Agent」「删除团队」，Agent 卡片上有删除按钮，Agent 配置弹窗可编辑保存，可接入 / 编辑 / 删除 MCP 工具。
- **member**：只读 —— 团队页只有「团队成员」（可退出团队）和「进入工作区」，Agent 配置弹窗为只读（所有字段禁用、无保存按钮），不能管理 MCP 工具；仍可在工作区对话。
- 邀请成员直接加入、无需对方确认；被邀请的人必须至少登录过本平台一次，否则提示“用户不存在，或该用户尚未登录过本平台”。
- 团队至少保留一名 owner，最后一个 owner 不能被降级或移除（后端校验，前端原样展示错误）。
- **前端的显隐只是体验优化**，真正的授权始终由后端判断：绕过前端直接调接口，越权请求同样会被后端拒绝（非成员返回 404，成员越权返回 403）。

## 目录结构

```
src/api/client.ts          后端 REST 接口封装（含登录 / 注册、团队成员管理，自动携带登录 token，401 自动退出）
src/auth/session.ts        登录态存储（token + 用户信息，localStorage 持久化）与平台角色判断 isPlatformAdmin
src/types.ts               与后端 protojson 对应的类型定义
src/state/useAppState.ts   Tab / 团队列表状态管理
src/components/            AuthPage / Sidebar / TabsBar / TeamTab / WorkspaceTab / AgentConfigModal / TeamMembersModal
src/components/teamRole.ts 团队角色的标签与判断（isTeamOwner / roleLabel）
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
