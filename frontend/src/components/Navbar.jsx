import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './Navbar.css'

const LOGO = 'https://res.cloudinary.com/dcabuupn1/image/upload/v1782615005/Logo_ECOMM_ttq36x.png'

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <img src={LOGO} alt="Logo" className="navbar-logo" />
        </NavLink>

        {user?.role === 'customer' && (
          <div className="navbar-links">
            <NavLink to="/"       className={({ isActive }) => isActive ? 'active' : ''}>Tienda</NavLink>
            <NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>Buscar</NavLink>
          </div>
        )}

        {!user && (
          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Tienda</NavLink>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="navbar-admin-badge">Panel de Administración</div>
        )}

        <div className="navbar-user">
          {user ? (
            <>
              <span className="navbar-user-name">{user.name}</span>
              <button className="navbar-logout" onClick={handleLogout} title="Cerrar sesión">
                <IconLogout />
                <span>Salir</span>
              </button>
            </>
          ) : (
            <button className="navbar-login-btn" onClick={() => navigate('/login')}>
              Iniciar sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
