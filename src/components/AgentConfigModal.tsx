import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, ModelOption, Option } from '../types'

interface AgentConfigModalProps {
  agentId: string
  onClose: () => void
  onSaved: (agent: Agent) => void
}

const STATUS_LABEL: Record<string, string> = {
  AGENT_STATUS_UNSPECIFIED: '未知',
  AGENT_STATUS_LOADED: '已加载',
  AGENT_STATUS_RELOADING: '重新加载中',
  AGENT_STATUS_ERROR: '加载失败',
}

export function AgentConfigModal({ agentId, onClose, onSaved }: AgentConfigModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [mcpTools, setMcpTools] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [status, setStatus] = useState<string>('AGENT_STATUS_LOADED')
  const [version, setVersion] = useState<string>('')

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [toolOptions, setToolOptions] = useState<Option[]>([])
  const [skillOptions, setSkillOptions] = useState<Option[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getAgent(agentId),
      api.listModelOptions(),
      api.listMcpToolOptions(),
      api.listSkillOptions(),
    ])
      .then(([agentRes, modelsRes, toolsRes, skillsRes]) => {
        if (cancelled) return
        const agent = agentRes.agent
        setName(agent.name)
        setPrompt(agent.prompt)
        setModel(agent.model)
        setMcpTools(agent.mcpTools ?? [])
        setSkills(agent.skills ?? [])
        setStatus(agent.status)
        setVersion(agent.version)
        setModelOptions(modelsRes.models ?? [])
        setToolOptions(toolsRes.tools ?? [])
        setSkillOptions(skillsRes.skills ?? [])
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : '加载 Agent 配置失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId])

  function toggle(list: string[], value: string, setList: (v: string[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value))
    } else {
      setList([...list, value])
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Agent 名称不能为空')
      return
    }
    if (!prompt.trim()) {
      setError('Agent Prompt 不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await api.updateAgent(agentId, {
        name: name.trim(),
        prompt,
        model,
        mcpTools,
        skills,
      })
      setStatus(res.agent.status)
      setVersion(res.agent.version)
      onSaved(res.agent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Agent 配置</span>
          <span className={`agent-status agent-status-${status.toLowerCase()}`}>
            {STATUS_LABEL[status] ?? status}
            {version ? ` · v${version}` : ''}
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="modal-body modal-loading">加载中...</div>
        ) : (
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <label className="form-label">Agent 名称</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：客服主管"
              maxLength={50}
            />

            <label className="form-label">Agent Prompt</label>
            <textarea
              className="form-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述这个 Agent 的角色、目标与行为准则..."
              rows={8}
            />

            <label className="form-label">LLM 模型</label>
            <select className="form-select" value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.provider}）
                </option>
              ))}
            </select>
            <div className="form-hint">
              {modelOptions.find((m) => m.id === model)?.description}
            </div>

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
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
