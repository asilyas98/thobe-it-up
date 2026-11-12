import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// Custom HTML pins (avoids Leaflet's default-icon image path issues with Vite)
const pin = (active) =>
  L.divIcon({
    className: '',
    html: `<div class="map-pin ${active ? 'active' : ''}"><span>ث</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  })

const youIcon = L.divIcon({ className: '', html: '<div class="map-you"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

function FitTo({ center, radiusKm }) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    if (radiusKm) map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000), { padding: [20, 20] })
    else map.setView([center.lat, center.lng], 14)
  }, [center?.lat, center?.lng, radiusKm, map])
  return null
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export default function ShopMap({ center, radiusKm, shops = [], activeId, onMapClick, picked, height = 420 }) {
  const start = center || picked || { lat: 42.3314, lng: -83.0458 } // default: Detroit
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={[start.lat, start.lng]} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitTo center={center || picked} radiusKm={radiusKm} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {center && radiusKm && (
          <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: '#0f4c3a', weight: 1, fillOpacity: 0.05 }} />
        )}
        {center && !onMapClick && <Marker position={[center.lat, center.lng]} icon={youIcon} />}
        {picked && <Marker position={[picked.lat, picked.lng]} icon={pin(true)} />}
        {shops.filter((s) => s.lat != null).map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={pin(s.id === activeId)} zIndexOffset={s.id === activeId ? 1000 : 0}>
            <Popup>
              <strong>{s.name}</strong>
              <br />
              <span>{s.address || s.city}</span>
              <br />
              <Link to={`/shop/${s.id}`}>View shop →</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
