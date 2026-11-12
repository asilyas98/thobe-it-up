import { supabase } from './supabase'

// Call the "ai-agent" Edge Function. Throws a readable Error on failure.
export async function ai(mode, body = {}) {
  const { data, error } = await supabase.functions.invoke('ai-agent', { body: { mode, ...body } })
  if (error) {
    let msg = 'The AI agent is unavailable right now.'
    try {
      const j = await error.context.json()
      if (j?.error) msg = j.error
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// Fire-and-forget (moderation scans, auto-replies, ticket triage)
export const aiBackground = (mode, body) => ai(mode, body).catch((e) => console.warn(`[ai:${mode}]`, e.message))
