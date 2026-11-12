import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../lib/catalog'
import { loadSavedLocation } from '../lib/geo'
import ProductCard from '../components/ProductCard'
import ShopCard from '../components/ShopCard'
import LocationBar from '../components/LocationBar'

export default function Home() {
  const [latest, setLatest] = useState([])
  const [location, setLocation] = useState(loadSavedLocation())
  const [nearby, setNearby] = useState(null)
  const [q, setQ] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    supabase
      .from('products')
      .select('*, shops!inner(id,name,is_active)')
      .eq('shops.is_active', true)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setLatest(data || []))
  }, [])

  useEffect(() => {
    if (!location) return
    supabase
      .rpc('nearby_shops', { user_lat: location.lat, user_lng: location.lng, radius_km: 40 })
      .then(({ data }) => setNearby((data || []).slice(0, 6)))
  }, [location])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Muslim shops & sellers, near you</p>
          <h1>Oud, thobes, abayas and Qurans — from the shop down the street.</h1>
          <p className="hero-sub">Discover local stores and home sellers in your community. Message them directly, pick up nearby, or have it shipped.</p>
          <form className="hero-search" onSubmit={(e) => { e.preventDefault(); nav(`/browse?q=${encodeURIComponent(q)}`) }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you looking for?" />
            <button className="btn btn-gold">Search</button>
          </form>
          <div className="hero-links">
            <Link to="/agent" className="btn btn-ghost-light">✨ Ask the AI Shopper</Link>
            <Link to="/nearby" className="btn btn-ghost-light">📍 Shops near me</Link>
            <Link to="/sell" className="btn btn-ghost-light">Become a seller →</Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Shop by category</h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/browse?category=${c.id}`} className="cat-tile">
              <span className="cat-icon">{c.icon}</span>
              <span className="cat-label">{c.label}</span>
              <span className="muted small">{c.types.slice(0, 3).join(' · ')}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2 className="section-title">Shops near you</h2>
          <Link to="/nearby" className="link">See map →</Link>
        </div>
        <LocationBar location={location} onChange={setLocation} />
        {!location && <p className="muted">Share your location or enter a city to see nearby shops.</p>}
        {location && nearby && nearby.length === 0 && (
          <p className="muted">No shops within 25 miles yet. <Link to="/sell" className="link">Be the first to list yours.</Link></p>
        )}
        {nearby?.length > 0 && <div className="shop-grid">{nearby.map((s) => <ShopCard key={s.id} shop={s} />)}</div>}
      </section>

      <section className="container section">
        <div className="section-head">
          <h2 className="section-title">Just listed</h2>
          <Link to="/browse" className="link">Browse all →</Link>
        </div>
        {latest.length === 0 ? (
          <div className="empty">No products yet. <Link to="/sell" className="link">List the first one.</Link></div>
        ) : (
          <div className="product-grid">{latest.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        )}
      </section>

      <section className="container section">
        <div className="sell-band">
          <div>
            <h2>Sell to your community</h2>
            <p>Run a shop or sell from home? List your attar, clothing or books free and let nearby buyers find you.</p>
          </div>
          <Link to="/sell" className="btn btn-gold">Start selling</Link>
        </div>
      </section>
    </>
  )
}
