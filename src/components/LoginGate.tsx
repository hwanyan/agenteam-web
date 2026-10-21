import { useState } from 'react'
import { api, ApiError } from '../api/client'
import { clearToken, setToken } from '../api/auth'
import { IconMark } from '../icons'

export function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [token, setTokenValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) {
      setError('请输入访问 token')
      return
    }
    setSubmitting(true)
    setError(null)
    setToken(trimmed)
    try {
      // 用一个轻量的只读接口校验 token 是否有效。
      await api.listTeams()
      onLogin()
    } catch (err) {
      clearToken()
      setError(err instanceof ApiError && err.status === 401 ? 'token 无效' : err instanceof Error ? err.message : '校验失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page page-center" style={{ height: '100vh' }}>
      <form onSubmit={submit} style={{ width: 360, maxWidth: '90vw' }}>
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconMark size={40} />
          </div>
          <div className="empty-state-title">Agent Runtime</div>
          <div className="text-muted">请输入访问 token</div>
        </div>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          className={`form-input ${error ? 'form-input-invalid' : ''}`}
          style={{ marginTop: 16 }}
          value={token}
          onChange={(e) => {
            setTokenValue(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Access token"
        />
        {error && <div className="form-field-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? '校验中…' : '进入'}
        </button>
      </form>
    </div>
  )
}
