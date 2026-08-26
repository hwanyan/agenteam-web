import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, ModelOption, Option } from '../types'
import { IconClose } from '../icons'

interface CreateAgentModalProps {
  teamId: string
  onClose: () => void
  onCreated: (agent: Agent) => void
}

export function CreateAgentModal({ teamId, onClose, onCreated }: CreateAgentModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [mcpTools, setMcpTools] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [toolOptions, setToolOptions] = useState<Option[]>([])
  const [skillOptions, setSkillOptions] = useState<Option[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([api.listModelOptions(), api.listMcpToolOptions(), api.listSkillOptions()])
      .then(([modelsRes, toolsRes, skillsRes]) => {
        if (cancelled) return
        setModelOptions(modelsRes.models ?? [])
        setToolOptions(toolsRes.tools ?? [])
        setSkillOptions(skillsRes.skills ?? [])
        setModel(modelsRes.models?.[0]?.id ?? '')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : '加载可选项失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggle(list: string[], value: string, setList: (v: string[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value))
    } else {
      setList([...list, value])
    }
  }

  async function handleCreate() {
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
      const res = await api.createAgent(teamId, {
        name: name.trim(),
        prompt,
        model,
        mcpTools,
        skills,
      })
      onCreated(res.agent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>新增 Agent</span>
          <button className="modal-close" onClick={onClose}>
            <IconClose size={16} />
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
              autoFocus
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
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading || saving}>
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
