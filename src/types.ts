// 与后端 pb 定义对应的类型（仅取前端需要的字段，字段命名与 grpc-gateway 生成的
// JSON（protojson，camelCase）保持一致）。

export type AgentStatus =
  | 'AGENT_STATUS_UNSPECIFIED'
  | 'AGENT_STATUS_LOADED'
  | 'AGENT_STATUS_RELOADING'
  | 'AGENT_STATUS_ERROR'

// Agent 的创建/接入方式：本地 Prompt + LLM 驱动，或通过 A2A 协议链接外部 Agent。
// 未显式指定时，后端按 'AGENT_KIND_PROMPT' 处理（兼容旧数据/旧客户端）。
export type AgentKind = 'AGENT_KIND_UNSPECIFIED' | 'AGENT_KIND_PROMPT' | 'AGENT_KIND_A2A'

export type MessageRole =
  | 'MESSAGE_ROLE_UNSPECIFIED'
  | 'MESSAGE_ROLE_USER'
  | 'MESSAGE_ROLE_AGENT'
  | 'MESSAGE_ROLE_SYSTEM'

// A2A（Agent2Agent）协议接入配置。authToken 只在“写”场景（创建/保存表单）由前端
// 持有并提交给后端；服务端任何响应都不会回显其明文值，只会带上 authTokenSet
// 标记是否已配置凭证，因此展示态代码不应依赖 authToken 字段。
export interface A2AConfig {
  endpointUrl: string
  authScheme?: string
  authToken?: string
  authTokenSet?: boolean
  // 以下为只读字段，由后端在加载/保存时通过 Agent Card 发现请求回填
  remoteAgentName?: string
  remoteDescription?: string
  remoteSkills?: string[]
  streaming?: boolean
}

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
  kind: AgentKind
  a2aConfig?: A2AConfig
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

// SendMessageStream 流式响应的单个分片：
// - 第一条只携带 userMessage（不含 delta）；
// - 中间每条携带一段增量文本 delta；
// - 最后一条 done=true，并携带完整的 agentMessage。
export interface SendMessageStreamChunk {
  delta?: string
  done?: boolean
  userMessage?: ChatMessage
  agentMessage?: ChatMessage
}

export interface Option {
  id: string
  name: string
  description: string
}

export interface ModelOption extends Option {
  provider: string
}
