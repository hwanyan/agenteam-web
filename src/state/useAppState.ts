import { useCallback, useState } from 'react'
import type { Team } from '../types'
import { api } from '../api/client'

export type TabItem =
  | { id: string; kind: 'team'; teamId: string | null; title: string }
  | { id: string; kind: 'workspace'; teamId: string; title: string }

let tabSeq = 0
function nextTabId() {
  tabSeq += 1
  return `tab-${tabSeq}`
}

// allTeams：仅平台管理员可用，列出平台内全部团队而不是“我所在的团队”。
// 它是平台角色（admin）才有的能力，与团队内角色（owner / member）无关；非管理员传 true 会被后端拒绝。
export function useAppState(opts?: { allTeams?: boolean }) {
  const allTeams = Boolean(opts?.allTeams)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [tabs, setTabs] = useState<TabItem[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const refreshTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const res = await api.listTeams({ all: allTeams })
      setTeams(res.teams ?? [])
    } finally {
      setTeamsLoading(false)
    }
  }, [allTeams])

  // 团队已不再对当前用户可见（被删除，或当前用户退出）：关闭该团队的所有标签页（详情 + 工作区）。
  const closeTeamTabs = useCallback((teamId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.teamId !== teamId)
      setActiveTabId((curActive) => {
        if (curActive && next.some((t) => t.id === curActive)) return curActive
        return next[0]?.id ?? null
      })
      return next
    })
  }, [])

  const activateTab = useCallback((id: string) => setActiveTabId(id), [])

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id)
        if (idx === -1) return prev
        const next = prev.filter((t) => t.id !== id)
        setActiveTabId((curActive) => {
          if (curActive !== id) return curActive
          const fallback = next[idx - 1] ?? next[0]
          return fallback ? fallback.id : null
        })
        return next
      })
    },
    [],
  )

  // 新增团队：打开一个处于“创建中”状态的团队 tab（teamId 为 null）。
  const openTeamCreateTab = useCallback(() => {
    const id = nextTabId()
    setTabs((prev) => [...prev, { id, kind: 'team', teamId: null, title: '新增团队' }])
    setActiveTabId(id)
  }, [])

  // 打开某个已存在团队的详情 tab；若已打开则直接激活。
  // 仅需 id/name 即可（详情数据由 TeamTab 内部通过 api.getTeam 自行加载），
  // 因此接受 Team 的最小子集，方便从只持有 teamId/teamName 的场景（如工作区 tab）直接调用。
  const openTeamTab = useCallback(
    (team: Pick<Team, 'id' | 'name'>) => {
      setTabs((prev) => {
        const existing = prev.find((t) => t.kind === 'team' && t.teamId === team.id)
        if (existing) {
          setActiveTabId(existing.id)
          return prev
        }
        const id = nextTabId()
        setActiveTabId(id)
        return [...prev, { id, kind: 'team', teamId: team.id, title: team.name }]
      })
    },
    [],
  )

  // 将处于“创建中”的 tab 转为已创建团队的详情 tab。
  const markTabCreated = useCallback((tabId: string, team: Team) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, teamId: team.id, title: team.name } : t)),
    )
  }, [])

  const renameTeamTab = useCallback((teamId: string, name: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.kind === 'team' && t.teamId === teamId ? { ...t, title: name } : t)),
    )
  }, [])

  const openWorkspaceTab = useCallback((team: Team) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.kind === 'workspace' && t.teamId === team.id)
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const id = nextTabId()
      setActiveTabId(id)
      return [...prev, { id, kind: 'workspace', teamId: team.id, title: `工作区 · ${team.name}` }]
    })
  }, [])

  return {
    teams,
    teamsLoading,
    refreshTeams,
    tabs,
    activeTabId,
    activateTab,
    closeTab,
    closeTeamTabs,
    openTeamCreateTab,
    openTeamTab,
    markTabCreated,
    renameTeamTab,
    openWorkspaceTab,
  }
}

export type AppState = ReturnType<typeof useAppState>
