import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { ChatMessage } from '../types'
import { IconAgent, IconSend, IconUser } from '../icons'

interface WorkspaceTabProps {
  teamId: string
  teamName: string
}

export function WorkspaceTab({ teamId, teamName }: WorkspaceTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
  }, [messages])

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    setInput('')
    try {
      const res = await api.sendMessage(teamId, content)
      setMessages((prev) => [...prev, res.userMessage, res.agentMessage])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发送失败，请重试')
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page page-workspace">
      <div className="page-header">
        <h2>工作区 · {teamName}</h2>
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
            <div className="chat-msg-bubble chat-msg-loading">思考中...</div>
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
