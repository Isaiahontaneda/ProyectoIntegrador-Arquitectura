import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Navbar from './components/Navbar.jsx'
import LoginPage from './pages/LoginPage.jsx'
import StorePage from './pages/StorePage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function StoreRoute({ children }) {
  const { user } = useAuth()
  // Admin visiting store → redirect to panel
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  const location = useLocation()
  const showNav  = location.pathname.startsWith('/admin')
  return (
    <>
      {showNav && <Navbar />}
      <Routes>
        <Route path="/login" element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />
            : <LoginPage />
        } />

        <Route path="/" element={
          <StoreRoute><StorePage /></StoreRoute>
        } />

        <Route path="/search" element={
          <StoreRoute><SearchPage /></StoreRoute>
        } />

        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />

        <Route path="*" element={
          <Navigate to={user ? (user.role === 'admin' ? '/admin' : '/') : '/'} replace />
        } />
      </Routes>
    </>
  )
}
