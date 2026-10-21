import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TabsBar } from './components/TabsBar'
import { TeamTab } from './components/TeamTab'
import { WorkspaceTab } from './components/WorkspaceTab'
import { LoginGate } from './components/LoginGate'
import { useAppState } from './state/useAppState'
import { getToken, UNAUTHORIZED_EVENT } from './api/auth'
import { IconMark } from './icons'

// 登录门：无 token 或后端返回 401 时展示登录页；登录成功后才挂载主界面（避免未登录就发请求）。
export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken())

  useEffect(() => {
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />
  return <AuthedApp />
}

function AuthedApp() {
  const {
    teams,
    teamsLoading,
    refreshTeams,
    tabs,
    activeTabId,
    activateTab,
    closeTab,
    openTeamCreateTab,
    openTeamTab,
    markTabCreated,
    openWorkspaceTab,
  } = useAppState()

  useEffect(() => {
    void refreshTeams()
  }, [refreshTeams])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeTeamId = activeTab?.kind === 'team' ? activeTab.teamId : activeTab?.kind === 'workspace' ? activeTab.teamId : null

  return (
    <div className="app-shell">
      <Sidebar
        teams={teams}
        loading={teamsLoading}
        activeTeamId={activeTeamId}
        onCreateTeam={openTeamCreateTab}
        onSelectTeam={openTeamTab}
      />
      <div className="main-area">
        <TabsBar tabs={tabs} activeTabId={activeTabId} onActivate={activateTab} onClose={closeTab} />
        <div className="main-content">
          {!activeTab && (
            <div className="page page-center">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <IconMark size={40} />
                </div>
                <div className="empty-state-title">开始使用 Agent Runtime</div>
                <div className="text-muted">点击左侧「新增团队」创建你的第一个团队与主 Agent</div>
              </div>
            </div>
          )}
          {tabs.map((tab) => (
            <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
              {tab.kind === 'team' ? (
                <TeamTab
                  teamId={tab.teamId}
                  onCreated={(team) => {
                    markTabCreated(tab.id, team)
                    void refreshTeams()
                  }}
                  onOpenWorkspace={openWorkspaceTab}
                />
              ) : (
                <WorkspaceTab
                  teamId={tab.teamId}
                  teamName={tab.title.replace(/^工作区 · /, '')}
                  onOpenTeamConfig={() => openTeamTab({ id: tab.teamId, name: tab.title.replace(/^工作区 · /, '') })}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
