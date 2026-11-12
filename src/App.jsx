import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Browse from './pages/Browse'
import ProductPage from './pages/ProductPage'
import NearbyShops from './pages/NearbyShops'
import ShopPage from './pages/ShopPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Account from './pages/Account'
import Favorites from './pages/Favorites'
import Messages from './pages/Messages'
import SellerDashboard from './pages/SellerDashboard'
import ShopEditor from './pages/ShopEditor'
import ProductEditor from './pages/ProductEditor'
import Support from './pages/Support'
import AdminTickets from './pages/AdminTickets'
import SupportChat from './components/SupportChat'
import AgentShopper from './pages/AgentShopper'
import AdminAgent from './pages/AdminAgent'

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/nearby" element={<NearbyShops />} />
          <Route path="/shop/:id" element={<ShopPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/sell" element={<RequireAuth><SellerDashboard /></RequireAuth>} />
          <Route path="/sell/shop/new" element={<RequireAuth><ShopEditor /></RequireAuth>} />
          <Route path="/sell/shop/:id" element={<RequireAuth><ShopEditor /></RequireAuth>} />
          <Route path="/sell/shop/:shopId/product/new" element={<RequireAuth><ProductEditor /></RequireAuth>} />
          <Route path="/sell/product/:id" element={<RequireAuth><ProductEditor /></RequireAuth>} />
          <Route path="/agent" element={<AgentShopper />} />
          <Route path="/admin/agent" element={<RequireAuth><AdminAgent /></RequireAuth>} />
          <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
          <Route path="/support/:id" element={<RequireAuth><Support /></RequireAuth>} />
          <Route path="/admin/tickets" element={<RequireAuth><AdminTickets /></RequireAuth>} />
          <Route path="/admin/tickets/:id" element={<RequireAuth><AdminTickets /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <SupportChat />
    </div>
  )
}
