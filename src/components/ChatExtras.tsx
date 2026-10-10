import { useState } from 'react'
import type { ToolCallInfo } from '../types'
import { IconChevronRight, IconCheck, IconClose } from '../icons'

interface ReasoningBlockProps {
  text: string
  // 是否仍在流式生成中：生成中默认展开、并显示"思考中"动效，让用户看到实时的思考；
  // 生成结束后默认折叠，只留一行标题，需要时再点开。
  streaming?: boolean
}

// ReasoningBlock 展示模型的思考过程（可折叠）。
export function ReasoningBlock({ text, streaming = false }: ReasoningBlockProps) {
  // null 表示用户还没手动切换过，跟随默认值（流式中展开、结束后折叠）；点击后以用户选择为准。
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const open = expanded ?? streaming

  return (
    <div className="reasoning-block">
      <button type="button" className="reasoning-toggle" onClick={() => setExpanded(!open)}>
        <span className={`reasoning-chevron ${open ? 'reasoning-chevron-open' : ''}`}>
          <IconChevronRight size={12} />
        </span>
        <span>{streaming ? '思考中' : '思考过程'}</span>
        {streaming && <span className="tool-spinner" />}
      </button>
      {open && <div className="reasoning-text">{text}</div>}
    </div>
  )
}

interface ToolCallListProps {
  calls: ToolCallInfo[]
}

// ToolCallList 在回复下方展示这条回复过程中调用了哪些工具及其状态。
export function ToolCallList({ calls }: ToolCallListProps) {
  if (calls.length === 0) return null
  return (
    <div className="chat-tools">
      <span className="chat-tools-label">调用工具</span>
      {calls.map((c) => (
        <span
          key={c.id}
          className={`tool-chip tool-chip-${c.status}`}
          title={c.arguments ? `入参：${c.arguments}` : undefined}
        >
          <ToolStatusIcon status={c.status} />
          {c.name}
        </span>
      ))}
    </div>
  )
}

function ToolStatusIcon({ status }: { status: string }) {
  if (status === 'running') return <span className="tool-spinner" />
  if (status === 'error') return <IconClose size={12} />
  return <IconCheck size={12} />
}

// mergeToolCall 把流式收到的一次工具调用状态合并进列表：同一个 id 覆盖更新，新 id 追加。
export function mergeToolCall(list: ToolCallInfo[], call: ToolCallInfo): ToolCallInfo[] {
  const idx = list.findIndex((c) => c.id === call.id)
  if (idx === -1) return [...list, call]
  const next = list.slice()
  next[idx] = call
  return next
}
