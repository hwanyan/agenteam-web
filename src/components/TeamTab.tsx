import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, AgentKind, ModelOption, Option, Team } from '../types'
import { AgentConfigModal } from './AgentConfigModal'
import { CreateAgentModal } from './CreateAgentModal'
import { IconAgent, IconChevronRight, IconLink, IconPlus, IconTrash } from '../icons'

interface TeamTabProps {
  teamId: string | null
  onCreated: (team: Team) => void
  onOpenWorkspace: (team: Team) => void
}

const STATUS_LABEL: Record<string, string> = {
  AGENT_STATUS_UNSPECIFIED: '未知',
  AGENT_STATUS_LOADED: '已加载',
  AGENT_STATUS_RELOADING: '重新加载中',
  AGENT_STATUS_ERROR: '加载失败',
}

interface A2APreview {
  remoteAgentName: string
  remoteDescription: string
  remoteSkills: string[]
  streaming: boolean
}

export function TeamTab({ teamId, onCreated, onOpenWorkspace }: TeamTabProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 主 Agent 创建方式：AGENT_KIND_PROMPT（本地 Prompt 驱动）或 AGENT_KIND_A2A
  // （直接链接一个外部 A2A Agent 提供方作为团队主 Agent）。
  const [kind, setKind] = useState<AgentKind>('AGENT_KIND_PROMPT')

  // AGENT_KIND_PROMPT 表单字段（留空则由后端使用平台默认 Prompt / 默认模型）
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [mcpTools, setMcpTools] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [toolOptions, setToolOptions] = useState<Option[]>([])
  const [skillOptions, setSkillOptions] = useState<Option[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  // AGENT_KIND_A2A 表单字段
  const [endpointUrl, setEndpointUrl] = useState('')
  const [authScheme, setAuthScheme] = useState('bearer')
  const [authToken, setAuthToken] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [a2aPreview, setA2aPreview] = useState<A2APreview | null>(null)

  const [team, setTeam] = useState<Team | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function loadAgents(id: string) {
    return api.listAgents(id).then((res) => setAgents(res.agents ?? []))
  }

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    api
      .getTeam(teamId)
      .then((teamRes) => {
        if (cancelled) return
        setTeam(teamRes.team)
        return loadAgents(teamId)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载团队信息失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  // 仅在"新增团队"表单（teamId 为 null）下才需要加载模型 / MCP 工具 / Skill 可选项，
  // 供主 Agent 走 AGENT_KIND_PROMPT 方式时选择。
  useEffect(() => {
    if (teamId) return
    let cancelled = false
    setOptionsLoading(true)
    Promise.all([api.listModelOptions(), api.listMcpToolOptions(), api.listSkillOptions()])
      .then(([modelsRes, toolsRes, skillsRes]) => {
        if (cancelled) return
        setModelOptions(modelsRes.models ?? [])
        setToolOptions(toolsRes.tools ?? [])
        setSkillOptions(skillsRes.skills ?? [])
        setModel((prev) => prev || modelsRes.models?.[0]?.id || '')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载可选项失败')
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  function toggle(list: string[], value: string, setList: (v: string[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value))
    } else {
      setList([...list, value])
    }
  }

  function switchKind(next: AgentKind) {
    setKind(next)
    setError(null)
  }

  async function handleDiscover() {
    if (!endpointUrl.trim()) {
      setError('A2A 接入地址不能为空')
      return
    }
    setDiscovering(true)
    setError(null)
    setA2aPreview(null)
    try {
      const res = await api.discoverA2AAgent({
        endpointUrl: endpointUrl.trim(),
        authScheme: authScheme || undefined,
        authToken: authToken || undefined,
        tenantId: tenantId.trim() || undefined,
      })
      setA2aPreview(res)
      if (!name.trim() && res.remoteAgentName) {
        setName(res.remoteAgentName)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '连接失败，请检查接入地址与凭证')
    } finally {
      setDiscovering(false)
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('团队名称不能为空')
      return
    }
    setCreating(true)
    setError(null)
    try {
      let res
      if (kind === 'AGENT_KIND_A2A') {
        if (!endpointUrl.trim()) {
          setError('A2A 接入地址不能为空')
          setCreating(false)
          return
        }
        res = await api.createTeam(name.trim(), {
          kind: 'AGENT_KIND_A2A',
          a2aConfig: {
            endpointUrl: endpointUrl.trim(),
            authScheme,
            authToken: authToken || undefined,
            tenantId: tenantId.trim() || undefined,
          },
        })
      } else {
        res = await api.createTeam(name.trim(), {
          kind: 'AGENT_KIND_PROMPT',
          prompt: prompt.trim() || undefined,
          model: model || undefined,
          mcpTools,
          skills,
        })
      }
      setTeam(res.team)
      setAgents([res.mainAgent])
      onCreated(res.team)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建团队失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteAgent(agent: Agent) {
    if (!teamId || agent.isMain) return
    if (!window.confirm(`确认删除 Agent「${agent.name}」吗？此操作不可恢复。`)) return
    setDeletingId(agent.id)
    setError(null)
    try {
      await api.deleteAgent(agent.id)
      setAgents((prev) => prev.filter((a) => a.id !== agent.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  if (!teamId || !team) {
    // 创建团队表单：主 Agent 支持两种创建方式，与"新增 Agent"弹窗保持一致的交互。
    return (
      <div className="page" style={{ overflowY: 'auto' }}>
        <div className="create-team-card">
          <h2>新增团队</h2>
          <p className="text-muted">
            创建团队时会一并创建主 Agent；主 Agent 可以是平台内 Prompt 驱动的 Agent，也可以直接链接一个
            外部 A2A 协议的 Agent。创建后可随时点击主 Agent 卡片进行配置。
          </p>

          <label className="form-label">团队名称</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：客服团队"
            maxLength={50}
          />

          <label className="form-label">主 Agent 创建方式</label>
          <div className="kind-switch">
            <div
              className={`kind-switch-item ${kind === 'AGENT_KIND_PROMPT' ? 'kind-switch-item-active' : ''}`}
              onClick={() => switchKind('AGENT_KIND_PROMPT')}
            >
              <span className="kind-switch-icon">
                <IconAgent size={18} />
              </span>
              <div>
                <div className="kind-switch-title">Prompt 驱动</div>
                <div className="kind-switch-desc">在平台内配置 Prompt、模型、MCP 工具与 Skill</div>
              </div>
            </div>
            <div
              className={`kind-switch-item ${kind === 'AGENT_KIND_A2A' ? 'kind-switch-item-active' : ''}`}
              onClick={() => switchKind('AGENT_KIND_A2A')}
            >
              <span className="kind-switch-icon">
                <IconLink size={18} />
              </span>
              <div>
                <div className="kind-switch-title">A2A 协议链接</div>
                <div className="kind-switch-desc">通过 A2A 协议链接一个外部 Agent 提供方</div>
              </div>
            </div>
          </div>

          {kind === 'AGENT_KIND_A2A' ? (
            <>
              <label className="form-label">A2A 接入地址</label>
              <div className="a2a-discover-row">
                <input
                  className="form-input"
                  value={endpointUrl}
                  onChange={(e) => {
                    setEndpointUrl(e.target.value)
                    setA2aPreview(null)
                  }}
                  placeholder="https://example.com/a2a"
                />
                <button className="btn" onClick={handleDiscover} disabled={discovering}>
                  {discovering ? '连接中...' : '测试连接'}
                </button>
              </div>
              <div className="form-hint">
                服务端会向 该地址/.well-known/agent-card.json 发起 Agent Card 发现请求，校验对端是否为合法的 A2A Agent。
              </div>

              <label className="form-label">鉴权方式</label>
              <select className="form-select" value={authScheme} onChange={(e) => setAuthScheme(e.target.value)}>
                <option value="bearer">Bearer Token</option>
                <option value="">无鉴权</option>
              </select>

              {authScheme === 'bearer' && (
                <>
                  <label className="form-label">
                    Tenant ID <span className="form-label-optional">（对端要求时填写）</span>
                  </label>
                  <input
                    className="form-input"
                    value={tenantId}
                    onChange={(e) => {
                      setTenantId(e.target.value)
                      setA2aPreview(null)
                    }}
                    placeholder="部分外部 Agent 采用 TenantID + Token 双因子鉴权，此处填写分配给你的 Tenant ID"
                  />

                  <label className="form-label">Access Token</label>
                  <input
                    className="form-input"
                    type="password"
                    value={authToken}
                    onChange={(e) => {
                      setAuthToken(e.target.value)
                      setA2aPreview(null)
                    }}
                    placeholder="外部 Agent 提供方分发的 Token"
                  />
                </>
              )}

              {a2aPreview && (
                <div className="a2a-preview">
                  <div className="a2a-preview-title">
                    <IconLink size={15} />
                    {a2aPreview.remoteAgentName || '已连接'}
                    {a2aPreview.streaming && <span className="a2a-preview-streaming">支持流式</span>}
                  </div>
                  {a2aPreview.remoteDescription && (
                    <div className="a2a-preview-desc">{a2aPreview.remoteDescription}</div>
                  )}
                  {a2aPreview.remoteSkills.length > 0 && (
                    <div className="a2a-preview-skills">
                      {a2aPreview.remoteSkills.map((s) => (
                        <span className="a2a-preview-skill" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <label className="form-label">
                Agent Prompt <span className="form-label-optional">（留空使用平台默认 Prompt）</span>
              </label>
              <textarea
                className="form-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述这个主 Agent 的角色、目标与行为准则..."
                rows={6}
              />

              <label className="form-label">LLM 模型</label>
              <select
                className="form-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={optionsLoading}
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}（{m.provider}）
                  </option>
                ))}
              </select>
              <div className="form-hint">{modelOptions.find((m) => m.id === model)?.description}</div>

              <label className="form-label">MCP 工具</label>
              <div className="option-grid">
                {toolOptions.map((t) => (
                  <label key={t.id} className={`option-chip ${mcpTools.includes(t.id) ? 'option-chip-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={mcpTools.includes(t.id)}
                      onChange={() => toggle(mcpTools, t.id, setMcpTools)}
                    />
                    <span className="option-chip-name">{t.name}</span>
                    <span className="option-chip-desc">{t.description}</span>
                  </label>
                ))}
              </div>

              <label className="form-label">Skill</label>
              <div className="option-grid">
                {skillOptions.map((s) => (
                  <label key={s.id} className={`option-chip ${skills.includes(s.id) ? 'option-chip-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={skills.includes(s.id)}
                      onChange={() => toggle(skills, s.id, setSkills)}
                    />
                    <span className="option-chip-name">{s.name}</span>
                    <span className="option-chip-desc">{s.description}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" onClick={handleCreate} disabled={creating}>
            {creating ? '创建中...' : '创建团队'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{team.name}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setAddModalOpen(true)}>
            <IconPlus size={14} />
            新增 Agent
          </button>
          <button className="btn btn-primary" onClick={() => onOpenWorkspace(team)}>
            进入工作区
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && agents.length === 0 ? (
        <div className="text-muted">加载中...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {agents.map((agent) => {
            const isA2A = agent.kind === 'AGENT_KIND_A2A'
            return (
              <div
                className={`agent-card ${isA2A ? 'agent-card-kind-a2a' : ''}`}
                key={agent.id}
                onClick={() => setActiveAgentId(agent.id)}
              >
                <div className="agent-card-icon">{isA2A ? <IconLink size={22} /> : <IconAgent size={22} />}</div>
                <div className="agent-card-body">
                  <div className="agent-card-title">
                    {agent.name}
                    <span className="agent-card-badge">{agent.isMain ? '主 Agent' : '子 Agent'}</span>
                    {isA2A && <span className="agent-card-badge">A2A</span>}
                  </div>
                  {isA2A ? (
                    <>
                      <div className="agent-card-prompt">
                        {agent.a2aConfig?.remoteDescription || agent.a2aConfig?.endpointUrl}
                      </div>
                      <div className="agent-card-meta">
                        <span>接入地址：{agent.a2aConfig?.endpointUrl}</span>
                        <span>技能：{agent.a2aConfig?.remoteSkills?.length ?? 0}</span>
                        <span className={`agent-status agent-status-${agent.status.toLowerCase()}`}>
                          {STATUS_LABEL[agent.status] ?? agent.status}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="agent-card-prompt">{agent.prompt}</div>
                      <div className="agent-card-meta">
                        <span>模型：{agent.model}</span>
                        <span>MCP 工具：{agent.mcpTools?.length ?? 0}</span>
                        <span>Skill：{agent.skills?.length ?? 0}</span>
                        <span className={`agent-status agent-status-${agent.status.toLowerCase()}`}>
                          {STATUS_LABEL[agent.status] ?? agent.status}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {!agent.isMain && (
                  <button
                    className="modal-close"
                    title="删除 Agent"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDeleteAgent(agent)
                    }}
                    disabled={deletingId === agent.id}
                  >
                    <IconTrash size={16} />
                  </button>
                )}
                <div className="agent-card-arrow">
                  <IconChevronRight size={18} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeAgentId && (
        <AgentConfigModal
          agentId={activeAgentId}
          onClose={() => setActiveAgentId(null)}
          onSaved={(updated) => setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
        />
      )}

      {addModalOpen && (
        <CreateAgentModal
          teamId={teamId}
          onClose={() => setAddModalOpen(false)}
          onCreated={(created) => {
            setAgents((prev) => [...prev, created])
            setAddModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
