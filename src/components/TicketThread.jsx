import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/support'
import RichText from './RichText'

// Shared by the customer ticket page and the admin inbox
export default function TicketThread({ ticket, staff = false, onChange, draft }) {
  const { user } = useAuth()
  const [replies, setReplies] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => { if (draft?.text) setText(draft.text) }, [draft])

  useEffect(() => {
    supabase.from('ticket_messages').select('*, profiles(full_name)').eq('ticket_id', ticket.id).order('created_at')
      .then(({ data }) => setReplies(data || []))
  }, [ticket.id])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('ticket_messages')
      .insert({ ticket_id: ticket.id, sender_id: user.id, is_staff: staff, body })
      .select('*, profiles(full_name)').single()
    setBusy(false)
    if (error) return setErr(error.message)
    setReplies((r) => [...r, data]); setText('')
    onChange?.()
  }

  const transcript = Array.isArray(ticket.transcript) ? ticket.transcript : []
  const closed = ticket.status === 'closed'

  return (
    <div className="ticket-thread">
      <div className="tt-item tt-summary">
        <div className="tt-meta">{ticket.source === 'chatbot' ? 'Created by the assistant' : 'Submitted'} · {fmtDate(ticket.created_at)}</div>
        <div className="tt-body">{ticket.summary}</div>
        {ticket.related_url && (
          <div className="small">Related: <a className="link" href={ticket.related_url} target="_blank" rel="noreferrer">{ticket.related_url}</a></div>
        )}
      </div>

      {transcript.length > 0 && (
        <div className="tt-transcript">
          <button className="link small" onClick={() => setShowTranscript(!showTranscript)}>
            {showTranscript ? 'Hide' : 'Show'} chat with assistant ({transcript.length})
          </button>
          {showTranscript && (
            <div className="tt-chat">
              {transcript.map((m, i) => (
                <div key={i} className={`tt-chat-msg ${m.role === 'user' ? 'me' : ''}`}>
                  <span className="tt-who">{m.role === 'user' ? 'Customer' : 'Assistant'}</span>
                  <RichText text={m.content} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {replies.map((r) => (
        <div key={r.id} className={`tt-item ${r.is_staff ? 'staff' : ''} ${r.is_ai ? 'ai' : ''}`}>
          <div className="tt-meta">
            {r.is_ai ? '🤖 Thobe It Up Assistant (automatic answer)' : r.is_staff ? '🛡️ Thobe It Up Support' : (r.profiles?.full_name || 'Customer')}
            {staff && r.is_staff && r.profiles?.full_name ? ` (${r.profiles.full_name})` : ''} · {fmtDate(r.created_at)}
          </div>
          <div className="tt-body">{r.body}</div>
        </div>
      ))}

      {closed && !staff ? (
        <div className="muted small center">This ticket is closed. Need more help? Open a new one.</div>
      ) : (
        <form className="tt-reply" onSubmit={send}>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
            placeholder={staff ? 'Reply to the customer…' : 'Add a reply or more details…'} />
          {err && <p className="error small">{err}</p>}
          <div className="row-gap">
            <button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : staff ? 'Send reply' : 'Send'}</button>
            {staff && ticket.contact_email && !ticket.user_id && (
              <span className="muted small">Guest ticket — they can't see replies here. <a className="link" href={`mailto:${ticket.contact_email}?subject=${encodeURIComponent(`Re: [TIU-${ticket.ticket_number}] ${ticket.subject}`)}`}>Email them</a></span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
