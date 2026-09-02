import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Agent, AgentKind, ModelOption, Option } from '../types'
import { IconClose, IconLink } from '../icons'

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

interface A2APreview {
  remoteAgentName: string
  remoteDescription: string
  remoteSkills: string[]
  streaming: boolean
}

export function AgentConfigModal({ agentId, onClose, onSaved }: AgentConfigModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [kind, setKind] = useState<AgentKind>('AGENT_KIND_PROMPT')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string>('AGENT_STATUS_LOADED')
  const [version, setVersion] = useState<string>('')

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
  const [authTokenSet, setAuthTokenSet] = useState(false)
  const [a2aPreview, setA2aPreview] = useState<A2APreview | null>(null)
  const [discovering, setDiscovering] = useState(false)

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
        setKind(agent.kind)
        setName(agent.name)
        setStatus(agent.status)
        setVersion(agent.version)
        if (agent.kind === 'AGENT_KIND_A2A') {
          setEndpointUrl(agent.a2aConfig?.endpointUrl ?? '')
          setAuthScheme(agent.a2aConfig?.authScheme || 'bearer')
          setAuthTokenSet(Boolean(agent.a2aConfig?.authTokenSet))
          if (agent.a2aConfig?.remoteAgentName) {
            setA2aPreview({
              remoteAgentName: agent.a2aConfig.remoteAgentName,
              remoteDescription: agent.a2aConfig.remoteDescription ?? '',
              remoteSkills: agent.a2aConfig.remoteSkills ?? [],
              streaming: Boolean(agent.a2aConfig.streaming),
            })
          }
        } else {
          setPrompt(agent.prompt)
          setModel(agent.model)
          setMcpTools(agent.mcpTools ?? [])
          setSkills(agent.skills ?? [])
        }
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

  async function handleDiscover() {
    if (!endpointUrl.trim()) {
      setError('A2A 接入地址不能为空')
      return
    }
    setDiscovering(true)
    setError(null)
    try {
      const res = await api.discoverA2AAgent({
        endpointUrl: endpointUrl.trim(),
        authScheme: authScheme || undefined,
        // 未修改凭证时传空，让服务端沿用已保存的 Token 做连通性探测的语义一致性
        // 此处仅用于前端预览，故直接用当前输入框内容（可能为空，代表复用旧凭证时无法在此处验证，属预期）。
        authToken: authToken || undefined,
      })
      setA2aPreview(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '连接失败，请检查接入地址与凭证')
    } finally {
      setDiscovering(false)
    }
  }

  async function handleSave() {
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
        res = await api.updateAgent(agentId, {
          name: name.trim(),
          a2aConfig: { endpointUrl: endpointUrl.trim(), authScheme, authToken: authToken || undefined },
        })
      } else {
        if (!prompt.trim()) {
          setError('Agent Prompt 不能为空')
          setSaving(false)
          return
        }
        res = await api.updateAgent(agentId, {
          name: name.trim(),
          prompt,
          model,
          mcpTools,
          skills,
        })
      }
      setStatus(res.agent.status)
      setVersion(res.agent.version)
      if (res.agent.kind === 'AGENT_KIND_A2A') {
        setAuthTokenSet(Boolean(res.agent.a2aConfig?.authTokenSet))
        setAuthToken('')
        if (res.agent.a2aConfig?.remoteAgentName) {
          setA2aPreview({
            remoteAgentName: res.agent.a2aConfig.remoteAgentName,
            remoteDescription: res.agent.a2aConfig.remoteDescription ?? '',
            remoteSkills: res.agent.a2aConfig.remoteSkills ?? [],
            streaming: Boolean(res.agent.a2aConfig.streaming),
          })
        }
      }
      onSaved(res.agent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const isA2A = kind === 'AGENT_KIND_A2A'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Agent 配置</span>
          {isA2A && (
            <span className="agent-card-badge">
              <IconLink size={11} /> A2A
            </span>
          )}
          <span className={`agent-status agent-status-${status.toLowerCase()}`}>
            {STATUS_LABEL[status] ?? status}
            {version ? ` · v${version}` : ''}
          </span>
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
            />

            {isA2A ? (
              <>
                <label className="form-label">A2A 接入地址</label>
                <div className="a2a-discover-row">
                  <input
                    className="form-input"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://example.com/a2a"
                  />
                  <button className="btn" onClick={handleDiscover} disabled={discovering}>
                    {discovering ? '连接中...' : '重新测试'}
                  </button>
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
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder={authTokenSet ? '已配置（留空则保持不变）' : '外部 Agent 提供方分发的 Token'}
                    />
                    <div className="form-hint">
                      {authTokenSet ? '已保存凭证，出于安全考虑不会回显；留空保存即保持原凭证不变。' : '尚未配置凭证。'}
                    </div>
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
              </>
            )}
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
