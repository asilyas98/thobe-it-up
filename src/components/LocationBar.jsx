import { useState } from 'react'
import { geocode, getMyLocation, saveLocation } from '../lib/geo'

// "Use my location" or type a city/zip — calls onChange({lat,lng,label})
export default function LocationBar({ location, onChange }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (loc) => { saveLocation(loc); onChange(loc) }

  const useMine = async () => {
    setBusy(true); setErr('')
    try { set({ ...(await getMyLocation()), label: 'My location' }) }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const search = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setErr('')
    try {
      const [r] = await geocode(q)
      if (!r) throw new Error('Place not found')
      set({ lat: r.lat, lng: r.lng, label: r.city || q })
    } catch (e2) { setErr(e2.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="location-bar">
      <button type="button" className="btn btn-outline" onClick={useMine} disabled={busy}>📍 Use my location</button>
      <form onSubmit={search} className="inline-form">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="or enter city / ZIP" />
        <button className="btn" disabled={busy}>Go</button>
      </form>
      {location && <span className="muted small">Showing near <strong>{location.label}</strong></span>}
      {err && <span className="error small">{err}</span>}
    </div>
  )
}
