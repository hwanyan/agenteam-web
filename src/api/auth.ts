// 访问 token 的本地存取。token 由用户在登录页手动输入（与后端 AGENTEAM_AUTH_TOKENS 对应），
// 不会被打进前端构建产物，避免任何访问页面的人都能直接拿到。
const STORAGE_KEY = 'agenteam.auth_token'
export const UNAUTHORIZED_EVENT = 'agenteam:unauthorized'

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// 后端返回 401 时调用：清除失效 token 并通知 UI 回到登录页。
export function notifyUnauthorized(): void {
  clearToken()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}
