import { Link } from 'react-router-dom'
import { catById, formatPrice } from '../lib/catalog'
import { formatDistance } from '../lib/geo'

export default function ProductCard({ p, distanceKm }) {
  const cat = catById(p.category)
  return (
    <Link to={`/product/${p.id}`} className="card product-card">
      <div className="product-img">
        {p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" /> : <div className="img-ph">{cat?.icon || '🛍️'}</div>}
        {!p.in_stock && <span className="badge badge-muted">Out of stock</span>}
      </div>
      <div className="product-body">
        <div className="product-meta">{p.product_type || cat?.label}{p.book_language ? ` · ${p.book_language}` : ''}</div>
        <h3 className="product-title">{p.title}</h3>
        <div className="product-foot">
          <span className="price">{formatPrice(p.price, p.currency)}</span>
          {p.shops?.name && <span className="muted small truncate">{p.shops.name}{distanceKm != null ? ` · ${formatDistance(distanceKm)}` : ''}</span>}
        </div>
      </div>
    </Link>
  )
}
