import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, uploadImage } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES, BOOK_LANGUAGES, GENDERS, catById } from '../lib/catalog'
import { ai, aiBackground } from '../lib/ai'

const EMPTY = { title: '', description: '', price: '', currency: 'USD', category: '', product_type: '', book_language: '', gender: '', images: [], in_stock: true }
const MAX_IMAGES = 6

export default function ProductEditor() {
  const { id, shopId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [p, setP] = useState(EMPTY)
  const [sid, setSid] = useState(shopId)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiNotes, setAiNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiErr, setAiErr] = useState('')

  useEffect(() => {
    if (id) {
      supabase.from('products').select('*, shops(owner_id)').eq('id', id).single().then(({ data }) => {
        if (!data || data.shops?.owner_id !== user.id) return nav('/sell')
        // eslint-disable-next-line no-unused-vars
        const { shops, ...rest } = data
        setP({ ...EMPTY, ...rest, price: rest.price ?? '' })
        setSid(rest.shop_id)
      })
    } else if (shopId) {
      supabase.from('shops').select('owner_id').eq('id', shopId).single().then(({ data }) => {
        if (!data || data.owner_id !== user.id) nav('/sell')
      })
    }
  }, [id, shopId, user.id, nav])

  const cat = catById(p.category)
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const addImages = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_IMAGES - p.images.length)
    if (!files.length) return
    setUploading(true); setErr('')
    try {
      const urls = []
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name} is over 5MB`)
        urls.push(await uploadImage(f, user.id))
      }
      setP((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
    } catch (e2) { setErr(e2.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const writeWithAI = async () => {
    setAiBusy(true); setAiErr('')
    try {
      const { draft, comparables } = await ai('listing_draft', { images: p.images, notes: aiNotes })
      setP((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        description: draft.description || prev.description,
        category: draft.category || prev.category,
        product_type: draft.product_type || '',
        book_language: draft.book_language || '',
        gender: draft.gender || '',
        price: prev.price === '' && draft.suggested_price != null ? String(draft.suggested_price) : prev.price,
      }))
      setAiResult({ ...draft, comparables })
    } catch (e) { setAiErr(e.message) }
    finally { setAiBusy(false) }
  }

  const moveFirst = (i) => setP({ ...p, images: [p.images[i], ...p.images.filter((_, j) => j !== i)] })
  const removeImg = (i) => setP({ ...p, images: p.images.filter((_, j) => j !== i) })

  const save = async (e, addAnother = false) => {
    e?.preventDefault(); setErr('')
    if (!p.category) return setErr('Choose a category.')
    setBusy(true)
    const payload = {
      shop_id: sid,
      title: p.title.trim(),
      description: p.description,
      price: p.price === '' ? null : Number(p.price),
      currency: p.currency,
      category: p.category,
      product_type: p.product_type || null,
      book_language: cat?.hasLanguage ? p.book_language || null : null,
      gender: cat?.hasGender ? p.gender || null : null,
      images: p.images,
      in_stock: p.in_stock,
    }
    const { data: saved, error } = id
      ? await supabase.from('products').update(payload).eq('id', id).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single()
    setBusy(false)
    if (error) return setErr(error.message)
    aiBackground('moderate_product', { product_id: saved.id }) // AI safety scan
    setAiResult(null); setAiNotes('')
    if (addAnother) { setP({ ...EMPTY, category: p.category }); window.scrollTo(0, 0) }
    else nav('/sell')
  }

  return (
    <div className="container page narrow">
      <h1 className="page-title">{id ? 'Edit product' : 'Add a product'}</h1>
      {(p.is_hidden || p.moderation_status === 'flagged' || p.moderation_status === 'removed') && (
        <div className={`notice ${p.is_hidden ? 'notice-danger' : ''}`}>
          <strong>{p.moderation_status === 'removed' ? 'Removed by Thobe It Up' : p.is_hidden ? 'Hidden — under review' : 'Flagged for review'}</strong>
          <p className="small">{(p.moderation_notes || '').split('To seller:')[1]?.trim() || 'Our safety check flagged this listing. Edit it to fix the issue, or contact support.'}</p>
        </div>
      )}
      <form className="form" onSubmit={save}>
        <div className="card form">
          <h3>Photos</h3>
          <div className="img-grid">
            {p.images.map((src, i) => (
              <div key={src} className="img-slot">
                <img src={src} alt="" />
                {i === 0 && <span className="badge">Cover</span>}
                <div className="img-tools">
                  {i > 0 && <button type="button" onClick={() => moveFirst(i)} title="Make cover">★</button>}
                  <button type="button" onClick={() => removeImg(i)} title="Remove">✕</button>
                </div>
              </div>
            ))}
            {p.images.length < MAX_IMAGES && (
              <label className="img-slot add">
                {uploading ? 'Uploading…' : '+ Add photos'}
                <input type="file" accept="image/*" multiple hidden onChange={addImages} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

        <div className="card form ai-card">
          <div className="ai-head">
            <span className="ai-spark">✨</span>
            <div>
              <h3>Write it with AI</h3>
              <p className="muted small">Add photos, then AI fills in the title, description, category, type and a price based on similar listings. You can edit everything.</p>
            </div>
          </div>
          <input value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} maxLength={1000}
            placeholder="Optional notes: size, ml, brand, edition, condition…" />
          <div className="row-gap">
            <button type="button" className="btn btn-ai" onClick={writeWithAI}
              disabled={aiBusy || uploading || (!p.images.length && !aiNotes.trim())}>
              {aiBusy ? 'Looking at your photos…' : p.title ? '✨ Rewrite with AI' : '✨ Fill in with AI'}
            </button>
            {!p.images.length && !aiNotes.trim() && <span className="muted small">Add a photo or notes first</span>}
          </div>
          {aiErr && <p className="error small">{aiErr}</p>}
          {aiResult && (
            <div className="ai-result">
              {aiResult.suggested_price != null && (
                <div className="ai-price">
                  <div>
                    <strong>Suggested price: ${aiResult.suggested_price}</strong>
                    <div className="muted small">
                      {aiResult.price_reasoning}
                      {aiResult.comparables && ` Similar listings: $${Math.round(aiResult.comparables.low)}–$${Math.round(aiResult.comparables.high)} (median $${Math.round(aiResult.comparables.median)}, ${aiResult.comparables.count} listings).`}
                    </div>
                  </div>
                  {String(p.price) !== String(aiResult.suggested_price) && (
                    <button type="button" className="btn btn-outline" onClick={() => setP({ ...p, price: String(aiResult.suggested_price) })}>Use ${aiResult.suggested_price}</button>
                  )}
                </div>
              )}
              {aiResult.warnings?.length > 0 && (
                <ul className="ai-warn small">{aiResult.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}</ul>
              )}
              <p className="muted small">Check the details below before publishing.</p>
            </div>
          )}
        </div>

        <div className="card form">
          <h3>Details</h3>
          <label>Title *<input required value={p.title} onChange={set('title')} placeholder="e.g. Cambodian Oud Attar 3ml" maxLength={120} /></label>
          <label>Category *
            <select required value={p.category} onChange={(e) => setP({ ...p, category: e.target.value, product_type: '', book_language: '', gender: '' })}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </label>
          {cat && (
            <label>{cat.id === 'books' ? 'Type of book' : 'Type'}
              <select value={p.product_type} onChange={set('product_type')}>
                <option value="">Choose…</option>
                {cat.types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          )}
          {cat?.hasLanguage && (
            <label>Language
              <select value={p.book_language} onChange={set('book_language')}>
                <option value="">Choose…</option>
                {BOOK_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
          )}
          {cat?.hasGender && (
            <label>For
              <select value={p.gender} onChange={set('gender')}>
                <option value="">Choose…</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </label>
          )}
          <label>Description<textarea rows={4} value={p.description || ''} onChange={set('description')} placeholder="Size, scent notes, edition, condition…" /></label>
          <div className="row-2">
            <label>Price (USD)<input type="number" min="0" step="0.01" value={p.price} onChange={set('price')} placeholder="Leave empty for “Ask seller”" /></label>
            <label className="check self-end"><input type="checkbox" checked={p.in_stock} onChange={set('in_stock')} /> In stock</label>
          </div>
        </div>

        {err && <p className="error">{err}</p>}
        <div className="row-gap">
          <button className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish'}</button>
          {!id && <button type="button" className="btn btn-outline" disabled={busy || uploading || !p.title} onClick={(e) => save(e, true)}>Publish & add another</button>}
          <button type="button" className="link" onClick={() => nav('/sell')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
