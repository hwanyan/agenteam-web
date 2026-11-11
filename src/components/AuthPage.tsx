import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { setSession } from '../auth/session'
import { IconMark } from '../icons'

type Mode = 'login' | 'register'

// 与后端（hwan 认证服务）的校验规则保持一致：用户名 3-64 位字母 / 数字 / 下划线 / 连字符，密码至少 6 位。
const USERNAME_RE = /^[A-Za-z0-9_-]{3,64}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_COOLDOWN_SECONDS = 60

interface FieldErrors {
  username?: string
  email?: string
  password?: string
  verifyCode?: string
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [verifyCode, setVerifyCode] = useState('')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<number | null>(null)

  const isLogin = mode === 'login'

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
    setFormError('')
    setNotice('')
    setPassword('')
    setVerifyCode('')
  }

  function startCooldown() {
    setCooldown(CODE_COOLDOWN_SECONDS)
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setCooldown((n) => {
        if (n <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return n - 1
      })
    }, 1000)
  }

  async function handleSendCode() {
    setFormError('')
    setNotice('')
    if (!EMAIL_RE.test(email.trim())) {
      setErrors((e) => ({ ...e, email: '请输入有效的邮箱地址' }))
      return
    }
    setErrors((e) => ({ ...e, email: undefined }))
    setSendingCode(true)
    try {
      const res = await api.sendVerifyCode(email.trim(), 'register')
      setNotice(res.message || '验证码已发送，请查收邮件')
      startCooldown()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '验证码发送失败')
    } finally {
      setSendingCode(false)
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (isLogin) {
      if (!username.trim()) next.username = '请输入用户名或邮箱'
      if (!password) next.password = '请输入密码'
      return next
    }
    if (!USERNAME_RE.test(username.trim())) next.username = '用户名需为 3-64 位字母、数字、下划线或连字符'
    if (!EMAIL_RE.test(email.trim())) next.email = '请输入有效的邮箱地址'
    if (password.length < 6) next.password = '密码至少 6 位'
    if (!/^\d{6}$/.test(verifyCode.trim())) next.verifyCode = '请输入 6 位数字验证码'
    return next
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setFormError('')
    setNotice('')
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSubmitting(true)
    try {
      const res = isLogin
        ? await api.login(username.trim(), password)
        : await api.register({
            username: username.trim(),
            email: email.trim(),
            password,
            nickname: nickname.trim() || undefined,
            verifyCode: verifyCode.trim(),
          })
      // 写入登录态后，App 通过订阅自动切换到主界面
      setSession(res.token, res.refreshToken, res.user)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '请求失败，请稍后重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <IconMark size={26} className="auth-brand-mark" />
          <div>
            <div className="auth-brand-title">AGENT RUNTIME</div>
            <div className="auth-brand-sub">多团队智能体管理台</div>
          </div>
        </div>

        <h1 className="auth-title">{isLogin ? '登录' : '创建账号'}</h1>

        <form onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <>
              <label className="form-label">
                邮箱<span className="form-label-required">*</span>
              </label>
              <input
                className={`form-input ${errors.email ? 'form-input-invalid' : ''}`}
                type="email"
                value={email}
                autoComplete="email"
                placeholder="your@email.com"
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <div className="form-field-error">{errors.email}</div>}

              <label className="form-label">
                邮箱验证码<span className="form-label-required">*</span>
              </label>
              <div className="auth-code-row">
                <input
                  className={`form-input ${errors.verifyCode ? 'form-input-invalid' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  autoComplete="one-time-code"
                  placeholder="6 位数字验证码"
                  onChange={(e) => setVerifyCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={sendingCode || cooldown > 0}
                  onClick={() => void handleSendCode()}
                >
                  {sendingCode ? '发送中...' : cooldown > 0 ? `${cooldown}s` : '发送验证码'}
                </button>
              </div>
              {errors.verifyCode && <div className="form-field-error">{errors.verifyCode}</div>}
            </>
          )}

          <label className="form-label">
            {isLogin ? '用户名 / 邮箱' : '用户名'}
            <span className="form-label-required">*</span>
          </label>
          <input
            className={`form-input ${errors.username ? 'form-input-invalid' : ''}`}
            type="text"
            value={username}
            autoComplete="username"
            placeholder={isLogin ? '用户名或邮箱' : '3-64 位字母 / 数字 / 下划线'}
            onChange={(e) => setUsername(e.target.value)}
          />
          {errors.username && <div className="form-field-error">{errors.username}</div>}

          {!isLogin && (
            <>
              <label className="form-label">
                昵称 <span className="form-label-optional">（可选）</span>
              </label>
              <input
                className="form-input"
                type="text"
                value={nickname}
                autoComplete="nickname"
                placeholder="你的昵称"
                onChange={(e) => setNickname(e.target.value)}
              />
            </>
          )}

          <label className="form-label">
            密码<span className="form-label-required">*</span>
          </label>
          <input
            className={`form-input ${errors.password ? 'form-input-invalid' : ''}`}
            type="password"
            value={password}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder={isLogin ? '输入密码' : '至少 6 位'}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <div className="form-field-error">{errors.password}</div>}

          {notice && <div className="auth-notice">{notice}</div>}
          {formError && <div className="form-error">{formError}</div>}

          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
            {submitting ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button type="button" className="auth-switch-btn" onClick={() => switchMode(isLogin ? 'register' : 'login')}>
            {isLogin ? '立即注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
