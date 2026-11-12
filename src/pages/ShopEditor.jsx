import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, uploadImage } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { geocode, getMyLocation } from '../lib/geo'
import ShopMap from '../components/ShopMap'

const EMPTY = { name: '', description: '', logo_url: '', phone: '', whatsapp: '', email: '', address: '', city: '', lat: null, lng: null, has_storefront: true, ships: false, is_active: true, ai_auto_reply: false, ai_instructions: '' }

export default function ShopEditor() {
  const { id } = useParams()
  const { user, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [s, setS] = useState(EMPTY)
  const [results, setResults] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('shops').select('*').eq('id', id).single().then(({ data }) => {
      if (!data || data.owner_id !== user.id) return nav('/sell')
      setS(data)
    })
  }, [id, user.id, nav])

  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const findAddress = async () => {
    if (!s.address.trim()) return
    setErr('')
    try {
      const r = await geocode(s.address)
      if (!r.length) setErr('Address not found — try adding city/state, or click the map to drop a pin.')
      setResults(r)
    } catch (e) { setErr(e.message) }
  }

  const pick = (r) => { setS({ ...s, address: r.label, city: r.city || s.city, lat: r.lat, lng: r.lng }); setResults([]) }

  const useMine = async () => {
    try { const loc = await getMyLocation(); setS({ ...s, ...loc }) } catch (e) { setErr(e.message) }
  }

  const logo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try { setS({ ...s, logo_url: await uploadImage(f, user.id) }) } catch (e2) { setErr(e2.message) }
  }

  const save = async (e) => {
    e.preventDefault(); setErr('')
    if (s.lat == null) return setErr('Please set your location (search the address or click the map) so nearby buyers can find you.')
    setBusy(true)
    // eslint-disable-next-line no-unused-vars
    const { id: _id, created_at, owner_id, ...fields } = s
    const payload = { ...fields, owner_id: user.id }
    // Home sellers: never publish a street address or exact pin (~1 km precision)
    if (!payload.has_storefront) {
      payload.address = null
      payload.lat = Math.round(payload.lat * 100) / 100
      payload.lng = Math.round(payload.lng * 100) / 100
    }
    const { data, error } = id
      ? await supabase.from('shops').update(payload).eq('id', id).select().single()
      : await supabase.from('shops').insert(payload).select().single()
    if (error) { setBusy(false); return setErr(error.message) }
    await supabase.from('profiles').update({ is_seller: true }).eq('id', user.id)
    await refreshProfile()
    nav(id ? '/sell' : `/sell/shop/${data.id}/product/new`)
  }

  const del = async () => {
    if (!confirm('Delete this shop and all its products? This cannot be undone.')) return
    await supabase.from('shops').delete().eq('id', id)
    nav('/sell')
  }

  return (
    <div className="container page narrow">
      <h1 className="page-title">{id ? 'Edit shop' : 'Create your shop'}</h1>
      <form className="form" onSubmit={save}>
        <div className="card form">
          <h3>Basics</h3>
          <div className="avatar-row">
            <div className="shop-logo xl">{s.logo_url ? <img src={s.logo_url} alt="" /> : (s.name[0] || '🏪')}</div>
            <label className="btn btn-outline">Upload logo<input type="file" accept="image/*" hidden onChange={logo} /></label>
          </div>
          <label>Shop name *<input required value={s.name} onChange={set('name')} placeholder="e.g. Al-Noor Oud & Books" /></label>
          <label>About your shop<textarea rows={3} value={s.description || ''} onChange={set('description')} placeholder="What do you sell? Hours? Anything buyers should know." /></label>
          <label className="check"><input type="checkbox" checked={s.has_storefront} onChange={set('has_storefront')} /> I have a physical storefront buyers can visit</label>
          <label className="check"><input type="checkbox" checked={s.ships} onChange={set('ships')} /> I can ship orders</label>
        </div>

        <div className="card form">
          <h3>Contact</h3>
          <p className="muted small">Buyers can always message you in the app. Phone and WhatsApp are optional.</p>
          <div className="row-2">
            <label>Phone<input value={s.phone || ''} onChange={set('phone')} placeholder="+1 313 555 0100" /></label>
            <label>WhatsApp<input value={s.whatsapp || ''} onChange={set('whatsapp')} placeholder="+1 313 555 0100" /></label>
          </div>
          <label>Email<input type="email" value={s.email || ''} onChange={set('email')} /></label>
        </div>

        <div className="card form ai-card">
          <div className="ai-head">
            <span className="ai-spark">🤖</span>
            <div>
              <h3>AI auto-reply</h3>
              <p className="muted small">When you're away, an AI assistant answers buyer messages instantly using your notes and product list. Its messages are labeled “Auto-reply”, it never confirms a deal for you, and it stays quiet for 30 minutes after you reply yourself.</p>
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={!!s.ai_auto_reply} onChange={set('ai_auto_reply')} /> Turn on auto-reply</label>
          <label>Notes for the assistant
            <textarea rows={5} value={s.ai_instructions || ''} onChange={set('ai_instructions')} maxLength={2000}
              placeholder={'e.g.\nOpen Mon–Sat 11am–8pm, closed Fridays 1–2:30pm for Jummah.\nPickup at the store or local delivery in Dearborn for $5.\nWe ship US-wide via USPS, 2–4 days, $8 flat.\nCash, Zelle or card in store. Prices are firm except bulk orders.'} />
          </label>
        </div>

        <div className="card form">
          <h3>Location *</h3>
          <p className="muted small">{s.has_storefront ? 'Your shop address — shown on the map.' : 'Home sellers: we only use this to place you approximately (about 1 km). Your street address is never shown.'}</p>
          <div className="inline-form">
            <input value={s.address || ''} onChange={set('address')} placeholder="Street, city, state" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findAddress() } }} />
            <button type="button" className="btn" onClick={findAddress}>Find</button>
            <button type="button" className="btn btn-outline" onClick={useMine}>📍</button>
          </div>
          {results.length > 0 && (
            <div className="results">{results.map((r) => <button type="button" key={`${r.lat},${r.lng}`} onClick={() => pick(r)}>{r.label}</button>)}</div>
          )}
          <label>City<input value={s.city || ''} onChange={set('city')} /></label>
          <ShopMap picked={s.lat != null ? { lat: s.lat, lng: s.lng } : null} onMapClick={(ll) => setS({ ...s, ...ll })} height={280} />
          <p className="muted small">Tip: click the map to fine-tune the pin.</p>
        </div>

        {id && <label className="check"><input type="checkbox" checked={s.is_active} onChange={set('is_active')} /> Shop is visible to buyers</label>}
        {err && <p className="error">{err}</p>}
        <div className="row-gap">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create shop & add products'}</button>
          {id && <button type="button" className="link danger" onClick={del}>Delete shop</button>}
        </div>
      </form>
    </div>
  )
}
