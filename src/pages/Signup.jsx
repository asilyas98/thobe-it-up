import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SocialButtons from '../components/SocialButtons'

export default function Signup() {
  const { user, signUpWithEmail } = useAuth()
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'buyer')
  const next = params.get('next') || (role === 'seller' ? '/sell' : '/')
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) nav(next, { replace: true }) }, [user, next, nav])

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return setErr('Password must be at least 8 characters.')
    setBusy(true); setErr('')
    const { data, error } = await signUpWithEmail(form.email, form.password, form.name, role === 'seller')
    setBusy(false)
    if (error) return setErr(error.message)
    if (!data.session) setDone(true) // email confirmation required
  }

  if (done) return (
    <div className="container page auth-page">
      <div className="card auth-card center">
        <h1>Check your email ✉️</h1>
        <p>We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.</p>
      </div>
    </div>
  )

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Join Thobe It Up</h1>
        <div className="role-pick">
          <button type="button" className={role === 'buyer' ? 'on' : ''} onClick={() => setRole('buyer')}>
            <strong>🛍️ I want to buy</strong><span className="small muted">Find shops & message sellers</span>
          </button>
          <button type="button" className={role === 'seller' ? 'on' : ''} onClick={() => setRole('seller')}>
            <strong>🏪 I want to sell</strong><span className="small muted">List your shop & products</span>
          </button>
        </div>
        <p className="muted small">You can always do both — sellers can buy too.</p>
        <SocialButtons next={next} />
        <form onSubmit={submit} className="form">
          <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
          <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" placeholder="At least 8 characters" /></label>
          {err && <p className="error small">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <div className="auth-foot small"><span>Already have an account? <Link className="link" to="/login">Log in</Link></span></div>
      </div>
    </div>
  )
}
