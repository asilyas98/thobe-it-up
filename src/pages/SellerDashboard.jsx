import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { catById, formatPrice } from '../lib/catalog'

export default function SellerDashboard() {
  const { user } = useAuth()
  const [shops, setShops] = useState(null)
  const [products, setProducts] = useState([])
  const [activeShop, setActiveShop] = useState(null)

  useEffect(() => {
    supabase.from('shops').select('*').eq('owner_id', user.id).order('created_at').then(({ data }) => {
      setShops(data || [])
      if (data?.length) setActiveShop(data[0].id)
    })
  }, [user.id])

  useEffect(() => {
    if (!activeShop) return
    supabase.from('products').select('*').eq('shop_id', activeShop).order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []))
  }, [activeShop])

  const toggleStock = async (p) => {
    await supabase.from('products').update({ in_stock: !p.in_stock }).eq('id', p.id)
    setProducts(products.map((x) => (x.id === p.id ? { ...x, in_stock: !x.in_stock } : x)))
  }
  const remove = async (p) => {
    if (!confirm(`Delete "${p.title}"?`)) return
    await supabase.from('products').delete().eq('id', p.id)
    setProducts(products.filter((x) => x.id !== p.id))
  }

  if (!shops) return <div className="container page"><div className="spinner" /></div>

  if (shops.length === 0) return (
    <div className="container page narrow">
      <div className="card onboarding">
        <h1>Start selling on Thobe It Up</h1>
        <p>Whether you run a storefront or sell from home, set up your shop in two minutes:</p>
        <ol className="steps">
          <li><strong>Create your shop</strong> — name, contact info and location so nearby buyers can find you.</li>
          <li><strong>Add products</strong> — photos, price, category and type.</li>
          <li><strong>Reply to buyers</strong> — they’ll message you here or on WhatsApp.</li>
        </ol>
        <Link to="/sell/shop/new" className="btn btn-primary">Create my shop</Link>
      </div>
    </div>
  )

  const shop = shops.find((s) => s.id === activeShop)

  return (
    <div className="container page">
      <div className="section-head">
        <h1 className="page-title">Seller hub</h1>
        <div className="row-gap">
          {shops.length > 1 && (
            <select value={activeShop} onChange={(e) => setActiveShop(e.target.value)}>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <Link to="/sell/shop/new" className="btn btn-outline">+ New shop</Link>
        </div>
      </div>

      {shop && (
        <div className="card dash-shop">
          <div className="shop-logo">{shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.name[0]}</div>
          <div className="grow">
            <strong>{shop.name}</strong>
            <div className="muted small">{shop.address || shop.city || 'No location set'}{!shop.is_active && ' · Hidden'}</div>
          </div>
          <Link to={`/shop/${shop.id}`} className="btn btn-outline">View</Link>
          <Link to={`/sell/shop/${shop.id}`} className="btn btn-outline">Edit shop</Link>
          <Link to="/messages" className="btn btn-outline">Messages</Link>
        </div>
      )}

      <div className="stats">
        <div className="stat card"><span className="stat-n">{products.length}</span><span className="muted small">Listings</span></div>
        <div className="stat card"><span className="stat-n">{products.filter((p) => p.in_stock).length}</span><span className="muted small">In stock</span></div>
        <div className="stat card"><span className="stat-n">{new Set(products.map((p) => p.category)).size}</span><span className="muted small">Categories</span></div>
      </div>

      <div className="section-head">
        <h2 className="section-title">Products</h2>
        <Link to={`/sell/shop/${activeShop}/product/new`} className="btn btn-primary">+ Add product</Link>
      </div>

      {products.length === 0 ? <div className="empty">No products yet — add your first listing.</div> : (
        <div className="table card">
          {products.map((p) => (
            <div key={p.id} className="table-row">
              <div className="thumb">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : catById(p.category)?.icon}</div>
              <div className="grow min0">
                <Link to={`/product/${p.id}`}><strong className="truncate">{p.title}</strong></Link>
                <div className="muted small">{catById(p.category)?.label}{p.product_type ? ` · ${p.product_type}` : ''}</div>
              </div>
              <span className="price">{formatPrice(p.price, p.currency)}</span>
              {(p.is_hidden || p.moderation_status === 'flagged' || p.moderation_status === 'removed') && (
                <Link to={`/sell/product/${p.id}`} className={`chip ${p.is_hidden ? 'chip-danger' : 'chip-warn'}`} title={p.moderation_notes || ''}>
                  {p.moderation_status === 'removed' ? 'Removed' : p.is_hidden ? 'Hidden · review' : 'Flagged'}
                </Link>
              )}
              <button className={`chip chip-btn ${p.in_stock ? 'chip-ok' : ''}`} onClick={() => toggleStock(p)}>{p.in_stock ? 'In stock' : 'Sold out'}</button>
              <Link to={`/sell/product/${p.id}`} className="link small">Edit</Link>
              <button className="link small danger" onClick={() => remove(p)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
