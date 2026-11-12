import { useEffect, useState } from 'react'
import { supabase, uploadImage } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({ full_name: '', phone: '', avatar_url: '' })
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '', avatar_url: profile.avatar_url || '' })
  }, [profile])

  const save = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...form })
    if (error) return setErr(error.message)
    await refreshProfile(); setMsg('Saved.')
  }

  const avatar = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try { setForm({ ...form, avatar_url: await uploadImage(file, user.id) }) } catch (e2) { setErr(e2.message) }
  }

  const changePw = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setErr(error.message); else { setPw(''); setMsg('Password updated.') }
  }

  const provider = user.app_metadata?.provider

  return (
    <div className="container page narrow">
      <h1 className="page-title">Your account</h1>
      <p className="muted">Signed in as {user.email}{provider && provider !== 'email' ? ` via ${provider[0].toUpperCase() + provider.slice(1)}` : ''}</p>

      <form className="card form" onSubmit={save}>
        <div className="avatar-row">
          <div className="avatar-lg">{form.avatar_url ? <img src={form.avatar_url} alt="" /> : (form.full_name || '?')[0]}</div>
          <label className="btn btn-outline">Change photo<input type="file" accept="image/*" hidden onChange={avatar} /></label>
        </div>
        <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Phone (optional)<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <button className="btn btn-primary">Save profile</button>
      </form>

      <form className="card form" onSubmit={changePw}>
        <h3>{provider === 'email' ? 'Change password' : 'Add a password'}</h3>
        <p className="muted small">Lets you also log in with email + password.</p>
        <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        <button className="btn btn-outline">Update password</button>
      </form>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}
    </div>
  )
}
