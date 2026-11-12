import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const search = (e) => {
    e.preventDefault()
    nav(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
    setOpen(false)
  }

  const close = () => setOpen(false)

  return (
    <header className="header">
      <div className="container header-row">
        <Link to="/" className="logo" onClick={close}>
          <span className="logo-mark">ث</span>
          <span>Thobe It Up</span>
        </Link>

        <form className="header-search" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search oud, abayas, Quran…" aria-label="Search" />
          <button aria-label="Search">⌕</button>
        </form>

        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>

        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/browse" onClick={close}>Shop</NavLink>
          <NavLink to="/nearby" onClick={close}>Near me</NavLink>
          <NavLink to="/agent" onClick={close} className="nav-ai">✨ AI Shopper</NavLink>
          {user ? (
            <>
              <NavLink to="/messages" onClick={close}>Messages</NavLink>
              <NavLink to="/favorites" onClick={close}>Saved</NavLink>
              <NavLink to="/support" onClick={close}>Help</NavLink>
              {profile?.is_admin && <NavLink to="/admin/tickets" onClick={close}>Admin</NavLink>}
              <NavLink to="/sell" onClick={close} className="nav-cta">{profile?.is_seller ? 'Seller hub' : 'Start selling'}</NavLink>
              <NavLink to="/account" onClick={close} className="avatar-link" title="Account">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{(profile?.full_name || user.email || '?')[0].toUpperCase()}</span>}
              </NavLink>
              <button className="link-btn" onClick={() => { signOut(); close(); nav('/') }}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={close}>Log in</NavLink>
              <NavLink to="/signup" onClick={close} className="nav-cta">Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
