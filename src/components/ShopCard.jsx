import { Link } from 'react-router-dom'
import { formatDistance } from '../lib/geo'

export default function ShopCard({ shop, active, onHover }) {
  return (
    <Link
      to={`/shop/${shop.id}`}
      className={`card shop-card ${active ? 'active' : ''}`}
      onMouseEnter={() => onHover?.(shop.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="shop-logo">{shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.name[0]}</div>
      <div className="shop-info">
        <h3>{shop.name}</h3>
        <div className="muted small truncate">{shop.address || shop.city}</div>
        <div className="chips">
          {shop.distance_km != null && <span className="chip chip-strong">{formatDistance(shop.distance_km)}</span>}
          {shop.has_storefront ? <span className="chip">Storefront</span> : <span className="chip">Home seller</span>}
          {shop.ships && <span className="chip">Ships</span>}
        </div>
      </div>
    </Link>
  )
}
