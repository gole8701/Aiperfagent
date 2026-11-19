import { useState } from 'react'

import { EMOJI } from '../lib/emoji-data'
import { formatAdded } from '../lib/dates'

export function ChatWidget({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ text: string; at: string }[]>([])
  const [draft, setDraft] = useState('')

  const send = () => {
    if (!draft.trim()) return
    const text = draft.replace(/:([a-z_]+):/g, (m, name: string) => EMOJI[name] ?? m)
    setMessages((list) => [...list, { text, at: new Date().toISOString() }])
    setDraft('')
  }

  return (
    <aside className="chat-widget" aria-label="Help chat">
      <button type="button" onClick={onClose} aria-label="Close chat">
        ×
      </button>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>
            {m.text} <small>{formatAdded(m.at)}</small>
          </li>
        ))}
      </ul>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask us anything" aria-label="Message" />
      <button type="button" onClick={send}>
        Send
      </button>
    </aside>
  )
}
