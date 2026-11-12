import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'

export default function Favorites() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)

  useEffect(() => {
    supabase
      .from('favorites')
      .select('created_at, products(*, shops(id,name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems((data || []).map((r) => r.products).filter(Boolean)))
  }, [user.id])

  return (
    <div className="container page">
      <h1 className="page-title">Saved items</h1>
      {!items ? <div className="spinner" /> : items.length === 0 ? (
        <div className="empty">Nothing saved yet. Tap ♡ on any product to save it. <Link to="/browse" className="link">Browse</Link></div>
      ) : (
        <div className="product-grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  )
}
