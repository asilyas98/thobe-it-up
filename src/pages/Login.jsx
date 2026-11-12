import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SocialButtons from '../components/SocialButtons'

export default function Login() {
  const { user, signInWithEmail, resetPassword } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) nav(next, { replace: true }) }, [user, next, nav])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await signInWithEmail(email, password)
    setBusy(false)
    if (error) setErr(error.message)
  }

  const forgot = async () => {
    if (!email) return setErr('Enter your email first, then tap “Forgot password”.')
    const { error } = await resetPassword(email)
    if (error) setErr(error.message)
    else setMsg('Check your email for a reset link.')
  }

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to message sellers and manage your shop.</p>
        <SocialButtons next={next} />
        <form onSubmit={submit} className="form">
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {err && <p className="error small">{err}</p>}
          {msg && <p className="success small">{msg}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <div className="auth-foot small">
          <button className="link" onClick={forgot}>Forgot password?</button>
          <span>New here? <Link className="link" to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></span>
        </div>
      </div>
    </div>
  )
}
