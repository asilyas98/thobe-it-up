import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadSavedLocation } from '../lib/geo'
import LocationBar from '../components/LocationBar'
import ShopMap from '../components/ShopMap'
import ShopCard from '../components/ShopCard'

const RADII = [5, 10, 25, 50, 100] // miles

export default function NearbyShops() {
  const [location, setLocation] = useState(loadSavedLocation())
  const [miles, setMiles] = useState(25)
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(null)
  const [kind, setKind] = useState('all') // all | storefront | home
  const [text, setText] = useState('')

  useEffect(() => {
    if (!location) return
    setLoading(true)
    supabase
      .rpc('nearby_shops', { user_lat: location.lat, user_lng: location.lng, radius_km: miles * 1.609 })
      .then(({ data }) => { setShops(data || []); setLoading(false) })
  }, [location, miles])

  const shown = useMemo(() => shops.filter((s) =>
    (kind === 'all' || (kind === 'storefront' ? s.has_storefront : !s.has_storefront)) &&
    (!text || `${s.name} ${s.description || ''}`.toLowerCase().includes(text.toLowerCase()))
  ), [shops, kind, text])

  return (
    <div className="container page">
      <h1 className="page-title">Shops & sellers near you</h1>
      <LocationBar location={location} onChange={setLocation} />

      <div className="toolbar">
        <div className="seg">
          {[['all', 'All'], ['storefront', 'Storefronts'], ['home', 'Home sellers']].map(([v, l]) => (
            <button key={v} className={kind === v ? 'on' : ''} onClick={() => setKind(v)}>{l}</button>
          ))}
        </div>
        <select value={miles} onChange={(e) => setMiles(Number(e.target.value))} aria-label="Radius">
          {RADII.map((r) => <option key={r} value={r}>Within {r} mi</option>)}
        </select>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by shop name…" />
      </div>

      <div className="nearby-layout">
        <ShopMap center={location} radiusKm={location ? miles * 1.609 : null} shops={shown} activeId={active} height={560} />
        <div className="shop-list">
          {!location && <div className="empty">Set your location to see shops around you.</div>}
          {location && loading && <div className="spinner" />}
          {location && !loading && shown.length === 0 && <div className="empty">No shops in this area yet. Try a bigger radius.</div>}
          {shown.map((s) => <ShopCard key={s.id} shop={s} active={active === s.id} onHover={setActive} />)}
        </div>
      </div>
    </div>
  )
}
