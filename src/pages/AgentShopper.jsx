import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ai, aiBackground } from '../lib/ai'
import { openConversation } from '../lib/chat'
import { loadSavedLocation } from '../lib/geo'
import LocationBar from '../components/LocationBar'
import RichText from '../components/RichText'

const STORE = 'tiu_agent_chat'
const STARTERS = [
  'Find a Quran with English translation under $40',
  'Oud gift set for my dad, under $60, near me',
  'Black abaya for Eid, size 56, pickup this week',
  'Which shops near me sell attar and ship?',
]

const load = () => {
  try { return JSON.parse(sessionStorage.getItem(STORE)) || [] } catch { return [] }
}

export default function AgentShopper() {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [location, setLocation] = useState(loadSavedLocation())
  const [saved, setSaved] = useState(new Set())
  const endRef = useRef(null)

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))) } catch { /* ignore */ } }, [msgs])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => {
    if (!user) return
    supabase.from('favorites').select('product_id').eq('user_id', user.id)
      .then(({ data }) => setSaved(new Set((data || []).map((f) => f.product_id))))
  }, [user])

  const send = async (raw) => {
    const content = (raw ?? text).trim()
    if (!content || busy) return
    setText('')
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setBusy(true)
    try {
      const data = await ai('shopper', {
        messages: next.filter((m) => !m.error).map(({ role, content: c }) => ({ role, content: c })),
        location,
        page: '/agent',
      })
      if (data.saved?.length) setSaved((s) => new Set([...s, ...data.saved]))
      setMsgs((m) => [...m, {
        role: 'assistant',
        content: data.reply,
        products: data.products?.length ? data.products : undefined,
        shops: data.shops?.length ? data.shops : undefined,
        actions: data.actions?.length ? data.actions.map((a) => ({ ...a, state: 'draft' })) : undefined,
      }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', error: true, content: e.message || 'Something went wrong. Please try again.' }])
    } finally { setBusy(false) }
  }

  const toggleSave = async (pid) => {
    if (!user) return
    const on = saved.has(pid)
    setSaved((s) => { const n = new Set(s); on ? n.delete(pid) : n.add(pid); return n })
    if (on) await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', pid)
    else await supabase.from('favorites').insert({ user_id: user.id, product_id: pid })
  }

  const updateAction = (mi, ai2, patch) =>
    setMsgs((all) => all.map((m, i) => (i !== mi ? m : { ...m, actions: m.actions.map((a, j) => (j === ai2 ? { ...a, ...patch } : a)) })))

  const sendAction = async (mi, ai2, a) => {
    updateAction(mi, ai2, { state: 'sending' })
    try {
      const convId = await openConversation(user.id, a.shop_id, a.product_id)
      const { error } = await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, body: a.body.trim() })
      if (error) throw error
      updateAction(mi, ai2, { state: 'sent', convId })
      aiBackground('auto_reply', { conversation_id: convId })
    } catch (e) {
      updateAction(mi, ai2, { state: 'draft', err: e.message })
    }
  }

  return (
    <div className="container page agent-page">
      <div className="agent-head">
        <div>
          <p className="eyebrow dark">AI Shopper</p>
          <h1 className="page-title">Tell me what you're looking for.</h1>
          <p className="muted">I'll search every local shop, compare options, save favorites and write messages to sellers for you. You approve every message before it's sent.</p>
        </div>
        {msgs.length > 0 && <button className="btn btn-outline" onClick={() => setMsgs([])}>New search</button>}
      </div>

      <LocationBar location={location} onChange={setLocation} />
      {!user && <div className="ai-note small">You're browsing as a guest. <Link className="link" to="/login?next=/agent">Log in</Link> so the agent can save items and message sellers for you.</div>}

      <div className="agent-chat card">
        {msgs.length === 0 && (
          <div className="agent-starters">
            {STARTERS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          </div>
        )}

        {msgs.map((m, mi) => (
          <div key={mi} className={`agent-msg ${m.role === 'user' ? 'me' : ''} ${m.error ? 'err' : ''}`}>
            <div className="agent-bubble">{m.role === 'user' ? m.content : <RichText text={m.content} />}</div>

            {m.products && (
              <div className="agent-products">
                {m.products.map((p) => (
                  <div key={p.id} className="agent-product">
                    <Link to={p.url} className="agent-product-img">{p.image ? <img src={p.image} alt="" /> : '🛍️'}</Link>
                    <div className="agent-product-body">
                      <Link to={p.url} className="agent-product-title">{p.title}</Link>
                      <div className="small"><strong>{p.price}</strong>{!p.in_stock && <span className="muted"> · sold out</span>}</div>
                      <div className="muted small truncate">{p.shop}{p.distance_mi != null ? ` · ${p.distance_mi} mi` : ''}</div>
                    </div>
                    {user && (
                      <button className={`agent-save ${saved.has(p.id) ? 'on' : ''}`} onClick={() => toggleSave(p.id)} title={saved.has(p.id) ? 'Saved' : 'Save'}>
                        {saved.has(p.id) ? '♥' : '♡'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {m.shops && (
              <div className="sc-shops agent-shops">
                {m.shops.map((s) => (
                  <Link key={s.id} to={s.url} className="sc-shop">
                    <span className="shop-logo sm">{s.logo ? <img src={s.logo} alt="" /> : s.name[0]}</span>
                    <span className="grow min0">
                      <strong className="truncate">{s.name}</strong>
                      <span className="sc-card-meta">{s.kind}{s.distance_mi != null ? ` · ${s.distance_mi} mi` : ''}{s.ships ? ' · ships' : ''}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {m.actions?.map((a, ai2) => (
              <div key={ai2} className={`agent-action ${a.state}`}>
                <div className="small"><strong>✉️ Message to {a.shop_name}</strong>{a.product_title ? ` · about ${a.product_title}` : ''}</div>
                {a.state === 'sent' ? (
                  <>
                    <div className="agent-action-body">{a.body}</div>
                    <div className="small">✓ Sent · <Link className="link" to={`/messages/${a.convId}`}>Open chat</Link></div>
                  </>
                ) : a.state === 'dismissed' ? (
                  <div className="muted small">Dismissed</div>
                ) : (
                  <>
                    <textarea rows={3} value={a.body} onChange={(e) => updateAction(mi, ai2, { body: e.target.value })} maxLength={1500} />
                    {a.err && <p className="error small">{a.err}</p>}
                    <div className="row-gap">
                      <button className="btn btn-primary" disabled={a.state === 'sending' || !a.body.trim()} onClick={() => sendAction(mi, ai2, a)}>
                        {a.state === 'sending' ? 'Sending…' : 'Send to seller'}
                      </button>
                      <button className="link small" onClick={() => updateAction(mi, ai2, { state: 'dismissed' })}>Dismiss</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}

        {busy && (
          <div className="agent-msg">
            <div className="agent-bubble agent-working"><span className="sc-typing"><span /><span /><span /></span> Searching shops…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="agent-input" onSubmit={(e) => { e.preventDefault(); send() }}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder="e.g. Kids' Quran in Arabic–English with big print, under $25"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>Ask</button>
      </form>
      <p className="muted small center">AI can make mistakes — check details with the seller before you buy.</p>
    </div>
  )
}
