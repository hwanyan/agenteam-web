import type {
  A2AConfig,
  Agent,
  ChatMessage,
  McpTool,
  ModelOption,
  Option,
  SendMessageStreamChunk,
  Team,
  TeamMember,
  TeamRole,
} from '../types'
import { clearSession, getSession, setSession, type AuthUser } from '../auth/session'

// 默认空串：请求走当前页面同源的相对路径（开发时由 vite proxy 转发到后端，生产经 nginx 反代，
// 后端因此无需处理 CORS）。生产构建通过 .env.production 设为 /api/agenteam。
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// 登录 / 注册 / 发验证码 / 刷新 / 登出接口的路径前缀。这些接口的 401 表示「账号、验证码或刷新令牌无效」之类的业务失败，
// 不代表当前登录态需要刷新，因此既不触发自动刷新，也不触发自动退出。
const AUTH_PATH_PREFIX = '/v1/auth:'

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// ---- Access Token 自动刷新 ----
//
// Access Token 很短（默认 15 分钟），过期后业务接口返回 401。此时用 Refresh Token 换一对新令牌并重试原请求，
// 用户无感知；只有刷新也失败（Refresh Token 过期 / 被吊销 / 被禁用）才回到登录页。
//
// 两层互斥，缺一不可：
//   1. 同一标签页内，多个并发请求同时 401，只发一次刷新（inflightRefresh 合并）；
//   2. 多个标签页之间，用 Web Locks 串行化，并在拿到锁后先看 localStorage 里的 token 是否已被其它标签页换新。
// Refresh Token 每次使用都会轮换，两个标签页拿同一个旧的 Refresh Token 去刷新，后到者会被服务端当成重放，
// 整条登录链路被吊销、用户被迫重新登录——这正是需要互斥的原因。
let inflightRefresh: Promise<boolean> | null = null

function refreshSession(usedToken: string | null): Promise<boolean> {
  if (!inflightRefresh) {
    inflightRefresh = runExclusive(() => doRefresh(usedToken)).finally(() => {
      inflightRefresh = null
    })
  }
  return inflightRefresh
}

async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request('agenteam-auth-refresh', fn)
  }
  return fn()
}

async function doRefresh(usedToken: string | null): Promise<boolean> {
  const cur = getSession()
  if (!cur.refreshToken) return false
  // 等锁期间别的标签页（或别的请求）已经换过新 token：直接用它重试，不要再拿旧 Refresh Token 去刷新
  if (usedToken && cur.token && cur.token !== usedToken) return true

  try {
    const resp = await fetch(`${BASE_URL}${AUTH_PATH_PREFIX}refresh`, {
      method: 'POST',
      headers: buildHeaders(null),
      body: JSON.stringify({ refreshToken: cur.refreshToken }),
    })
    if (resp.ok) {
      const data = (await resp.json()) as { token: string; refreshToken: string; user: AuthUser }
      setSession(data.token, data.refreshToken, data.user)
      return true
    }
    // 401/403：Refresh Token 已失效或账号被禁用，登录态无法挽回
    if (resp.status === 401 || resp.status === 403) clearSession()
    // 其它（如 503 认证服务暂不可用）：保留登录态，下次请求再试，避免服务抖动把用户踢下线
    return false
  } catch {
    return false // 网络错误：同上，保留登录态
  }
}

// refreshUserProfile 在本地登录态缺少平台角色（role）时主动刷新一次令牌，把 auth 返回的最新用户信息补进来。
// 场景：升级前就已登录的用户，localStorage 里的 user 没有 role 字段，会被当作普通用户，管理员看不到管理员入口。
// 必须复用 refreshSession 的互斥：Refresh Token 每次使用都会轮换，多个标签页 / 并发请求各自刷新会被服务端当成重放。
// 失败（网络、认证服务暂不可用）一律静默忽略：只是少了管理员入口，下次令牌自然过期刷新时会补上。
export async function ensureUserRole(): Promise<void> {
  const cur = getSession()
  if (!cur.token || !cur.refreshToken || !cur.user || cur.user.role !== undefined) return
  await refreshSession(null).catch(() => undefined)
}

// authedFetch 发起带登录态的请求；遇到 401 时刷新令牌并重试一次。
// 401 发生在服务端处理之前（鉴权层），因此重试不会造成非幂等请求被重复执行。
async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(token) })

  const usedToken = getSession().token
  let resp = await send(usedToken)
  if (resp.status !== 401 || path.startsWith(AUTH_PATH_PREFIX)) return resp

  if (await refreshSession(usedToken)) {
    resp = await send(getSession().token)
    // 换了新令牌仍然 401：登录态确实无效
    if (resp.status === 401) clearSession()
  }
  return resp
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await authedFetch(path, init ?? {})
  const text = await resp.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    // 非 JSON 响应（如网关层返回的 HTML 错误页）：按下面的状态码分支处理
  }
  if (!resp.ok) {
    // grpc-gateway 的错误响应形如 { code, message, details }
    const message = (data && (data.message as string)) || `请求失败（${resp.status}）`
    throw new ApiError(message, resp.status)
  }
  return data as T
}

