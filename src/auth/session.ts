// 登录态存储：Access Token + Refresh Token + 用户信息，持久化到 localStorage，并提供订阅接口（配合 useSyncExternalStore）。
//
// - Access Token：短寿命（默认 15 分钟），每个请求都带；过期后由 api 层用 Refresh Token 自动换新。
// - Refresh Token：长寿命，只用于换取新令牌；每次刷新都会轮换（旧的立即作废），所以必须及时写回这里。
//
// 说明：localStorage 中的令牌可被同源 XSS 读取，这与 agently-web 的做法一致。
// 前端因此不渲染未转义的不可信 HTML（Markdown 组件需保持转义）。
// 多个标签页共享同一份 localStorage，监听 storage 事件保证登录 / 登出 / 刷新在标签页之间同步。

export interface AuthUser {
  id: string
  username: string
  email: string
  nickname: string
  avatarUrl: string
  // 平台级角色（user / admin，来自 hwan auth）。仅用于决定是否展示管理员入口（如“全部团队”）；
  // 真正的授权由后端按 Token 里的 roles 判断。旧版本登录态里没有该字段，按普通用户处理。
  // 与团队内角色（Team.myRole）是两套互不相干的概念。
  role?: string
}

/** 是否为平台管理员。 */
export function isPlatformAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin'
}

export interface Session {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
}

const TOKEN_KEY = 'agenteam.auth.token'
const REFRESH_KEY = 'agenteam.auth.refresh'
const USER_KEY = 'agenteam.auth.user'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 隐私模式 / 存储被禁用：退化为仅内存中的登录态，刷新页面后需重新登录
  }
}

function readStored(): Session {
  const token = safeGet(TOKEN_KEY)
  const refreshToken = safeGet(REFRESH_KEY)
  // 两个令牌必须同时存在才算已登录
  if (!token || !refreshToken) return { token: null, refreshToken: null, user: null }
  let user: AuthUser | null = null
  try {
    const raw = safeGet(USER_KEY)
    user = raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    user = null
  }
  return { token, refreshToken, user }
}

// snapshot 只在登录态变化时整体替换，保证 useSyncExternalStore 的快照引用稳定
let snapshot: Session = readStored()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getSession(): Session {
  return snapshot
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 其它标签页登录 / 登出 / 刷新时，同步本标签页的内存快照。
// （storage 事件只在“其它”文档修改 localStorage 时触发，本标签页自己的修改不会触发，因此不会死循环。）
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== TOKEN_KEY && e.key !== REFRESH_KEY && e.key !== USER_KEY) return
    snapshot = readStored()
    emit()
  })
}

/** 写入登录态（登录 / 注册 / 刷新成功后调用）。user 缺省时沿用已有用户信息。 */
export function setSession(token: string, refreshToken: string, user?: AuthUser | null) {
  const nextUser = user ?? snapshot.user
  safeSet(TOKEN_KEY, token)
  safeSet(REFRESH_KEY, refreshToken)
  safeSet(USER_KEY, nextUser ? JSON.stringify(nextUser) : null)
  snapshot = { token, refreshToken, user: nextUser }
  emit()
}

export function clearSession() {
  if (!snapshot.token && !snapshot.refreshToken && !snapshot.user) return
  safeSet(TOKEN_KEY, null)
  safeSet(REFRESH_KEY, null)
  safeSet(USER_KEY, null)
  snapshot = { token: null, refreshToken: null, user: null }
  emit()
}
