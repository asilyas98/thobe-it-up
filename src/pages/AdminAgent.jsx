import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ai } from '../lib/ai'
import { catById, formatPrice } from '../lib/catalog'
import { fmtDate } from '../lib/support'
import AdminNav from '../components/AdminNav'

const SETTINGS = [
  ['auto_hide_flagged', 'Hide listings the AI blocks', 'Clearly prohibited listings (alcohol, weapons, replicas, scams) are hidden right away until you review them. Suspicious ones are only flagged.'],
  ['auto_resolve_tickets', 'Let the AI answer simple tickets', 'For logged-in customers with simple how-to questions, the AI posts an answer and marks the ticket "waiting on customer". Reports, disputes, account and safety issues always go to a person.'],
  ['seller_auto_reply_enabled', 'Allow seller auto-replies', 'Sellers who turn it on get instant AI answers to buyers while they are away.'],
  ['shopper_enabled', 'AI Shopper for buyers', 'The /agent page where buyers search, compare and draft messages with AI.'],
]

export default function AdminAgent() {
  const { profile, loading } = useAuth()
  const [settings, setSettings] = useState(null)
  const [tab, setTab] = useState('flagged')
  const [items, setItems] = useState(null)
  const [counts, setCounts] = useState({})
  const [scan, setScan] = useState(null)
  const [stats, setStats] = useState(null)

  const loadCounts = useCallback(async () => {
    const c = {}
    for (const st of ['pending', 'flagged', 'removed']) {
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('moderation_status', st)
      c[st] = count || 0
    }
    const { count: hidden } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_hidden', true)
    c.hidden = hidden || 0
    setCounts(c)
  }, [])

  const loadItems = useCallback(async () => {
    setItems(null)
    const { data } = await supabase.from('products')
      .select('id,title,price,currency,category,product_type,images,is_hidden,moderation_status,moderation_notes,moderated_at,shops(id,name,city)')
      .eq('moderation_status', tab).order('moderated_at', { ascending: false, nullsFirst: false }).limit(60)
    setItems(data || [])
  }, [tab])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase.from('agent_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data))
    loadCounts()
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    Promise.all([
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', since).not('ai_triaged_at', 'is', null),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('ai_triage->>auto_resolved', 'true'),
      supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_ai', true),
    ]).then(([a, b, c, d]) => setStats({ tickets: a.count || 0, triaged: b.count || 0, autoResolved: c.count || 0, autoReplies: d.count || 0 }))
  }, [profile?.is_admin, loadCounts])

  useEffect(() => { if (profile?.is_admin) loadItems() }, [profile?.is_admin, loadItems])

  if (loading || !profile) return <div className="container page"><div className="spinner" /></div>
  if (!profile.is_admin) return <div className="container page narrow"><div className="empty">Admins only.</div></div>

  const toggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    const { error } = await supabase.from('agent_settings').update({ [key]: next[key], updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { alert(error.message); setSettings(settings) }
  }

  const scanPending = async () => {
    setScan({ running: true, scanned: 0, flagged: 0 })
    let total = { scanned: 0, flagged: 0 }
    try {
      for (let round = 0; round < 10; round++) {
        const r = await ai('moderate_pending')
        total = { scanned: total.scanned + r.scanned, flagged: total.flagged + r.flagged }
        setScan({ running: true, ...total, remaining: r.remaining })
        if (!r.remaining || !r.scanned) break
      }
      setScan({ running: false, ...total })
    } catch (e) { setScan({ running: false, ...total, error: e.message }) }
    loadCounts(); loadItems()
  }

  const decide = async (p, action) => {
    if (action === 'rescan') {
      try { await ai('moderate_product', { product_id: p.id }) } catch (e) { return alert(e.message) }
    } else {
      const fields = action === 'approve'
        ? { moderation_status: 'approved', is_hidden: false, moderation_notes: null, moderated_at: new Date().toISOString() }
        : { moderation_status: 'removed', is_hidden: true, moderated_at: new Date().toISOString() }
      const { error } = await supabase.from('products').update(fields).eq('id', p.id)
      if (error) return alert(error.message)
    }
    loadCounts(); loadItems()
  }

  return (
    <div className="container page">
      <AdminNav />
      <h1 className="page-title">AI agent</h1>

      {stats && (
        <div className="stats stats-4">
          <div className="stat card"><span className="stat-n">{stats.triaged}/{stats.tickets}</span><span className="muted small">Tickets triaged (7 days)</span></div>
          <div className="stat card"><span className="stat-n">{stats.autoResolved}</span><span className="muted small">Answered automatically</span></div>
          <div className="stat card"><span className="stat-n">{stats.autoReplies}</span><span className="muted small">Seller auto-replies sent</span></div>
          <div className="stat card"><span className="stat-n">{counts.hidden ?? '–'}</span><span className="muted small">Listings hidden</span></div>
        </div>
      )}

      <div className="agent-admin">
        <section>
          <div className="section-head">
            <h2 className="section-title">Listing moderation</h2>
            <button className="btn btn-ai" onClick={scanPending} disabled={scan?.running || !counts.pending}>
              {scan?.running ? `Scanning… ${scan.scanned} done` : `✨ Scan ${counts.pending || 0} unscanned`}
            </button>
          </div>
          {scan && !scan.running && (
            <p className="small">{scan.error ? <span className="error">{scan.error}</span> : `Scanned ${scan.scanned} listings, flagged ${scan.flagged}.`}</p>
          )}
          <p className="muted small">New and edited listings are scanned automatically when the seller saves them. Anything that slipped through shows as unscanned.</p>

          <div className="seg">
            {[['flagged', 'Flagged'], ['removed', 'Removed'], ['pending', 'Unscanned'], ['approved', 'Approved']].map(([v, l]) => (
              <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
                {l}{counts[v] != null ? ` (${counts[v]})` : ''}
              </button>
            ))}
          </div>

          <div className="mod-list">
            {!items ? <div className="spinner" /> : items.length === 0 ? <div className="empty small">Nothing here. 🎉</div> : items.map((p) => (
              <div key={p.id} className="card mod-item">
                <Link to={`/product/${p.id}`} className="thumb">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : catById(p.category)?.icon}</Link>
                <div className="grow min0">
                  <Link to={`/product/${p.id}`}><strong>{p.title}</strong></Link>
                  <div className="muted small">
                    {formatPrice(p.price, p.currency)} · {p.product_type || catById(p.category)?.label} · <Link className="link" to={`/shop/${p.shops?.id}`}>{p.shops?.name}</Link>
                    {p.moderated_at && ` · ${fmtDate(p.moderated_at)}`}
                  </div>
                  {p.is_hidden && <span className="chip chip-danger">Hidden</span>}
                  {p.moderation_notes && <div className="mod-notes small">{p.moderation_notes}</div>}
                </div>
                <div className="mod-actions">
                  {p.moderation_status !== 'approved' && <button className="btn btn-outline" onClick={() => decide(p, 'approve')}>Approve</button>}
                  {p.moderation_status !== 'removed' && <button className="btn btn-outline danger" onClick={() => decide(p, 'remove')}>Remove</button>}
                  <button className="link small" onClick={() => decide(p, 'rescan')}>Re-scan</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card agent-settings">
          <h3>Agent settings</h3>
          {!settings ? <div className="spinner" /> : SETTINGS.map(([key, label, help]) => (
            <label key={key} className="setting">
              <span className={`switch ${settings[key] ? 'on' : ''}`}><input type="checkbox" checked={!!settings[key]} onChange={() => toggle(key)} /></span>
              <span>
                <strong>{label}</strong>
                <span className="muted small">{help}</span>
              </span>
            </label>
          ))}
          <p className="muted small">The AI also triages every new ticket (topic, priority, summary, next steps, draft reply). See it at the top of each ticket.</p>
        </aside>
      </div>
    </div>
  )
}
