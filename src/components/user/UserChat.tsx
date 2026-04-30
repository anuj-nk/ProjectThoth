'use client'

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, QueryResult, SMEProfile } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export default function UserChat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      role: 'assistant',
      content: "Hello! I'm Thoth, your knowledge assistant. Ask me anything and I'll either answer from our knowledge base or connect you with the right expert.",
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input, session_id: sessionId })
      })

      const data = await res.json()
      const result: QueryResult = data.result

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: formatResponse(result),
        timestamp: new Date().toISOString(),
        metadata: {
          action: result.action,
          routed_sme: result.routed_sme,
          confidence: result.confidence_score,
          sources: result.sources?.map(s => s.topic_tag)
        }
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e20074]/50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#e20074] hover:bg-[#c4005f] disabled:opacity-40 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const action = message.metadata?.action
  const sme = message.metadata?.routed_sme

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 bg-[#e20074] rounded flex items-center justify-center text-white text-xs font-bold">T</div>
            <span className="text-white/40 text-xs">Thoth</span>
            {action && <ActionBadge action={action} />}
          </div>
        )}

        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-[#e20074] text-white rounded-tr-sm'
            : 'bg-white/8 text-white/85 rounded-tl-sm border border-white/10'
          }`}
        >
          {message.content}
        </div>

        {/* SME routing card */}
        {sme && (
          <div className="mt-2 border border-[#e20074]/30 rounded-xl p-3 bg-[#e20074]/5">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Routed to SME</p>
            <p className="text-white font-medium text-sm">{sme.full_name}</p>
            <p className="text-white/50 text-xs">{sme.title}</p>
            <a
              href={`mailto:${sme.email}`}
              className="text-[#e20074] text-xs hover:underline mt-1 inline-block"
            >
              {sme.email}
            </a>
          </div>
        )}

        {/* Sources */}
        {message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="mt-1.5 flex gap-1 flex-wrap">
            {message.metadata.sources.map(s => (
              <span key={s} className="text-white/30 text-xs bg-white/5 rounded px-2 py-0.5">
                📄 {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const config = {
    answered: { label: 'From KB', color: 'text-emerald-400 bg-emerald-400/10' },
    clarified: { label: 'Clarifying', color: 'text-yellow-400 bg-yellow-400/10' },
    routed_sme: { label: 'Routing to SME', color: 'text-blue-400 bg-blue-400/10' },
    routed_admin: { label: 'Routing to Admin', color: 'text-orange-400 bg-orange-400/10' },
  }[action] || { label: action, color: 'text-white/40 bg-white/5' }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
      {config.label}
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 bg-[#e20074] rounded flex items-center justify-center text-white text-xs font-bold">T</div>
      <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function formatResponse(result: QueryResult): string {
  switch (result.action) {
    case 'answered':
      return result.answer || 'I found some information but could not format a response.'
    case 'clarified':
      return result.clarifying_question || 'Could you provide more details?'
    case 'routed_sme':
      const smeName = result.routed_sme?.full_name || 'the appropriate expert'
      return `I don't have enough information in the knowledge base to answer this directly. I'm connecting you with ${smeName}, who owns this area.`
    case 'routed_admin':
      return "This question falls outside our current knowledge base coverage. I'm routing you to a system administrator who can help or ensure this knowledge gets captured."
    default:
      return result.answer || 'Please try rephrasing your question.'
  }
}
