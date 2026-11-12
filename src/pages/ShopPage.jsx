import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { catById } from '../lib/catalog'
import { openConversation, waLink } from '../lib/chat'
import ProductCard from '../components/ProductCard'
import ShopMap from '../components/ShopMap'

export default function ShopPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [tab, setTab] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    supabase.from('shops').select('*').eq('id', id).maybeSingle().then(({ data }) => data ? setShop(data) : setMissing(true))
    supabase.from('products').select('*').eq('shop_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []))
  }, [id])

  const cats = useMemo(() => [...new Set(products.map((p) => p.category))], [products])
  const shown = tab ? products.filter((p) => p.category === tab) : products

  if (missing) return <div className="container page"><div className="empty">Shop not found.</div></div>
  if (!shop) return <div className="container page"><div className="spinner" /></div>

  const isOwner = user?.id === shop.owner_id
  const message = async () => {
    if (!user) return nav(`/login?next=/shop/${id}`)
    nav(`/messages/${await openConversation(user.id, shop.id)}`)
  }

  return (
    <div className="container page">
      <div className="shop-hero card">
        <div className="shop-logo xl">{shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.name[0]}</div>
        <div className="grow">
          <h1>{shop.name}</h1>
          <div className="muted">{shop.address || shop.city}</div>
          <div className="chips">
            {shop.has_storefront ? <span className="chip">Storefront</span> : <span className="chip">Home seller</span>}
            {shop.ships && <span className="chip">Ships</span>}
          </div>
          {shop.description && <p>{shop.description}</p>}
        </div>
        <div className="shop-actions">
          {isOwner ? (
            <Link to={`/sell/shop/${shop.id}`} className="btn btn-primary">Edit shop</Link>
          ) : (
            <>
              <button className="btn btn-primary" onClick={message}>💬 Message</button>
              {shop.whatsapp && <a className="btn btn-outline" href={waLink(shop.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {shop.phone && <a className="btn btn-outline" href={`tel:${shop.phone}`}>Call</a>}
              {shop.lat != null && <a className="btn btn-outline" href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`} target="_blank" rel="noreferrer">Directions</a>}
            </>
          )}
        </div>
      </div>

      {shop.lat != null && shop.has_storefront && <ShopMap picked={{ lat: shop.lat, lng: shop.lng }} height={240} />}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Products ({products.length})</h2>
          {cats.length > 1 && (
            <div className="seg">
              <button className={!tab ? 'on' : ''} onClick={() => setTab('')}>All</button>
              {cats.map((c) => <button key={c} className={tab === c ? 'on' : ''} onClick={() => setTab(c)}>{catById(c)?.label || c}</button>)}
            </div>
          )}
        </div>
        {shown.length === 0 ? <div className="empty">No products listed yet.</div> :
          <div className="product-grid">{shown.map((p) => <ProductCard key={p.id} p={{ ...p, shops: null }} />)}</div>}
      </section>
    </div>
  )
}
