import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  content: string
}

// Markdown 用于渲染 Agent 回复中的 Markdown 格式内容（标题、表格、加粗、列表、代码块等）。
// 流式输出场景下 content 会持续增长、可能包含尚未闭合的语法（如半个 "**"、未完成的表格行），
// remark/react-markdown 对不完整语法有较好的容错（按纯文本处理未闭合部分），足以支撑
// "边生成边渲染"的打字机效果，不需要等待完整文本再解析。
export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
