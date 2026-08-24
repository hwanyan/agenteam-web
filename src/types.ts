// 与后端 pb 定义对应的类型（仅取前端需要的字段，字段命名与 grpc-gateway 生成的
// JSON（protojson，camelCase）保持一致）。

export type AgentStatus =
  | 'AGENT_STATUS_UNSPECIFIED'
  | 'AGENT_STATUS_LOADED'
  | 'AGENT_STATUS_RELOADING'
  | 'AGENT_STATUS_ERROR'

export type MessageRole =
  | 'MESSAGE_ROLE_UNSPECIFIED'
  | 'MESSAGE_ROLE_USER'
  | 'MESSAGE_ROLE_AGENT'
  | 'MESSAGE_ROLE_SYSTEM'

export interface Agent {
  id: string
  teamId: string
  name: string
  prompt: string
  model: string
  mcpTools: string[]
  skills: string[]
  isMain: boolean
  version: string
  status: AgentStatus
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: string
  name: string
  mainAgentId: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  teamId: string
  agentId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface Option {
  id: string
  name: string
  description: string
}

export interface ModelOption extends Option {
  provider: string
}
