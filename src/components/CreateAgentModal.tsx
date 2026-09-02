import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, AgentKind, ModelOption, Option } from '../types'
import { IconAgent, IconClose, IconLink } from '../icons'

interface CreateAgentModalProps {
  teamId: string
  onClose: () => void
  onCreated: (agent: Agent) => void
}

interface A2APreview {
  remoteAgentName: string
  remoteDescription: string
  remoteSkills: string[]
  streaming: boolean
}

export function CreateAgentModal({ teamId, onClose, onCreated }: CreateAgentModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [kind, setKind] = useState<AgentKind>('AGENT_KIND_PROMPT')
  const [name, setName] = useState('')

  // AGENT_KIND_PROMPT 表单字段
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [mcpTools, setMcpTools] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [toolOptions, setToolOptions] = useState<Option[]>([])
  const [skillOptions, setSkillOptions] = useState<Option[]>([])

  // AGENT_KIND_A2A 表单字段
  const [endpointUrl, setEndpointUrl] = useState('')
  const [authScheme, setAuthScheme] = useState('bearer')
  const [authToken, setAuthToken] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [a2aPreview, setA2aPreview] = useState<A2APreview | null>(null)

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
      setError('Agent 名称不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let res
      if (kind === 'AGENT_KIND_A2A') {
        if (!endpointUrl.trim()) {
          setError('A2A 接入地址不能为空')
          setSaving(false)
          return
        }
        res = await api.createAgent(teamId, {
          kind: 'AGENT_KIND_A2A',
          name: name.trim(),
          a2aConfig: { endpointUrl: endpointUrl.trim(), authScheme, authToken: authToken || undefined },
        })
      } else {
        if (!prompt.trim()) {
          setError('Agent Prompt 不能为空')
          setSaving(false)
          return
        }
        res = await api.createAgent(teamId, {
          kind: 'AGENT_KIND_PROMPT',
          name: name.trim(),
          prompt,
          model,
          mcpTools,
          skills,
        })
      }
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

            <label className="form-label">创建方式</label>
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

            <label className="form-label">Agent 名称</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：客服主管"
              maxLength={50}
              autoFocus
            />

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
              </>
            )}
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
