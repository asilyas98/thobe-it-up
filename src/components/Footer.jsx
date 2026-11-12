import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div>
          <div className="logo"><span className="logo-mark">ث</span><span>Thobe It Up</span></div>
          <p className="muted small">Find Muslim-owned shops and sellers near you — fragrance, modest clothing, Qurans and more.</p>
        </div>
        <div className="footer-links">
          <Link to="/browse">Browse</Link>
          <Link to="/nearby">Shops near me</Link>
          <Link to="/sell">Sell with us</Link>
          <button className="footer-btn" onClick={() => window.dispatchEvent(new Event('open-support'))}>Help & support</button>
        </div>
      </div>
      <div className="container muted small">© {new Date().getFullYear()} Thobe It Up</div>
    </footer>
  )
}
