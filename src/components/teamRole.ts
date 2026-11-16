import type { Team, TeamRole } from '../types'

// 团队角色相关的纯函数。这里的角色是“团队级角色”（owner / member），
// 与登录用户的平台角色（user / admin）是两套互不相干的概念。
// 前端的这些判断只用于决定是否展示入口；真正的授权始终由后端判断。

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  TEAM_ROLE_UNSPECIFIED: '未知',
  TEAM_ROLE_OWNER: '所有者',
  TEAM_ROLE_MEMBER: '成员',
}

export function roleLabel(role: TeamRole | undefined): string {
  return TEAM_ROLE_LABEL[role ?? 'TEAM_ROLE_UNSPECIFIED']
}

/** 是否为团队 owner（平台管理员越过成员校验时，后端也会返回 OWNER）。 */
export function isTeamOwner(team: Pick<Team, 'myRole'> | null | undefined): boolean {
  return team?.myRole === 'TEAM_ROLE_OWNER'
}
