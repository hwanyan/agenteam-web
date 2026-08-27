// 极简线性图标集（替代 emoji），风格贴合 "Agent Runtime" 的工程 / 运行时气质。
// 统一使用 stroke，继承 currentColor，可通过外层容器控制颜色与尺寸。

import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

// 品牌标记：菱形节点，用作 Logo 与空状态大图标
export function IconMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2 L18 10 L10 18 L2 10 Z" />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4l6 6-6 6" />
    </svg>
  )
}

// 团队：三个互联节点
export function IconTeam(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6" r="2.1" />
      <circle cx="15" cy="7" r="2.1" />
      <circle cx="9" cy="15" r="2.1" />
      <path d="M7.6 7.3 12.9 7M7 8l1.4 5M13.4 8.6 10.4 13.7" />
    </svg>
  )
}

// Agent：六边形节点（呼应品牌标记，代表运行中的智能体）
export function IconAgent(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.5 17 6.5v7L10 17.5 3 13.5v-7z" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  )
}

export function IconChat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 4.5h13v9h-6.5L6.5 16v-2.5H3.5z" />
    </svg>
  )
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10 17 3.5 12.5 17 9.5 11 3 10Z" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c0-3.5 2.7-6 6-6s6 2.5 6 6" />
    </svg>
  )
}

export function IconDot(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

// 团队配置：齿轮图标
export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3.2v2.1M10 14.7v2.1M16.8 10h-2.1M5.3 10H3.2M14.9 5.1l-1.5 1.5M6.6 13.4l-1.5 1.5M14.9 14.9l-1.5-1.5M6.6 6.6 5.1 5.1" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 10a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1L14 6" />
    </svg>
  )
}
