import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Option } from '../types'
import { IconClose } from '../icons'

interface CreateMcpToolModalProps {
  // 归属团队 id：创建新工具时使用（自定义 MCP 工具按团队隔离，仅对该团队可见可选）；
  // 编辑模式下已知工具本身归属哪个团队，可不传。
  teamId?: string
  // 传入 editId 时进入"编辑"模式：加载该工具现有配置、保存时调用更新接口；
  // 不传则为"新增"模式（此时 teamId 必填）。
  editId?: string
  onClose: () => void
  // 创建/更新成功后回调，返回可直接并入 MCP 工具选择列表的 Option（description 展示 base_url）。
  onSaved: (tool: Option) => void
}

// CreateMcpToolModal 用于接入一个新的自定义 MCP 工具，或编辑一个已接入的自定义 MCP 工具，
// 供「新增 Agent」「Agent 配置」「新增团队」三处的 MCP 工具选择列表复用
// （列表下方的「接入新的 MCP 工具」按钮打开新增模式；自定义工具旁的编辑图标打开编辑模式）。
export function CreateMcpToolModal({ teamId, editId, onClose, onSaved }: CreateMcpToolModalProps) {
  const isEdit = Boolean(editId)
  const [loading, setLoading] = useState(isEdit)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [timeoutSeconds, setTimeoutSeconds] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    api
      .getMcpTool(editId)
      .then((res) => {
        if (cancelled) return
        setName(res.tool.name)
        setBaseUrl(res.tool.baseUrl)
        setApiKeySet(res.tool.apiKeySet)
        setTimeoutSeconds(String(res.tool.timeoutSeconds || ''))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载工具配置失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  async function handleSubmit() {
    if (!name.trim()) {
      setError('名称不能为空')
      return
    }
    if (!baseUrl.trim()) {
      setError('base_url 不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey || undefined,
        timeoutSeconds: timeoutSeconds.trim() ? Number(timeoutSeconds) : undefined,
      }
      const res = isEdit ? await api.updateMcpTool(editId as string, payload) : await api.createMcpTool(teamId as string, payload)
      onSaved({ id: res.tool.id, name: res.tool.name, description: res.tool.baseUrl, isCustom: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : isEdit ? '保存失败，请重试' : '接入失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <div className="modal-header">
          <span>{isEdit ? '编辑 MCP 工具' : '接入新的 MCP 工具'}</span>
          <button className="modal-close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        {loading ? (
          <div className="modal-body modal-loading">加载中...</div>
        ) : (
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <label className="form-label">名称</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="当前 mcp 工具的名称"
              autoFocus
            />

            <label className="form-label">Base URL</label>
            <input
              className="form-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com/mcp"
            />

            <label className="form-label">
              API Key <span className="form-label-optional">（非必填）</span>
            </label>
            <input
              className="form-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit ? (apiKeySet ? '已配置（留空则保持不变）' : '该 MCP 工具的鉴权密钥，如无需鉴权可留空') : '该 MCP 工具的鉴权密钥，如无需鉴权可留空'}
            />
            {isEdit && (
              <div className="form-hint">
                {apiKeySet ? '已保存密钥，出于安全考虑不会回显；留空保存即保持原密钥不变。' : '尚未配置密钥。'}
              </div>
            )}

            <label className="form-label">
              超时时间（秒） <span className="form-label-optional">（非必填，留空默认 30 秒）</span>
            </label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(e.target.value)}
              placeholder="30"
            />
          </div>
        )}
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || saving}>
            {saving ? '保存中...' : isEdit ? '保存' : '接入'}
          </button>
        </div>
      </div>
    </div>
  )
}
