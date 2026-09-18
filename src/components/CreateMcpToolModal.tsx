import { useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Option } from '../types'
import { IconClose } from '../icons'

interface CreateMcpToolModalProps {
  onClose: () => void
  // 创建成功后回调，返回可直接并入 MCP 工具选择列表的 Option（description 展示 base_url）。
  onCreated: (tool: Option) => void
}

// CreateMcpToolModal 用于接入一个新的自定义 MCP 工具，供「新增 Agent」「Agent 配置」
// 「新增团队」三处的 MCP 工具选择列表复用（列表下方的「接入新的 MCP 工具」按钮统一打开本弹窗）。
export function CreateMcpToolModal({ onClose, onCreated }: CreateMcpToolModalProps) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
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
      const res = await api.createMcpTool({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey || undefined,
        timeoutSeconds: timeoutSeconds.trim() ? Number(timeoutSeconds) : undefined,
      })
      onCreated({ id: res.tool.id, name: res.tool.name, description: res.tool.baseUrl })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '接入失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <div className="modal-header">
          <span>接入新的 MCP 工具</span>
          <button className="modal-close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
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
            placeholder="该 MCP 工具的鉴权密钥，如无需鉴权可留空"
          />

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
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? '接入中...' : '接入'}
          </button>
        </div>
      </div>
    </div>
  )
}
