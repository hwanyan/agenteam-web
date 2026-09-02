import type { A2AConfig, Agent, ChatMessage, ModelOption, Option, SendMessageStreamChunk, Team } from '../types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const text = await resp.text()
  const data = text ? JSON.parse(text) : {}
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
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
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

export const api = {
  // ---- Team ----
  createTeam: (name: string) =>
    request<{ team: Team; mainAgent: Agent }>('/v1/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  listTeams: () => request<{ teams: Team[] }>('/v1/teams'),
  getTeam: (id: string) => request<{ team: Team }>(`/v1/teams/${id}`),
  deleteTeam: (id: string) => request<Record<string, never>>(`/v1/teams/${id}`, { method: 'DELETE' }),

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
  discoverA2AAgent: (payload: { endpointUrl: string; authScheme?: string; authToken?: string }) =>
    request<{ remoteAgentName: string; remoteDescription: string; remoteSkills: string[]; streaming: boolean }>(
      '/v1/a2a/discover',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  listModelOptions: () => request<{ models: ModelOption[] }>('/v1/options/models'),
  listMcpToolOptions: () => request<{ tools: Option[] }>('/v1/options/mcp-tools'),
  listSkillOptions: () => request<{ skills: Option[] }>('/v1/options/skills'),
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
