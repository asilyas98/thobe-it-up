export default function SetupNeeded() {
  return (
    <div className="container page narrow">
      <h1>Almost there</h1>
      <p>Thobe It Up needs its Supabase keys. Add these environment variables (in a <code>.env</code> file locally, or in Netlify → Site settings → Environment variables) and redeploy:</p>
      <pre className="code">VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=your-anon-key</pre>
      <p className="muted">See README.md for the full setup checklist.</p>
    </div>
  )
}
