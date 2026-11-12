import { NavLink } from 'react-router-dom'

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      <NavLink to="/admin/tickets">🎫 Tickets</NavLink>
      <NavLink to="/admin/agent">🤖 AI agent</NavLink>
    </nav>
  )
}
