import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TICKET_CATEGORIES, TICKET_STATUS, ticketNo, fmtDate, openSupportChat } from '../lib/support'
import TicketThread from '../components/TicketThread'
import { aiBackground } from '../lib/ai'

export default function Support() {
  const { id } = useParams()
  return id ? <TicketPage id={id} /> : <TicketList />
}

function StatusBadge({ status, staff }) {
  const s = TICKET_STATUS[status] || TICKET_STATUS.open
  return <span className={`status ${s.cls}`}>{staff && s.staffLabel ? s.staffLabel : s.label}</span>
}
export { StatusBadge }

function TicketList() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [tickets, setTickets] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'other', subject: '', summary: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('support_tickets').select('id,ticket_number,subject,category,status,updated_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false })
      .then(({ data }) => setTickets(data || []))
  }, [user.id])

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const { data, error } = await supabase.rpc('create_support_ticket', {
      p_subject: form.subject, p_summary: form.summary, p_category: form.category, p_source: 'form',
    })
    setBusy(false)
    if (error) return setErr(error.message)
    const ticketId = (Array.isArray(data) ? data[0] : data).id
    aiBackground('triage_ticket', { ticket_id: ticketId })
    nav(`/support/${ticketId}`)
  }

  return (
    <div className="container page narrow">
      <h1 className="page-title">Help & support</h1>
      <div className="support-actions">
        <button className="card support-tile" onClick={() => openSupportChat()}>
          <span className="cat-icon">💬</span>
          <strong>Chat with the assistant</strong>
          <span className="muted small">Instant answers. It can open a ticket for you.</span>
        </button>
        <button className="card support-tile" onClick={() => setShowForm(!showForm)}>
          <span className="cat-icon">📝</span>
          <strong>Open a ticket yourself</strong>
          <span className="muted small">Write to our team directly.</span>
        </button>
      </div>

      {showForm && (
        <form className="card form" onSubmit={submit}>
          <label>Topic
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Subject<input required maxLength={160} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label>Details<textarea required rows={5} maxLength={4000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="What happened? Include the shop or product name / link if relevant." /></label>
          {err && <p className="error small">{err}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit ticket'}</button>
        </form>
      )}

      <h2 className="section-title" style={{ marginTop: 32 }}>Your tickets</h2>
      {!tickets ? <div className="spinner" /> : tickets.length === 0 ? (
        <div className="empty">No tickets yet.</div>
      ) : (
        <div className="table card">
          {tickets.map((t) => (
            <Link key={t.id} to={`/support/${t.id}`} className="table-row">
              <div className="grow min0">
                <strong className="truncate">{t.subject}</strong>
                <div className="muted small">#{ticketNo(t)} · {TICKET_CATEGORIES[t.category]} · updated {fmtDate(t.updated_at)}</div>
              </div>
              <StatusBadge status={t.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function TicketPage({ id }) {
  const [t, setT] = useState(undefined)
  const load = () => supabase.from('support_tickets').select('*').eq('id', id).maybeSingle().then(({ data }) => setT(data))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t === undefined) return <div className="container page"><div className="spinner" /></div>
  if (!t) return <div className="container page narrow"><div className="empty">Ticket not found. <Link className="link" to="/support">Back to support</Link></div></div>

  return (
    <div className="container page narrow">
      <nav className="crumbs small"><Link to="/support">Support</Link> / #{ticketNo(t)}</nav>
      <div className="ticket-head">
        <div className="grow">
          <h1 className="page-title">{t.subject}</h1>
          <div className="muted small">#{ticketNo(t)} · {TICKET_CATEGORIES[t.category]}</div>
        </div>
        <StatusBadge status={t.status} />
      </div>
      <TicketThread ticket={t} onChange={load} />
    </div>
  )
}
