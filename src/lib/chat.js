import { supabase } from './supabase'

// Find or create the buyer↔shop conversation and return its id
export async function openConversation(buyerId, shopId, productId = null) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await supabase
    .from('conversations')
    .insert({ buyer_id: buyerId, shop_id: shopId, product_id: productId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// WhatsApp deep link (digits only)
export const waLink = (num, text = '') =>
  `https://wa.me/${String(num).replace(/[^\d]/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`
