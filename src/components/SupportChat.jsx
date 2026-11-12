import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ai } from '../lib/ai'
import { loadSavedLocation } from '../lib/geo'
import RichText from './RichText'

const STORE = 'tiu_support_chat'
const WELCOME = {
  role: 'assistant',
  welcome: true,
  content: "Salam! 👋 I'm the Thobe It Up assistant. I can help you find products and shops, answer questions about buying and selling, or open a support ticket with our team.",
}
const SUGGESTIONS = ['Find oud near me', 'How do I start selling?', 'Report a seller', 'Talk to a person']

const load = () => {
  try { return JSON.parse(sessionStorage.getItem(STORE)) || [WELCOME] } catch { return [WELCOME] }
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))) } catch { /* ignore */ } }, [msgs])
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open, busy])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  useEffect(() => {
    const onOpen = (e) => {
      setOpen(true)
      if (e.detail?.prefill) setText(e.detail.prefill)
    }
    window.addEventListener('open-support', onOpen)
    return () => window.removeEventListener('open-support', onOpen)
  }, [])

  const send = async (raw) => {
    const content = (raw ?? text).trim()
    if (!content || busy) return
    setText('')
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setBusy(true)
    try {
      const data = await ai('support', {
        messages: next.filter((m) => !m.welcome && !m.error).map(({ role, content: c }) => ({ role, content: c })),
        page: pathname,
        location: loadSavedLocation(),
      })
      if (!data?.reply) throw new Error('No reply')
      setMsgs((m) => [...m, {
        role: 'assistant',
        content: data.reply,
        products: data.products?.length ? data.products : undefined,
        shops: data.shops?.length ? data.shops : undefined,
        ticket: data.ticket || undefined,
      }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', error: true, content: "Sorry, I couldn't connect just now. Please try again in a moment." }])
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setMsgs([WELCOME]); setText('') }
  const hideLauncher = pathname.startsWith('/messages') || pathname.startsWith('/admin') || pathname.startsWith('/agent')
  const closeOnMobile = () => { if (window.innerWidth < 600) setOpen(false) }

  return (
    <>
      {!open && !hideLauncher && (
        <button className="sc-launcher" onClick={() => setOpen(true)} aria-label="Open help chat">
          <span className="sc-launcher-icon">💬</span><span className="sc-launcher-text">Help</span>
        </button>
      )}

      {open && (
        <div className="sc-panel" role="dialog" aria-label="Thobe It Up help">
          <div className="sc-head">
            <div className="logo-mark sm">ث</div>
            <div className="grow">
              <strong>Thobe It Up Help</strong>
              <div className="sc-sub">AI assistant · replies instantly</div>
            </div>
            <button className="sc-icon" onClick={reset} title="New conversation">↺</button>
            <button className="sc-icon" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="sc-body">
            {msgs.map((m, i) => (
              <div key={i} className={`sc-msg ${m.role === 'user' ? 'me' : ''} ${m.error ? 'err' : ''}`}>
                <div className="sc-bubble">
                  {m.role === 'user' ? m.content : <RichText text={m.content} onNavigate={closeOnMobile} />}
                </div>

                {m.products && (
                  <div className="sc-cards">
                    {m.products.map((p) => (
                      <Link key={p.id} to={p.url} className="sc-card" onClick={closeOnMobile}>
                        <div className="sc-card-img">{p.image ? <img src={p.image} alt="" /> : '🛍️'}</div>
                        <div className="sc-card-title">{p.title}</div>
                        <div className="sc-card-meta">{p.price}{p.distance_mi != null ? ` · ${p.distance_mi} mi` : ''}</div>
                        <div className="sc-card-meta muted">{p.shop}</div>
                      </Link>
                    ))}
                  </div>
                )}

                {m.shops && (
                  <div className="sc-shops">
                    {m.shops.map((s) => (
                      <Link key={s.id} to={s.url} className="sc-shop" onClick={closeOnMobile}>
                        <span className="shop-logo sm">{s.logo ? <img src={s.logo} alt="" /> : s.name[0]}</span>
                        <span className="grow min0">
                          <strong className="truncate">{s.name}</strong>
                          <span className="sc-card-meta">{s.kind} · {s.distance_mi} mi{s.city ? ` · ${s.city}` : ''}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {m.ticket && (
                  <div className="sc-ticket">
                    <div>🎫 <strong>Ticket #{m.ticket.number}</strong> created</div>
                    <div className="sc-card-meta">{m.ticket.subject}</div>
                    {m.ticket.url
                      ? <Link to={m.ticket.url} className="link small" onClick={closeOnMobile}>View ticket →</Link>
                      : <div className="sc-card-meta">We'll reply by email.</div>}
                  </div>
                )}
              </div>
            ))}

            {msgs.length === 1 && (
              <div className="sc-suggest">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}

            {busy && <div className="sc-msg"><div className="sc-bubble sc-typing"><span /><span /><span /></div></div>}
            <div ref={endRef} />
          </div>

          <form className="sc-input" onSubmit={(e) => { e.preventDefault(); send() }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={2000}
              placeholder="Ask anything…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
          </form>
          <div className="sc-foot">AI can make mistakes. For account or safety issues, ask it to open a ticket.</div>
        </div>
      )}
    </>
  )
}
