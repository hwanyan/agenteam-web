import type { Team } from '../types'

interface SidebarProps {
  teams: Team[]
  loading: boolean
  activeTeamId: string | null
  onCreateTeam: () => void
  onSelectTeam: (team: Team) => void
}

export function Sidebar({ teams, loading, activeTeamId, onCreateTeam, onSelectTeam }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Agent Runtime</span>
      </div>
      <button className="btn btn-primary btn-block" onClick={onCreateTeam}>
        + 新增团队
      </button>
      <div className="sidebar-section-title">团队列表</div>
      <div className="team-list">
        {loading && <div className="sidebar-empty">加载中...</div>}
        {!loading && teams.length === 0 && <div className="sidebar-empty">暂无团队，点击上方按钮创建</div>}
        {teams.map((team) => (
          <button
            key={team.id}
            className={`team-item ${activeTeamId === team.id ? 'team-item-active' : ''}`}
            onClick={() => onSelectTeam(team)}
            title={team.name}
          >
            <span className="team-item-dot" />
            <span className="team-item-name">{team.name}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
