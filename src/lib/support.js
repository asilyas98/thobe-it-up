export const TICKET_CATEGORIES = {
  account: 'Account & login',
  report_seller: 'Report a seller',
  report_listing: 'Report a listing',
  buying: 'Buying',
  selling: 'Selling',
  technical: 'Bug / technical',
  feedback: 'Feedback',
  other: 'Other',
}

export const TICKET_STATUS = {
  open: { label: 'Open', cls: 'st-open' },
  pending: { label: 'Awaiting your reply', staffLabel: 'Waiting on customer', cls: 'st-pending' },
  resolved: { label: 'Resolved', cls: 'st-resolved' },
  closed: { label: 'Closed', cls: 'st-closed' },
}

export const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export const ticketNo = (t) => `TIU-${t.ticket_number}`

export const openSupportChat = (prefill) =>
  window.dispatchEvent(new CustomEvent('open-support', { detail: prefill ? { prefill } : undefined }))

export const fmtDate = (d) =>
  new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
