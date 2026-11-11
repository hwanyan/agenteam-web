import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api/client'
import { clearSession, getSession, subscribe, type AuthUser } from './auth/session'
import { AuthPage } from './components/AuthPage'
import { Sidebar } from './components/Sidebar'
import { TabsBar } from './components/TabsBar'
import { TeamTab } from './components/TeamTab'
import { WorkspaceTab } from './components/WorkspaceTab'
import { useAppState } from './state/useAppState'
import { IconMark } from './icons'

// App 只负责按登录态切换页面：未登录显示登录 / 注册页，已登录进入主界面。
// 主界面（MainApp）在登出 / token 失效时会整体卸载，tabs、团队列表等状态随之清空，
// 避免切换账号后残留上一个用户的数据。
export default function App() {
  const session = useSyncExternalStore(subscribe, getSession)
  if (!session.token) return <AuthPage />
  return <MainApp user={session.user} />
}

function displayName(user: AuthUser | null): string {
  return user?.nickname || user?.username || '已登录'
}

function MainApp({ user }: { user: AuthUser | null }) {
  // 登出：先通知服务端吊销会话（失败也不影响本地退出），再清掉本地登录态
  const handleLogout = () => {
    void api.logout().catch(() => undefined).finally(clearSession)
  }

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
        userName={displayName(user)}
        onLogout={handleLogout}
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
