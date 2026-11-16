import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { Team, TeamMember, TeamRole } from '../types'
import { IconClose } from '../icons'
import { isTeamOwner, roleLabel } from './teamRole'

type AssignableRole = Exclude<TeamRole, 'TEAM_ROLE_UNSPECIFIED'>

interface TeamMembersModalProps {
  team: Team
  /** 当前登录用户的 id，用于标记“我”，以及判断是否在移除自己（退出团队）。 */
  currentUserId: string
  onClose: () => void
  /** 当前用户自己退出团队成功后回调：调用方应关闭该团队相关的标签页并刷新团队列表。 */
  onLeft: () => void
}

// TeamMembersModal 展示并管理团队成员。这里的角色是团队级角色（owner / member）。
//   - owner（含越过成员校验的平台管理员）：可邀请成员、修改角色、移除任何人；
//   - member：只读成员列表，并可退出团队。
// 前端的显隐只是体验优化，权限始终由后端判断：越权请求会得到后端的明确错误并原样展示。
export function TeamMembersModal({ team, currentUserId, onClose, onLeft }: TeamMembersModalProps) {
  const canManage = isTeamOwner(team)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [inviteRole, setInviteRole] = useState<AssignableRole>('TEAM_ROLE_MEMBER')
  const [inviting, setInviting] = useState(false)
  // 正在执行改角色 / 移除的成员 id，用于禁用对应行的操作，防止重复提交
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  function reload() {
    return api.listTeamMembers(team.id).then((res) => setMembers(res.members ?? []))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listTeamMembers(team.id)
      .then((res) => {
        if (!cancelled) setMembers(res.members ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载团队成员失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [team.id])

  async function handleInvite() {
    const name = username.trim()
    if (!name) {
      setError('请输入被邀请人的用户名')
      return
    }
    setInviting(true)
    setError(null)
    setNotice(null)
    try {
      const res = await api.addTeamMember(team.id, name, inviteRole)
      setUsername('')
      setNotice(`已将「${res.member.username || name}」加入团队`)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '邀请失败，请重试')
    } finally {
      setInviting(false)
    }
  }

  async function handleChangeRole(member: TeamMember, role: AssignableRole) {
    if (member.role === role) return
    setBusyUserId(member.userId)
    setError(null)
    setNotice(null)
    try {
      await api.updateTeamMemberRole(team.id, member.userId, role)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改角色失败，请重试')
      // 失败后重新拉取，让下拉框回到真实角色
      await reload().catch(() => undefined)
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleRemove(member: TeamMember) {
    const isSelf = member.userId === currentUserId
    const label = member.username || member.userId
    const message = isSelf
      ? `确认退出团队「${team.name}」吗？退出后你将无法再访问该团队。`
      : `确认将「${label}」移出团队吗？`
    if (!window.confirm(message)) return
    setBusyUserId(member.userId)
    setError(null)
    setNotice(null)
    try {
      await api.removeTeamMember(team.id, member.userId)
      if (isSelf) {
        onLeft()
        return
      }
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : isSelf ? '退出团队失败，请重试' : '移除成员失败，请重试')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 600 }}>
        <div className="modal-header">
          <span>团队成员 · {team.name}</span>
          <button className="modal-close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-notice">{notice}</div>}

          {canManage && (
            <>
              <label className="form-label">邀请成员</label>
              <div className="member-invite-row">
                <input
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !inviting) void handleInvite()
                  }}
                  placeholder="输入对方的用户名"
                  maxLength={128}
                  autoFocus
                />
                <select
                  className="form-select member-role-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
                  disabled={inviting}
                >
                  <option value="TEAM_ROLE_MEMBER">成员</option>
                  <option value="TEAM_ROLE_OWNER">所有者</option>
                </select>
                <button className="btn btn-primary" onClick={handleInvite} disabled={inviting}>
                  {inviting ? '邀请中...' : '邀请'}
                </button>
              </div>
              <div className="form-hint">
                对方会直接加入团队，无需确认。被邀请的人必须至少登录并访问过一次本平台，否则会提示用户不存在。
              </div>
            </>
          )}

          <label className="form-label">成员（{members.length}）</label>
          {loading ? (
            <div className="text-muted">加载中...</div>
          ) : members.length === 0 ? (
            <div className="text-muted">暂无成员</div>
          ) : (
            <div className="member-list">
              {members.map((m) => {
                const isSelf = m.userId === currentUserId
                const busy = busyUserId === m.userId
                const role: AssignableRole = m.role === 'TEAM_ROLE_OWNER' ? 'TEAM_ROLE_OWNER' : 'TEAM_ROLE_MEMBER'
                return (
                  <div className="member-row" key={m.userId}>
                    <div className="member-info">
                      <div className="member-name">
                        {m.username || m.userId}
                        {isSelf && <span className="agent-card-badge">我</span>}
                      </div>
                      {!m.username && <div className="member-sub">尚未登录过本平台，暂无用户名</div>}
                    </div>

                    {canManage ? (
                      <select
                        className="form-select member-role-select"
                        value={role}
                        onChange={(e) => void handleChangeRole(m, e.target.value as AssignableRole)}
                        disabled={busy}
                      >
                        <option value="TEAM_ROLE_MEMBER">成员</option>
                        <option value="TEAM_ROLE_OWNER">所有者</option>
                      </select>
                    ) : (
                      <span className={`member-role-tag ${role === 'TEAM_ROLE_OWNER' ? 'member-role-tag-owner' : ''}`}>
                        {roleLabel(role)}
                      </span>
                    )}

                    {(canManage || isSelf) && (
                      <button
                        className="btn btn-danger member-remove"
                        onClick={() => void handleRemove(m)}
                        disabled={busy}
                        title={isSelf ? '退出团队' : '移出团队'}
                      >
                        {busy ? '处理中...' : isSelf ? '退出' : '移除'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!canManage && (
            <div className="form-hint" style={{ marginTop: 12 }}>
              你是该团队的「成员」，可以查看团队并在工作区对话；邀请成员、修改角色、增删改 Agent 与 MCP 工具需要「所有者」权限。
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
