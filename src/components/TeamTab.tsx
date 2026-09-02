import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, Team } from '../types'
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

export function TeamTab({ teamId, onCreated, onOpenWorkspace }: TeamTabProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function handleCreate() {
    if (!name.trim()) {
      setError('团队名称不能为空')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await api.createTeam(name.trim())
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
    // 创建团队表单
    return (
      <div className="page page-center">
        <div className="create-team-card">
          <h2>新增团队</h2>
          <p className="text-muted">创建团队后会自动生成一个主 Agent，你可以随时点击主 Agent 卡片进行配置。</p>
          <label className="form-label">团队名称</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：客服团队"
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
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
