import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { catById, formatPrice } from '../lib/catalog'
import { openConversation, waLink } from '../lib/chat'
import ProductCard from '../components/ProductCard'

export default function ProductPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [p, setP] = useState(null)
  const [img, setImg] = useState(0)
  const [saved, setSaved] = useState(false)
  const [more, setMore] = useState([])
  const [err, setErr] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setImg(0)
    supabase
      .from('products')
      .select('*, shops(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setNotFound(true)
        setP(data)
        supabase.from('products').select('*, shops(id,name)').eq('shop_id', data.shop_id).neq('id', id).limit(4)
          .then(({ data: m }) => setMore(m || []))
      })
  }, [id])

  useEffect(() => {
    if (!user) return
    supabase.from('favorites').select('product_id').eq('user_id', user.id).eq('product_id', id).maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [user, id])

  if (notFound) return <div className="container page"><div className="empty">This product was removed. <Link to="/browse" className="link">Keep browsing</Link></div></div>
  if (!p) return <div className="container page"><div className="spinner" /></div>

  const shop = p.shops
  const cat = catById(p.category)
  const isOwner = user && shop?.owner_id === user.id

  const toggleSave = async () => {
    if (!user) return nav(`/login?next=/product/${id}`)
    if (saved) await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', id)
    else await supabase.from('favorites').insert({ user_id: user.id, product_id: id })
    setSaved(!saved)
  }

  const message = async () => {
    if (!user) return nav(`/login?next=/product/${id}`)
    try {
      const convId = await openConversation(user.id, shop.id, p.id)
      nav(`/messages/${convId}?about=${p.id}`)
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="container page">
      <nav className="crumbs small">
        <Link to="/browse">Shop</Link> / <Link to={`/browse?category=${p.category}`}>{cat?.label}</Link>
        {p.product_type && <> / <Link to={`/browse?category=${p.category}&type=${encodeURIComponent(p.product_type)}`}>{p.product_type}</Link></>}
      </nav>

      <div className="product-layout">
        <div className="gallery">
          <div className="gallery-main">
            {p.images?.length ? <img src={p.images[img]} alt={p.title} /> : <div className="img-ph big">{cat?.icon}</div>}
          </div>
          {p.images?.length > 1 && (
            <div className="thumbs">
              {p.images.map((src, i) => (
                <button key={src} className={i === img ? 'on' : ''} onClick={() => setImg(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail">
          <div className="product-meta">{[p.product_type, p.book_language, p.gender].filter(Boolean).join(' · ')}</div>
          <h1>{p.title}</h1>
          <div className="price big">{formatPrice(p.price, p.currency)}</div>
          <div className="chips">
            <span className={`chip ${p.in_stock ? 'chip-ok' : ''}`}>{p.in_stock ? 'In stock' : 'Out of stock'}</span>
            {shop?.has_storefront && <span className="chip">Pick up in store</span>}
            {shop?.ships && <span className="chip">Ships</span>}
          </div>

          {p.description && <p className="desc">{p.description}</p>}

          {isOwner ? (
            <Link to={`/sell/product/${p.id}`} className="btn btn-primary btn-block">Edit this listing</Link>
          ) : (
            <div className="contact-actions">
              <button className="btn btn-primary btn-block" onClick={message}>💬 Message seller</button>
              <div className="row-2">
                {shop?.whatsapp && <a className="btn btn-outline" href={waLink(shop.whatsapp, `Salam! I'm interested in "${p.title}" on Thobe It Up.`)} target="_blank" rel="noreferrer">WhatsApp</a>}
                {shop?.phone && <a className="btn btn-outline" href={`tel:${shop.phone}`}>Call</a>}
                <button className="btn btn-outline" onClick={toggleSave}>{saved ? '♥ Saved' : '♡ Save'}</button>
              </div>
              {err && <p className="error small">{err}</p>}
            </div>
          )}

          {shop && (
            <Link to={`/shop/${shop.id}`} className="card seller-box">
              <div className="shop-logo">{shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.name[0]}</div>
              <div>
                <div className="muted small">Sold by</div>
                <strong>{shop.name}</strong>
                <div className="muted small">{shop.address || shop.city}</div>
              </div>
              <span className="link">View shop →</span>
            </Link>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="section">
          <h2 className="section-title">More from {shop?.name}</h2>
          <div className="product-grid">{more.map((m) => <ProductCard key={m.id} p={m} />)}</div>
        </section>
      )}
    </div>
  )
}
