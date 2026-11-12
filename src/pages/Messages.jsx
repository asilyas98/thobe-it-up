import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ai, aiBackground } from '../lib/ai'

const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return new Date(d).toLocaleDateString()
}

export default function Messages() {
  const { id } = useParams()
  const { user } = useAuth()
  const [convs, setConvs] = useState(null)
  const [unread, setUnread] = useState(new Set())

  const loadConvs = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, shops(id,name,logo_url,owner_id,ai_auto_reply), buyer:profiles!conversations_buyer_id_fkey(full_name,avatar_url), products(id,title,images)')
      .order('last_message_at', { ascending: false })
    setConvs(data || [])
    const { data: u } = await supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', user.id)
    setUnread(new Set((u || []).map((m) => m.conversation_id)))
  }

  useEffect(() => { loadConvs() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const other = (c) => {
    const iAmSeller = c.shops?.owner_id === user.id
    return iAmSeller
      ? { name: c.buyer?.full_name || 'Buyer', img: c.buyer?.avatar_url, tag: `to ${c.shops?.name}` }
      : { name: c.shops?.name || 'Shop', img: c.shops?.logo_url, tag: 'Seller' }
  }

  const active = convs?.find((c) => c.id === id)

  return (
    <div className="container page">
      <h1 className="page-title">Messages</h1>
      <div className={`chat-layout ${id ? 'has-thread' : ''}`}>
        <aside className="conv-list card">
          {!convs ? <div className="spinner" /> : convs.length === 0 ? (
            <div className="empty small">No conversations yet. Message a seller from any product page.</div>
          ) : convs.map((c) => {
            const o = other(c)
            return (
              <Link key={c.id} to={`/messages/${c.id}`} className={`conv ${c.id === id ? 'on' : ''}`}>
                <div className="shop-logo sm">{o.img ? <img src={o.img} alt="" /> : o.name[0]}</div>
                <div className="grow min0">
                  <div className="conv-top"><strong className="truncate">{o.name}</strong><span className="muted small">{timeAgo(c.last_message_at)}</span></div>
                  <div className="muted small truncate">{c.products?.title || o.tag}</div>
                </div>
                {unread.has(c.id) && c.id !== id && <span className="dot" />}
              </Link>
            )
          })}
        </aside>
        <section className="thread card">
          {id ? (active ? <Thread conv={active} other={other(active)} me={user.id} onSent={loadConvs} /> : convs ? <div className="empty">Conversation not found.</div> : <div className="spinner" />)
            : <div className="empty">Select a conversation</div>}
        </section>
      </div>
    </div>
  )
}

function Thread({ conv, other, me, onSent }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [awaitingAuto, setAwaitingAuto] = useState(false)
  const isSeller = conv.shops?.owner_id === me
  const [params] = useSearchParams()
  const [about, setAbout] = useState(null)
  const endRef = useRef(null)
  const nav = useNavigate()

  useEffect(() => {
    let alive = true
    supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at').then(({ data }) => {
      if (!alive) return
      setMsgs(data || [])
      supabase.from('messages').update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id).neq('sender_id', me).is('read_at', null).then(() => {})
    })
    const ch = supabase
      .channel(`conv-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
        (payload) => setMsgs((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new])))
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [conv.id, me])

  useEffect(() => {
    const pid = params.get('about')
    if (!pid) return setAbout(null)
    supabase.from('products').select('id,title,images,price').eq('id', pid).maybeSingle().then(({ data }) => {
      setAbout(data)
      if (data) setText((t) => t || `Salam! Is "${data.title}" still available?`)
    })
  }, [params])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    const { data, error } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: me, body }).select().single()
    if (error) { setText(body); return alert(error.message) }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]))
    if (about) { setAbout(null); nav(`/messages/${conv.id}`, { replace: true }) }
    onSent?.()
    if (!isSeller && conv.shops?.ai_auto_reply) {
      setAwaitingAuto(true)
      aiBackground('auto_reply', { conversation_id: conv.id }).finally(() => setTimeout(() => setAwaitingAuto(false), 1500))
    }
  }

  const draft = async () => {
    setDrafting(true)
    try { setText((await ai('draft_reply', { conversation_id: conv.id })).reply || '') }
    catch (e2) { alert(e2.message) }
    finally { setDrafting(false) }
  }

  return (
    <>
      <div className="thread-head">
        <Link to="/messages" className="only-mobile link">←</Link>
        <div className="shop-logo sm">{other.img ? <img src={other.img} alt="" /> : other.name[0]}</div>
        <div className="grow">
          {conv.shops?.owner_id === me ? <strong>{other.name}</strong> : <Link to={`/shop/${conv.shop_id}`}><strong>{other.name}</strong></Link>}
          <div className="muted small">{other.tag}</div>
        </div>
      </div>
      {about && (
        <Link to={`/product/${about.id}`} className="about-bar">
          {about.images?.[0] && <img src={about.images[0]} alt="" />}<span>Asking about <strong>{about.title}</strong></span>
        </Link>
      )}
      {!isSeller && conv.shops?.ai_auto_reply && (
        <div className="ai-note small">🤖 This shop uses an AI auto-reply when they're away. The seller confirms any deal.</div>
      )}
      <div className="msgs">
        {msgs.length === 0 && <div className="muted small center">Say salam 👋</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.sender_id === me ? 'mine' : ''}`}>
            {m.is_ai && <div className="msg-ai">🤖 Auto-reply{isSeller ? ' (sent for you)' : ''}</div>}
            <div className={`bubble ${m.is_ai ? 'bubble-ai' : ''}`}>{m.body}</div>
            <div className="msg-time">{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        ))}
        {awaitingAuto && <div className="msg"><div className="bubble sc-typing"><span /><span /><span /></div></div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={send}>
        {isSeller && (
          <button type="button" className="btn btn-ai btn-icon" onClick={draft} disabled={drafting} title="Draft a reply with AI">
            {drafting ? '…' : '✨'}
          </button>
        )}
        <textarea rows={text.includes('\n') ? 3 : 1} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder={isSeller ? 'Write a message… or tap ✨ to draft one' : 'Write a message…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }} />
        <button className="btn btn-primary">Send</button>
      </form>
    </>
  )
}
