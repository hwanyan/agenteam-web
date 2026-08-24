import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, Team } from '../types'
import { AgentConfigModal } from './AgentConfigModal'

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
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    api
      .getTeam(teamId)
      .then((teamRes) => {
        if (cancelled) return
        setTeam(teamRes.team)
        return api.getAgent(teamRes.team.mainAgentId)
      })
      .then((agentRes) => {
        if (cancelled || !agentRes) return
        setAgent(agentRes.agent)
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
      setAgent(res.mainAgent)
      onCreated(res.team)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建团队失败，请重试')
    } finally {
      setCreating(false)
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
        <button className="btn btn-primary" onClick={() => onOpenWorkspace(team)}>
          进入工作区
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && !agent ? (
        <div className="text-muted">加载中...</div>
      ) : (
        agent && (
          <div className="agent-card" onClick={() => setModalOpen(true)}>
            <div className="agent-card-icon">🤖</div>
            <div className="agent-card-body">
              <div className="agent-card-title">
                {agent.name}
                <span className="agent-card-badge">主 Agent</span>
              </div>
              <div className="agent-card-prompt">{agent.prompt}</div>
              <div className="agent-card-meta">
                <span>模型：{agent.model}</span>
                <span>MCP 工具：{agent.mcpTools?.length ?? 0}</span>
                <span>Skill：{agent.skills?.length ?? 0}</span>
                <span className={`agent-status agent-status-${agent.status.toLowerCase()}`}>
                  {STATUS_LABEL[agent.status] ?? agent.status}
                </span>
              </div>
            </div>
            <div className="agent-card-arrow">›</div>
          </div>
        )
      )}

      {modalOpen && agent && (
        <AgentConfigModal
          agentId={agent.id}
          onClose={() => setModalOpen(false)}
          onSaved={(updated) => setAgent(updated)}
        />
      )}
    </div>
  )
}
