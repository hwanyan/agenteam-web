import type { Agent, ChatMessage, ModelOption, Option, Team } from '../types'

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
  updateAgent: (
    id: string,
    payload: { name: string; prompt: string; model: string; mcpTools: string[]; skills: string[] },
  ) =>
    request<{ agent: Agent }>(`/v1/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  listModelOptions: () => request<{ models: ModelOption[] }>('/v1/options/models'),
  listMcpToolOptions: () => request<{ tools: Option[] }>('/v1/options/mcp-tools'),
  listSkillOptions: () => request<{ skills: Option[] }>('/v1/options/skills'),

  // ---- Workspace ----
  sendMessage: (teamId: string, content: string) =>
    request<{ userMessage: ChatMessage; agentMessage: ChatMessage }>(`/v1/teams/${teamId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  listMessages: (teamId: string) => request<{ messages: ChatMessage[] }>(`/v1/teams/${teamId}/messages`),
}
