import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TICKET_CATEGORIES, TICKET_STATUS, PRIORITIES, ticketNo, fmtDate } from '../lib/support'
import TicketThread from '../components/TicketThread'
import { StatusBadge } from './Support'
import { ai } from '../lib/ai'
import AdminNav from '../components/AdminNav'

const FILTERS = [['active', 'Active'], ['open', 'Open'], ['pending', 'Waiting on customer'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'All']]

export default function AdminTickets() {
  const { profile, loading } = useAuth()
  const { id } = useParams()
  const [status, setStatus] = useState('active')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [tickets, setTickets] = useState(null)
  const [counts, setCounts] = useState({})

  const load = useCallback(async () => {
    let query = supabase.from('support_tickets')
      .select('id,ticket_number,subject,category,priority,status,contact_name,contact_email,user_id,updated_at,created_at')
      .order('updated_at', { ascending: false }).limit(200)
    if (status === 'active') query = query.in('status', ['open', 'pending'])
    else if (status !== 'all') query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (q.trim()) {
      const term = q.trim().replace(/[%,()]/g, ' ')
      const num = term.replace(/\D/g, '')
      query = query.or(`subject.ilike.%${term}%,contact_email.ilike.%${term}%,contact_name.ilike.%${term}%${num ? `,ticket_number.eq.${num}` : ''}`)
    }
    const { data } = await query
    setTickets(data || [])
    const { data: all } = await supabase.from('support_tickets').select('status').in('status', ['open', 'pending'])
    setCounts((all || []).reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {}))
  }, [status, category, q])

  useEffect(() => { if (profile?.is_admin) load() }, [profile?.is_admin, load])

  if (loading || !profile) return <div className="container page"><div className="spinner" /></div>
  if (!profile.is_admin) return (
    <div className="container page narrow"><div className="empty">Admins only. (Set <code>is_admin = true</code> on your profile in Supabase — see README.)</div></div>
  )

  return (
    <div className="container page">
      <AdminNav />
      <div className="section-head">
        <h1 className="page-title">Support tickets</h1>
        <div className="row-gap small">
          <span className="status st-open">{counts.open || 0} open</span>
          <span className="status st-pending">{counts.pending || 0} waiting</span>
        </div>
      </div>

      <div className={`admin-layout ${id ? 'has-detail' : ''}`}>
        <aside className="admin-list">
          <div className="toolbar">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All topics</option>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search # / subject / email" />
          </div>
          <div className="card table">
            {!tickets ? <div className="spinner" /> : tickets.length === 0 ? <div className="empty small">No tickets.</div> :
              tickets.map((t) => (
                <Link key={t.id} to={`/admin/tickets/${t.id}`} className={`table-row ${t.id === id ? 'on' : ''}`}>
                  <span className={`prio prio-${t.priority}`} title={t.priority} />
                  <div className="grow min0">
                    <strong className="truncate">{t.subject}</strong>
                    <div className="muted small truncate">#{ticketNo(t)} · {TICKET_CATEGORIES[t.category]} · {t.contact_name || t.contact_email || 'Guest'}</div>
                  </div>
                  <div className="admin-row-end">
                    <StatusBadge status={t.status} staff />
                    <span className="muted small">{fmtDate(t.updated_at)}</span>
                  </div>
                </Link>
              ))}
          </div>
        </aside>

        <section className="admin-detail">
          {id ? <AdminTicket id={id} onChange={load} /> : <div className="empty">Select a ticket</div>}
        </section>
      </div>
    </div>
  )
}

function AdminTicket({ id, onChange }) {
  const [t, setT] = useState(null)
  const [draft, setDraft] = useState(null)
  const [triaging, setTriaging] = useState(false)
  const load = useCallback(() => supabase.from('support_tickets').select('*').eq('id', id).maybeSingle().then(({ data }) => setT(data)), [id])
  useEffect(() => { load() }, [load])

  const update = async (fields) => {
    const { error } = await supabase.from('support_tickets').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return alert(error.message)
    setT((x) => ({ ...x, ...fields })); onChange()
  }

  const runTriage = async () => {
    setTriaging(true)
    try { await ai('triage_ticket', { ticket_id: id, force: !!t.ai_triaged_at }); await load(); onChange() }
    catch (e) { alert(e.message) }
    finally { setTriaging(false) }
  }

  if (!t) return <div className="spinner" />
  const tri = t.ai_triage

  return (
    <div className="card admin-ticket">
      <Link to="/admin/tickets" className="link small only-mobile">← All tickets</Link>
      <div className="ticket-head">
        <div className="grow min0">
          <h2>{t.subject}</h2>
          <div className="muted small">#{ticketNo(t)} · opened {fmtDate(t.created_at)} · via {t.source}</div>
        </div>
      </div>

      <div className="admin-fields">
        <label>Status
          <select value={t.status} onChange={(e) => update({ status: e.target.value })}>
            {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.staffLabel || v.label}</option>)}
          </select>
        </label>
        <label>Priority
          <select value={t.priority} onChange={(e) => update({ priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>Topic
          <select value={t.category} onChange={(e) => update({ category: e.target.value })}>
            {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="admin-contact">
          <span className="muted small">Customer</span>
          <strong>{t.contact_name || (t.user_id ? 'Member' : 'Guest')}</strong>
          {t.contact_email && <a className="link small" href={`mailto:${t.contact_email}`}>{t.contact_email}</a>}
        </div>
      </div>

      <div className="ai-triage">
        <div className="ai-triage-head">
          <strong>🤖 AI triage</strong>
          <button className="link small" onClick={runTriage} disabled={triaging}>{triaging ? 'Working…' : tri ? 'Re-run' : 'Run triage'}</button>
        </div>
        {!tri ? (
          <p className="muted small">{triaging ? 'Reading the ticket…' : 'Not triaged yet. New tickets are triaged automatically within a few seconds.'}</p>
        ) : (
          <>
            <p className="small"><strong>{tri.summary}</strong></p>
            <div className="chips">
              <span className={`chip prio-chip-${tri.priority}`}>{tri.priority} priority</span>
              <span className="chip">{TICKET_CATEGORIES[tri.category] || tri.category}</span>
              <span className="chip">mood: {tri.sentiment}</span>
              {tri.auto_resolved && <span className="chip chip-ok">Answered automatically</span>}
            </div>
            {tri.next_steps?.length > 0 && <ul className="small ai-steps">{tri.next_steps.map((x) => <li key={x}>{x}</li>)}</ul>}
            {tri.suggested_reply && (
              <details className="ai-draft">
                <summary className="small">Suggested reply</summary>
                <div className="tt-body small">{tri.suggested_reply}</div>
                <button className="btn btn-outline" onClick={() => setDraft({ text: tri.suggested_reply, at: Date.now() })}>Use this draft</button>
              </details>
            )}
          </>
        )}
      </div>

      <TicketThread key={t.id} ticket={t} staff draft={draft} onChange={() => { load(); onChange() }} />
    </div>
  )
}
