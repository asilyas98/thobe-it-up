import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES, BOOK_LANGUAGES, GENDERS, catById } from '../lib/catalog'
import { loadSavedLocation } from '../lib/geo'
import ProductCard from '../components/ProductCard'
import LocationBar from '../components/LocationBar'

const PAGE = 24
const RADII = [ ['', 'Any distance'], ['8', '5 mi'], ['16', '10 mi'], ['40', '25 mi'], ['80', '50 mi'] ]

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [location, setLocation] = useState(loadSavedLocation())
  const [distances, setDistances] = useState({})
  const [showFilters, setShowFilters] = useState(false)

  const f = useMemo(() => Object.fromEntries(params.entries()), [params])
  const cat = catById(f.category)

  const setF = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value == null || value === false) next.delete(key)
    else next.set(key, value)
    if (key === 'category') { next.delete('type'); next.delete('lang'); next.delete('gender') }
    setParams(next)
  }
  const clearAll = () => setParams(f.q ? { q: f.q } : {})

  useEffect(() => { setPage(0) }, [params, location])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)

      // Distance filter → get shop ids within radius
      let shopIds = null
      let dist = {}
      if (location && (f.radius || f.sort === 'nearest')) {
        const { data } = await supabase.rpc('nearby_shops', {
          user_lat: location.lat, user_lng: location.lng, radius_km: f.radius ? Number(f.radius) : 20000,
        })
        dist = Object.fromEntries((data || []).map((s) => [s.id, s.distance_km]))
        shopIds = f.radius ? Object.keys(dist) : null
        if (shopIds && shopIds.length === 0) {
          if (!cancelled) { setItems([]); setCount(0); setDistances({}); setLoading(false) }
          return
        }
      }

      let q = supabase
        .from('products')
        .select('*, shops!inner(id,name,city,is_active)', { count: 'exact' })
        .eq('shops.is_active', true)

      if (f.q) {
        const term = f.q.replace(/[%,()]/g, ' ').trim()
        if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,product_type.ilike.%${term}%`)
      }
      if (f.category) q = q.eq('category', f.category)
      if (f.type) q = q.eq('product_type', f.type)
      if (f.lang) q = q.eq('book_language', f.lang)
      if (f.gender) q = q.eq('gender', f.gender)
      if (f.min) q = q.gte('price', Number(f.min))
      if (f.max) q = q.lte('price', Number(f.max))
      if (f.instock) q = q.eq('in_stock', true)
      if (shopIds) q = q.in('shop_id', shopIds)

      if (f.sort === 'price_asc') q = q.order('price', { ascending: true, nullsFirst: false })
      else if (f.sort === 'price_desc') q = q.order('price', { ascending: false, nullsFirst: false })
      else q = q.order('created_at', { ascending: false })

      const nearest = f.sort === 'nearest' && location
      q = nearest ? q.limit(500) : q.range(page * PAGE, page * PAGE + PAGE - 1)

      const { data, count: c } = await q
      if (cancelled) return
      let rows = data || []
      if (nearest) {
        rows = rows.sort((a, b) => (dist[a.shop_id] ?? 1e9) - (dist[b.shop_id] ?? 1e9)).slice(0, (page + 1) * PAGE)
        setItems(rows)
      } else {
        setItems((prev) => (page === 0 ? rows : [...prev, ...rows]))
      }
      setCount(c || 0)
      setDistances(dist)
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [f, location, page])

  const activeChips = [
    f.category && ['category', cat?.label],
    f.type && ['type', f.type],
    f.lang && ['lang', f.lang],
    f.gender && ['gender', f.gender],
    f.radius && ['radius', RADII.find((r) => r[0] === f.radius)?.[1]],
    f.instock && ['instock', 'In stock'],
    (f.min || f.max) && ['price', `$${f.min || 0}–${f.max ? `$${f.max}` : 'any'}`],
  ].filter(Boolean)

  return (
    <div className="container page">
      <div className="browse-head">
        <div>
          <h1 className="page-title">{f.q ? `“${f.q}”` : cat ? cat.label : 'All products'}</h1>
          <p className="muted">{loading && page === 0 ? 'Searching…' : `${count} result${count === 1 ? '' : 's'}`}</p>
        </div>
        <div className="browse-actions">
          <button className="btn btn-outline only-mobile" onClick={() => setShowFilters(true)}>Filters{activeChips.length ? ` (${activeChips.length})` : ''}</button>
          <select value={f.sort || ''} onChange={(e) => setF('sort', e.target.value)} aria-label="Sort">
            <option value="">Newest</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
            {location && <option value="nearest">Nearest first</option>}
          </select>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="chips active-chips">
          {activeChips.map(([k, label]) => (
            <button key={k} className="chip chip-x" onClick={() => {
              if (k === 'price') { const n = new URLSearchParams(params); n.delete('min'); n.delete('max'); setParams(n) }
              else setF(k, '')
            }}>{label} ✕</button>
          ))}
          <button className="link small" onClick={clearAll}>Clear all</button>
        </div>
      )}

      <div className="browse-layout">
        <aside className={`filters ${showFilters ? 'open' : ''}`}>
          <div className="filters-head only-mobile">
            <strong>Filters</strong>
            <button className="link" onClick={() => setShowFilters(false)}>Done</button>
          </div>

          <div className="filter-group">
            <h4>Category</h4>
            <label className="radio"><input type="radio" checked={!f.category} onChange={() => setF('category', '')} /> All</label>
            {CATEGORIES.map((c) => (
              <label key={c.id} className="radio">
                <input type="radio" checked={f.category === c.id} onChange={() => setF('category', c.id)} /> {c.icon} {c.label}
              </label>
            ))}
          </div>

          {cat && (
            <div className="filter-group">
              <h4>{cat.id === 'books' ? 'Type of book' : 'Type'}</h4>
              <div className="chips">
                {cat.types.map((t) => (
                  <button key={t} className={`chip chip-btn ${f.type === t ? 'on' : ''}`} onClick={() => setF('type', f.type === t ? '' : t)}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {cat?.hasLanguage && (
            <div className="filter-group">
              <h4>Language</h4>
              <select value={f.lang || ''} onChange={(e) => setF('lang', e.target.value)}>
                <option value="">Any language</option>
                {BOOK_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          )}

          {cat?.hasGender && (
            <div className="filter-group">
              <h4>For</h4>
              <div className="chips">
                {GENDERS.map((g) => (
                  <button key={g} className={`chip chip-btn ${f.gender === g ? 'on' : ''}`} onClick={() => setF('gender', f.gender === g ? '' : g)}>{g}</button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-group">
            <h4>Price</h4>
            <div className="price-row">
              <input key={`min-${f.min || ""}`} type="number" min="0" placeholder="Min" defaultValue={f.min || ''} onBlur={(e) => setF('min', e.target.value)} />
              <span>–</span>
              <input key={`max-${f.max || ""}`} type="number" min="0" placeholder="Max" defaultValue={f.max || ''} onBlur={(e) => setF('max', e.target.value)} />
            </div>
            <label className="check"><input type="checkbox" checked={!!f.instock} onChange={(e) => setF('instock', e.target.checked ? '1' : '')} /> In stock only</label>
          </div>

          <div className="filter-group">
            <h4>Distance</h4>
            <LocationBar location={location} onChange={setLocation} />
            <select value={f.radius || ''} onChange={(e) => setF('radius', e.target.value)} disabled={!location}>
              {RADII.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {!location && <p className="muted small">Set a location to filter by distance.</p>}
          </div>
        </aside>

        <section>
          {!loading && items.length === 0 ? (
            <div className="empty">No products match these filters. Try widening your search.</div>
          ) : (
            <div className="product-grid">
              {items.map((p) => <ProductCard key={p.id} p={p} distanceKm={distances[p.shop_id]} />)}
            </div>
          )}
          {items.length < count && (
            <div className="center">
              <button className="btn btn-outline" disabled={loading} onClick={() => setPage(page + 1)}>{loading ? 'Loading…' : 'Load more'}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
