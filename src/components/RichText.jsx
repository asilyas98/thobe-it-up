import { Fragment } from 'react'
import { Link } from 'react-router-dom'

// Tiny, safe renderer for the assistant's replies:
// [text](/internal) links, [text](https://external) links, **bold**, "- " bullet lines, line breaks.
// No HTML is ever injected.
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

function inline(text, onNavigate) {
  const out = []
  let last = 0
  let m
  const re = new RegExp(TOKEN.source, 'g')
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      const href = m[2]
      if (href.startsWith('/') && !href.startsWith('//')) {
        out.push(<Link key={m.index} to={href} onClick={onNavigate}>{m[1]}</Link>)
      } else if (/^https:\/\//i.test(href)) {
        out.push(<a key={m.index} href={href} target="_blank" rel="noreferrer noopener">{m[1]}</a>)
      } else out.push(m[1])
    } else if (m[3]) out.push(<strong key={m.index}>{inline(m[3], onNavigate)}</strong>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function RichText({ text, onNavigate }) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let list = null
  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bullet) {
      if (!list) { list = []; blocks.push({ type: 'ul', items: list }) }
      list.push(bullet[1])
    } else {
      list = null
      if (line.trim()) blocks.push({ type: 'p', text: line, key: i })
    }
  })
  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, onNavigate)}</li>)}</ul>
        ) : (
          <p key={i}>{inline(b.text, onNavigate).map((x, j) => <Fragment key={j}>{x}</Fragment>)}</p>
        )
      )}
    </>
  )
}