// requestStream 消费 grpc-gateway server-streaming 接口返回的 HTTP chunked 响应体：
// 每个分片是一行 JSON，正常分片形如 { result: {...} }，出错分片形如
// { error: { code, message } }。逐行读取、解析后通过 onChunk 回调给上层。
async function requestStream<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal },
  onChunk: (chunk: T) => void,
): Promise<void> {
  const resp = await authedFetch(path, init)
  if (!resp.ok || !resp.body) {
    let message = `请求失败（${resp.status}）`
    try {
      const data = JSON.parse(await resp.text())
      message = (data && (data.message as string)) || message
    } catch {
      // ignore：无法解析的错误体，使用默认 message
    }
    throw new ApiError(message, resp.status)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const parsed = JSON.parse(trimmed) as { result?: T; error?: { code: number; message: string } }
    if (parsed.error) {
      throw new ApiError(parsed.error.message || '流式响应出错', 0)
    }
    if (parsed.result) {
      onChunk(parsed.result)
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIdx: number
    while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)
      consumeLine(line)
    }
  }
  if (buffer.trim()) {
    consumeLine(buffer)
  }
}

export interface AuthResult {
  token: string // Access Token
  refreshToken: string
  expiresIn: number // Access Token 有效期（秒）
  user: AuthUser
}

