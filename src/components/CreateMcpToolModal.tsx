import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Option } from '../types'
import { IconCheck, IconClose } from '../icons'

interface CreateMcpToolModalProps {
  // 归属团队 id：创建新工具时使用（自定义 MCP 工具按团队隔离，仅对该团队可见可选）；
  // 编辑模式下已知工具本身归属哪个团队，可不传。
  teamId?: string
  // 传入 editId 时进入"编辑"模式：加载该工具现有配置、保存时调用更新接口；
  // 不传则为"新增"模式（此时 teamId 必填）。
  editId?: string
  onClose: () => void
  // 用户在"成功提示"弹窗中点击确定后回调，返回可直接并入 MCP 工具选择列表的 Option
  // （description 展示 base_url）。调用方在此回调里更新列表并关闭本弹窗即可。
  onSaved: (tool: Option) => void
}

// CreateMcpToolModal 用于接入一个新的自定义 MCP 工具，或编辑一个已接入的自定义 MCP 工具，
// 供「新增 Agent」「Agent 配置」两处的 MCP 工具选择列表复用
// （列表下方的「接入新的 MCP 工具」按钮打开新增模式；自定义工具旁的编辑图标打开编辑模式）。
//
// 保存成功后，表单弹窗会被"成功提示"弹窗取代（表单随之关闭），用户点击"确定"后才通知调用方，
// 避免保存后界面毫无反馈、用户不确定是否录入成功。
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
  // 字段级校验提示：名称 / Base URL 为必填项
  const [nameError, setNameError] = useState<string | null>(null)
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null)
  // 保存成功后的结果；非空时展示"成功提示"弹窗
  const [savedTool, setSavedTool] = useState<Option | null>(null)

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
    const trimmedName = name.trim()
    const trimmedBaseUrl = baseUrl.trim()
    const nextNameError = trimmedName ? null : 'MCP 工具名称不能为空'
    const nextBaseUrlError = trimmedBaseUrl ? null : 'Base URL 不能为空'
    setNameError(nextNameError)
    setBaseUrlError(nextBaseUrlError)
    if (nextNameError || nextBaseUrlError) {
      setError(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: trimmedName,
        baseUrl: trimmedBaseUrl,
        apiKey: apiKey || undefined,
        timeoutSeconds: timeoutSeconds.trim() ? Number(timeoutSeconds) : undefined,
      }
      const res = isEdit ? await api.updateMcpTool(editId as string, payload) : await api.createMcpTool(teamId as string, payload)
      setSavedTool({ id: res.tool.id, name: res.tool.name, description: res.tool.baseUrl, isCustom: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : isEdit ? '保存失败，请重试' : '接入失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (savedTool) {
    return (
      <div className="modal-overlay" onClick={() => onSaved(savedTool)}>
        <div className="success-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="success-dialog-icon">
            <IconCheck size={22} />
          </div>
          <div className="success-dialog-title">{isEdit ? 'MCP 工具保存成功' : '新增 MCP 工具成功'}</div>
          <div className="success-dialog-desc">
            「{savedTool.name}」{isEdit ? '的配置已更新' : '已接入'}
          </div>
          <button className="btn btn-primary btn-block" autoFocus onClick={() => onSaved(savedTool)}>
            确定
          </button>
        </div>
      </div>
    )
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

            <label className="form-label">
              名称<span className="form-label-required">*</span>
            </label>
            <input
              className={`form-input ${nameError ? 'form-input-invalid' : ''}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              placeholder="当前 mcp 工具的名称"
              autoFocus
            />
            {nameError && <div className="form-field-error">{nameError}</div>}

            <label className="form-label">
              Base URL<span className="form-label-required">*</span>
            </label>
            <input
              className={`form-input ${baseUrlError ? 'form-input-invalid' : ''}`}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                if (baseUrlError) setBaseUrlError(null)
              }}
              placeholder="https://example.com/mcp"
            />
            {baseUrlError && <div className="form-field-error">{baseUrlError}</div>}

            <label className="form-label">
              API Key <span className="form-label-optional">（非必填）</span>
            </label>
            <input
              className="form-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit && apiKeySet ? '已配置（留空则保持不变）' : '该 MCP 工具的鉴权密钥，如无需鉴权可留空'}
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
