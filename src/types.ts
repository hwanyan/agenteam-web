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
  // 部分第三方 A2A Agent 采用“TenantID + Token”双因子鉴权模型：除 Authorization:
  // Bearer <token> 外，还要求通过 X-A2A-Tenant-Id 请求头显式声明调用方的租户身份，
  // 二者缺一不可。tenantId 由对端预先分配、属非机密的身份标识（类似 AccessKeyId），
  // 与 authToken 不同，服务端会如实回显，不需要脱敏。留空表示对端不需要该头。
  tenantId?: string
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

// 一次工具调用的展示信息，用于在回复下方展示"这条回复过程中调用了哪个工具"。
export interface ToolCallInfo {
  // 同一条回复内唯一；流式过程中据此把 running 更新为 done / error
  id: string
  // 面向用户的展示名称
  name: string
  // "agent"：团队主 Agent 把请求委派给了某个子 Agent；"tool"：Agent 在处理过程中调用的工具
  kind: 'agent' | 'tool' | string
  // 入参（JSON 字符串，可能被截断）；可能为空
  arguments?: string
  status: 'running' | 'done' | 'error' | string
}

export interface ChatMessage {
  id: string
  teamId: string
  agentId: string
  role: MessageRole
  content: string
  createdAt: string
  // 模型的思考过程（如 DeepSeek Reasoner 返回的 reasoning_content）；模型不提供时为空
  reasoning?: string
  // 生成这条回复的过程中发生的工具调用，按发生顺序排列
  toolCalls?: ToolCallInfo[]
}

// SendMessageStream 流式响应的单个分片：
// - 第一条只携带 userMessage（不含 delta）；
// - 中间每条携带一段增量文本 delta，或一段思考过程 reasoningDelta，或一次工具调用状态 toolCall；
// - 同一个工具调用 id 会先以 running 出现，结束后再以 done / error 出现一次，按 id 合并即可；
// - 最后一条 done=true，并携带完整的 agentMessage（含最终的思考过程与工具调用）。
export interface SendMessageStreamChunk {
  delta?: string
  reasoningDelta?: string
  toolCall?: ToolCallInfo
  done?: boolean
  userMessage?: ChatMessage
  agentMessage?: ChatMessage
}

export interface Option {
  id: string
  name: string
  description: string
  // 是否为某个团队自行接入的自定义 MCP 工具（true），区别于平台内置静态清单（false/undefined）。
  // 仅 listMcpToolOptions 会返回 true 的情形；前端据此为自定义工具渲染"编辑"入口。
  isCustom?: boolean
}

export interface ModelOption extends Option {
  provider: string
}

// 某个团队自行接入的自定义 MCP 工具（区别于平台内置的静态清单，见 Option）。
// 按团队隔离，仅归属团队可见可选；apiKey 只在“创建/更新”请求中由前端提交，
// 服务端任何响应都不会回显明文，只会带上 apiKeySet 标记是否已配置。
export interface McpTool {
  id: string
  teamId: string
  name: string
  baseUrl: string
  apiKeySet: boolean
  timeoutSeconds: number
  createdAt: string
  updatedAt: string
}
