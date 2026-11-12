export function getMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Location permission denied. You can search by city instead.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  })
}

// Free geocoding via OpenStreetMap Nominatim
export async function geocode(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'en' } }
  )
  if (!res.ok) throw new Error('Address lookup failed')
  const data = await res.json()
  return data.map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    city: d.address?.city || d.address?.town || d.address?.village || d.address?.county || '',
  }))
}

export const kmToMi = (km) => km * 0.621371
export const formatDistance = (km) => (km == null ? '' : `${kmToMi(km).toFixed(km < 1.6 ? 1 : 0)} mi`)

// Saved location (so users don't re-allow every visit)
const KEY = 'tiu_location'
export function loadSavedLocation() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}
export function saveLocation(loc) {
  try { localStorage.setItem(KEY, JSON.stringify(loc)) } catch { /* ignore */ }
}