export const api = {
  // ---- Auth（登录 / 注册由后端代理到 hwan 认证服务）----
  // purpose：register（注册，默认）/ reset_password
  sendVerifyCode: (email: string, purpose: 'register' | 'reset_password' = 'register') =>
    request<{ message: string }>('/v1/auth:sendVerifyCode', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),
  register: (payload: { username: string; email: string; password: string; nickname?: string; verifyCode: string }) =>
    request<AuthResult>('/v1/auth:register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (username: string, password: string) =>
    request<AuthResult>('/v1/auth:login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  // logout 吊销服务端会话。调用方应无论成败都清掉本地登录态。
  logout: () => request<{ message: string }>('/v1/auth:logout', { method: 'POST', body: '{}' }),

  // ---- Team ----
  // 团队创建时会一并创建主 Agent，因此支持与 createAgent 一致的两种创建方式：
  //   - AGENT_KIND_PROMPT（默认，未传 kind 时按此方式处理）：prompt/model 留空则使用平台默认值；
  //   - AGENT_KIND_A2A：主 Agent 直接链接一个外部 A2A Agent 提供方。
  createTeam: (
    name: string,
    payload?:
      | { kind: 'AGENT_KIND_PROMPT'; prompt?: string; model?: string; mcpTools?: string[]; skills?: string[] }
      | { kind: 'AGENT_KIND_A2A'; a2aConfig: A2AConfig },
  ) =>
    request<{ team: Team; mainAgent: Agent }>('/v1/teams', {
      method: 'POST',
      body: JSON.stringify({ name, ...payload }),
    }),
  // listTeams 默认只返回“我所在的团队”；all=true 仅平台管理员可用，返回平台内全部团队
  // （非管理员传 all=true 会得到 403）。
  listTeams: (opts?: { all?: boolean }) =>
    request<{ teams: Team[] }>(`/v1/teams${opts?.all ? '?all=true' : ''}`),
  getTeam: (id: string) => request<{ team: Team }>(`/v1/teams/${id}`),
  // deleteTeam 软删除团队，仅团队 owner（或平台管理员）可操作。
  deleteTeam: (id: string) => request<Record<string, never>>(`/v1/teams/${id}`, { method: 'DELETE' }),

  // ---- Team Members（团队成员管理；这里的角色是团队级角色，与平台角色无关）----
  // 成员列表：owner 在前，其余按加入时间升序。团队成员可见。
  listTeamMembers: (teamId: string) => request<{ members: TeamMember[] }>(`/v1/teams/${teamId}/members`),
  // 邀请用户加入团队（直接加入，无需对方确认），仅 owner 可用。按用户名精确匹配（不区分大小写），
  // 被邀请人必须至少登录过本平台一次；role 留空按 member 处理。
  addTeamMember: (teamId: string, username: string, role: Exclude<TeamRole, 'TEAM_ROLE_UNSPECIFIED'>) =>
    request<{ member: TeamMember }>(`/v1/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    }),
  // 修改成员角色，仅 owner 可用；不允许把团队最后一个 owner 降级。
  updateTeamMemberRole: (teamId: string, userId: string, role: Exclude<TeamRole, 'TEAM_ROLE_UNSPECIFIED'>) =>
    request<{ member: TeamMember }>(`/v1/teams/${teamId}/members/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  // 移除成员。owner 可移除任何人；任何成员都可以移除自己（退出团队）；不允许移除最后一个 owner。
  removeTeamMember: (teamId: string, userId: string) =>
    request<Record<string, never>>(`/v1/teams/${teamId}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  // ---- Agent ----
  getAgent: (id: string) => request<{ agent: Agent }>(`/v1/agents/${id}`),
  listAgents: (teamId: string) => request<{ agents: Agent[] }>(`/v1/teams/${teamId}/agents`),
  createAgent: (
    teamId: string,
    payload:
      | { kind: 'AGENT_KIND_PROMPT'; name: string; prompt: string; model: string; mcpTools: string[]; skills: string[] }
      | { kind: 'AGENT_KIND_A2A'; name: string; a2aConfig: A2AConfig },
  ) =>
    request<{ agent: Agent }>(`/v1/teams/${teamId}/agents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAgent: (
    id: string,
    payload:
      | { name: string; prompt: string; model: string; mcpTools: string[]; skills: string[] }
      | { name: string; a2aConfig: A2AConfig },
  ) =>
    request<{ agent: Agent }>(`/v1/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  // discoverA2AAgent 探测一个 A2A 外部 Agent 的连通性与展示信息（不产生持久化副作用），
  // 供创建/保存 A2A Agent 前预览对端的名称/描述/技能/是否支持流式。
  discoverA2AAgent: (payload: { endpointUrl: string; authScheme?: string; authToken?: string; tenantId?: string }) =>
    request<{ remoteAgentName: string; remoteDescription: string; remoteSkills: string[]; streaming: boolean }>(
      '/v1/a2a/discover',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  listModelOptions: () => request<{ models: ModelOption[] }>('/v1/options/models'),
  // listMcpToolOptions 返回可选的 MCP 工具清单：平台内置静态清单 + 指定团队自行接入的
  // 自定义工具（按团队隔离，不同团队互不可见）。teamId 留空时（如"新增团队"表单场景，
  // 团队尚未创建）只返回内置静态清单。
  listMcpToolOptions: (teamId?: string) =>
    request<{ tools: Option[] }>(`/v1/options/mcp-tools${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ''}`),
  listSkillOptions: () => request<{ skills: Option[] }>('/v1/options/skills'),
  // createMcpTool 在指定团队下接入一个新的自定义 MCP 工具；成功后会与内置工具合并
  // 出现在该团队的 listMcpToolOptions 返回结果中，仅供该团队的 Agent 选择绑定。
  // id 始终由服务端生成（形如 "mcp_tool_<6位随机数字/字母>"），前端不提供指定 id 的入口；
  // apiKey/timeoutSeconds 均非必填：timeoutSeconds 留空则默认 30 秒。
  createMcpTool: (teamId: string, payload: { name: string; baseUrl: string; apiKey?: string; timeoutSeconds?: number }) =>
    request<{ tool: McpTool }>(`/v1/teams/${teamId}/mcp-tools`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // getMcpTool 查询单个自定义 MCP 工具详情，供编辑表单回填（apiKey 不回显明文）。
  getMcpTool: (id: string) => request<{ tool: McpTool }>(`/v1/mcp-tools/${id}`),
  // updateMcpTool 更新一个自定义 MCP 工具的配置；apiKey 留空表示不修改现有密钥，非空则覆盖。
  updateMcpTool: (id: string, payload: { name: string; baseUrl: string; apiKey?: string; timeoutSeconds?: number }) =>
    request<{ tool: McpTool }>(`/v1/mcp-tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  // deleteMcpTool 删除一个自定义 MCP 工具；服务端会同步清理所属团队下所有 Agent 对它的绑定引用，
  // affectedAgents 为被清理了引用的 Agent 数量（为 0 时 grpc-gateway 会省略该字段）。
  deleteMcpTool: (id: string) => request<{ affectedAgents?: number }>(`/v1/mcp-tools/${id}`, { method: 'DELETE' }),
  deleteAgent: (id: string) => request<Record<string, never>>(`/v1/agents/${id}`, { method: 'DELETE' }),

  // ---- Workspace ----
  sendMessage: (teamId: string, content: string) =>
    request<{ userMessage: ChatMessage; agentMessage: ChatMessage }>(`/v1/teams/${teamId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  // sendMessageStream 以 grpc-gateway server-streaming（HTTP chunked，每行一个 JSON）
  // 方式发起对话；onChunk 会在收到每个分片时被调用，用于实现打字机效果。
  // signal 可用于中途取消（如组件卸载/切换团队）。
  sendMessageStream: (teamId: string, content: string, onChunk: (chunk: SendMessageStreamChunk) => void, signal?: AbortSignal) =>
    requestStream(`/v1/teams/${teamId}/messages:stream`, { method: 'POST', body: JSON.stringify({ content }), signal }, onChunk),
  listMessages: (teamId: string) => request<{ messages: ChatMessage[] }>(`/v1/teams/${teamId}/messages`),
}
