import type { Team } from '../types'
import { IconMark, IconPlus } from '../icons'

interface SidebarProps {
  teams: Team[]
  loading: boolean
  activeTeamId: string | null
  onCreateTeam: () => void
  onSelectTeam: (team: Team) => void
  /** 当前登录用户的展示名 */
  userName: string
  onLogout: () => void
  /** 是否为平台管理员（平台角色 admin）：只有管理员才会看到“查看全部团队”开关。 */
  isAdmin: boolean
  /** 管理员是否正在查看平台内全部团队（而不是“我所在的团队”）。 */
  showAllTeams: boolean
  onToggleAllTeams: (next: boolean) => void
}

export function Sidebar({
  teams,
  loading,
  activeTeamId,
  onCreateTeam,
  onSelectTeam,
  userName,
  onLogout,
  isAdmin,
  showAllTeams,
  onToggleAllTeams,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <IconMark size={20} className="sidebar-logo-mark" />
        <span className="sidebar-title">
          AGENT RUNTIME
          <small>多团队智能体管理台</small>
        </span>
      </div>
      <div className="sidebar-body">
        <button className="btn btn-primary btn-block" onClick={onCreateTeam}>
          <IconPlus size={14} />
          新增团队
        </button>
        <div className="sidebar-section-title">{showAllTeams ? '全部团队（管理员）' : '我的团队'}</div>
        {isAdmin && (
          <label className="sidebar-toggle" title="平台管理员可查看并管理平台内的所有团队">
            <input type="checkbox" checked={showAllTeams} onChange={(e) => onToggleAllTeams(e.target.checked)} />
            <span>查看全部团队</span>
          </label>
        )}
        <div className="team-list">
          {loading && <div className="sidebar-empty">加载中...</div>}
          {!loading && teams.length === 0 && (
            <div className="sidebar-empty">
              {showAllTeams ? '平台内还没有团队' : '暂无团队，点击上方按钮创建，或请团队所有者邀请你加入'}
            </div>
          )}
          {teams.map((team) => (
            <button
              key={team.id}
              className={`team-item ${activeTeamId === team.id ? 'team-item-active' : ''}`}
              onClick={() => onSelectTeam(team)}
              title={team.name}
            >
              <span className="team-item-dot" />
              <span className="team-item-name">{team.name}</span>
              {team.myRole === 'TEAM_ROLE_MEMBER' && <span className="team-item-tag">成员</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="sidebar-footer">
        <span className="sidebar-user" title={userName}>
          {userName}
        </span>
        <button className="sidebar-logout" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </aside>
  )
}
