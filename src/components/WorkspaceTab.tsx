import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { ChatMessage } from '../types'
import { IconAgent, IconSend, IconSettings, IconUser } from '../icons'

interface WorkspaceTabProps {
  teamId: string
  teamName: string
  // 点击「团队配置」按钮时触发，用于回到该团队的详情页（新增团队后展示的 Agent 列表页面）。
  onOpenTeamConfig: () => void
}

export function WorkspaceTab({ teamId, teamName, onOpenTeamConfig }: WorkspaceTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  // streamingText 是当前正在流式接收、尚未持久化完成的 Agent 回复增量文本；
  // 为空字符串时表示还未收到任何 delta（此时仍展示“思考中...”）。
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listMessages(teamId)
      .then((res) => {
        if (!cancelled) setMessages(res.messages ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载历史消息失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, streamingText])

  // 组件卸载或切换团队时，中断尚未结束的流式请求，避免回调写入已失效的状态。
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [teamId])

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    setInput('')
    setStreamingText('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await api.sendMessageStream(
        teamId,
        content,
        (chunk) => {
          if (chunk.userMessage) {
            setMessages((prev) => [...prev, chunk.userMessage as ChatMessage])
          }
          if (chunk.delta) {
            setStreamingText((prev) => prev + chunk.delta)
          }
          if (chunk.done && chunk.agentMessage) {
            setMessages((prev) => [...prev, chunk.agentMessage as ChatMessage])
            setStreamingText('')
          }
        },
        controller.signal,
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof ApiError ? err.message : '发送失败，请重试')
        setInput(content)
      }
    } finally {
      setStreamingText('')
      setSending(false)
      abortRef.current = null
    }
  }

  return (
    <div className="page page-workspace">
      <div className="page-header">
        <h2>工作区 · {teamName}</h2>
        <button className="btn" onClick={onOpenTeamConfig}>
          <IconSettings size={14} />
          团队配置
        </button>
      </div>

      <div className="chat-list" ref={listRef}>
        {loading && <div className="text-muted">加载中...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-muted">还没有对话，输入内容开始和团队主 Agent 交流吧～</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role === 'MESSAGE_ROLE_USER' ? 'chat-msg-user' : 'chat-msg-agent'}`}>
            <div className="chat-msg-avatar">
              {m.role === 'MESSAGE_ROLE_USER' ? <IconUser size={15} /> : <IconAgent size={15} />}
            </div>
            <div className="chat-msg-bubble">{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="chat-msg chat-msg-agent">
            <div className="chat-msg-avatar">
              <IconAgent size={15} />
            </div>
            {streamingText ? (
              <div className="chat-msg-bubble">
                {streamingText}
                <span className="chat-msg-cursor" />
              </div>
            ) : (
              <div className="chat-msg-bubble chat-msg-loading">思考中...</div>
            )}
          </div>
        )}
      </div>

      {error && <div className="form-error chat-error">{error}</div>}

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          value={input}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <button className="btn btn-primary chat-send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
          <IconSend size={14} />
          发送
        </button>
      </div>
    </div>
  )
}
