import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, getCategories } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import OrderModal from '../components/OrderModal.jsx'
import './StorePage.css'

const LOGO = 'https://res.cloudinary.com/dcabuupn1/image/upload/v1782615005/Logo_ECOMM_ttq36x.png'

// ─── Icons ───────────────────────────────────────────
const IcoSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="#6e85a8" strokeWidth="1.8"/>
    <path d="M16 16l4 4" stroke="#6e85a8" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoUser = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="#9db4d6" strokeWidth="1.8"/>
    <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" stroke="#9db4d6" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoCart = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <path d="M5 7h14l-1.2 10.2A2 2 0 0 1 15.8 19H8.2a2 2 0 0 1-2-1.8L5 7z" stroke="#9db4d6" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M8.5 7a3.5 3.5 0 0 1 7 0" stroke="#9db4d6" strokeWidth="1.8"/>
  </svg>
)
const IcoHeart = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" stroke="#9db4d6" strokeWidth="1.7" strokeLinejoin="round"/>
  </svg>
)
const IcoBag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 7h14l-1.2 10.2A2 2 0 0 1 15.8 19H8.2a2 2 0 0 1-2-1.8L5 7z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M8.5 7a3.5 3.5 0 0 1 7 0" stroke="#fff" strokeWidth="1.8"/>
  </svg>
)
const IcoLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

// ─── Category icon paths ──────────────────────────────
const CAT_ICONS = {
  'Electrónica':   'M7 14a5 5 0 0 1 10 0M9 18h6M12 8V5',
  'Computadoras':  'M4 6h16v9H4zM2 19h20',
  'Smartphones':   'M8 3h8v18H8zM11 18h2',
  'Accesorios':    'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  'Hogar':         'M4 11l8-6 8 6M6 10v9h12v-9',
  'Ropa':          'M12 3l3 3-3 3-3-3zM4 10l5-5 3 3 3-3 5 5v11H4z',
  'Deportes':      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
  'Juguetes':      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  '_default':      'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM8 7V5a4 4 0 0 1 8 0v2',
}

function CatIcon({ name }) {
  const d = CAT_ICONS[name] || CAT_ICONS['_default']
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function StorePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts]       = useState([])
  const [categories, setCategories]   = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [orderTarget, setOrderTarget] = useState(null)
  const [cartCount] = useState(0)

  useEffect(() => {
    getCategories()
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getProducts(activeCategory || undefined)
      .then(setProducts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeCategory])

  const handleOrder = (product) => {
    if (!user) { navigate('/login'); return }
    setOrderTarget(product)
  }

  const handleUserBtn = () => {
    if (!user) navigate('/login')
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="sf-root">

      {/* ── Header ── */}
      <header className="sf-header">
        <a href="/" className="sf-brand" onClick={e => { e.preventDefault(); navigate('/') }}>
          <img src={LOGO} alt="Logo" className="sf-brand-logo" />
        </a>

        <div className="sf-search-bar" onClick={() => navigate('/search')}>
          <IcoSearch />
          <span>Buscar productos…</span>
        </div>

        <div className="sf-spacer" />

        {user ? (
          <div className="sf-user-row">
            <span className="sf-user-name">{user.name}</span>
            <button className="sf-logout-btn" onClick={handleLogout}>
              <IcoLogout />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <button className="sf-login-btn" onClick={handleUserBtn}>
            <IcoUser />
            Iniciar sesión
          </button>
        )}

        <button className="sf-icon-btn sf-cart-btn">
          <IcoCart />
          {cartCount > 0 && <span className="sf-cart-badge">{cartCount}</span>}
        </button>
      </header>

      {/* ── Nav ── */}
      <nav className="sf-nav">
        <a
          className={`sf-nav-link${!activeCategory ? ' active' : ''}`}
          onClick={() => setActiveCategory('')}
        >Inicio</a>
        <a
          className="sf-nav-link"
          onClick={() => navigate('/search')}
        >Categorías</a>
        <a className="sf-nav-link">Ofertas</a>
        <a className="sf-nav-link">Contacto</a>
      </nav>

      {/* ── Hero ── */}
      <section className="sf-hero">
        <div className="sf-hero-glow" />
        <div className="sf-hero-circle" />

        <div className="sf-hero-content">
          <h1 className="sf-hero-title">Encuentra lo<br />que necesitas</h1>
          <p className="sf-hero-sub">Descubre productos increíbles con la mejor calidad y precio.</p>
          <button
            className="sf-hero-btn"
            onClick={() => document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Ver productos
          </button>
        </div>

        <div className="sf-hero-products">
          <div className="sf-hero-prod sf-hero-prod--sm" />
          <div className="sf-hero-prod sf-hero-prod--lg" />
          <div className="sf-hero-prod sf-hero-prod--md" />
        </div>
      </section>

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <section className="sf-section">
          <div className="sf-section-head">
            <h2 className="sf-section-title">Categorías destacadas</h2>
            <button className="sf-see-all" onClick={() => navigate('/search')}>Ver todas</button>
          </div>
          <div className="sf-cat-grid">
            {categories.map(cat => (
              <div
                key={cat.category}
                className={`sf-cat-card${activeCategory === cat.category ? ' active' : ''}`}
                onClick={() => setActiveCategory(prev => prev === cat.category ? '' : cat.category)}
              >
                <div className="sf-cat-icon"><CatIcon name={cat.category} /></div>
                <span className="sf-cat-name">{cat.category}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Products ── */}
      <section className="sf-section" id="sf-products">
        <div className="sf-section-head">
          <div>
            <h2 className="sf-section-title">
              {activeCategory ? activeCategory : 'Productos recomendados para ti'}
            </h2>
            <p className="sf-section-sub">
              {activeCategory
                ? `${products.length} producto${products.length !== 1 ? 's' : ''} encontrado${products.length !== 1 ? 's' : ''}`
                : 'Descubre nuestro catálogo completo'}
            </p>
          </div>
        </div>

        {loading && <div className="sf-spinner" />}
        {error   && <div className="sf-error">{error}</div>}

        {!loading && !error && (
          products.length === 0
            ? <p className="sf-empty">No hay productos disponibles.</p>
            : (
              <div className="sf-prod-grid">
                {products.map(p => (
                  <div key={p.id} className="sf-prod-card">
                    <div className="sf-prod-img">
                      <span className="sf-prod-img-label">product photo</span>
                      <button className="sf-prod-wish"><IcoHeart /></button>
                    </div>
                    <div className="sf-prod-body">
                      <div className="sf-prod-cat">{p.category}</div>
                      <div className="sf-prod-name">{p.name}</div>
                      <div className="sf-prod-footer">
                        <span className="sf-prod-price">${parseFloat(p.price).toFixed(2)}</span>
                        <button
                          className="sf-prod-add"
                          disabled={p.stock === 0}
                          onClick={() => handleOrder(p)}
                        >
                          <IcoBag />
                          {p.stock === 0 ? 'Agotado' : 'Ordenar'}
                        </button>
                      </div>
                      {p.stock <= 10 && p.stock > 0 && (
                        <div className="sf-prod-stock-warn">Solo {p.stock} en stock</div>
                      )}
                      {p.stock === 0 && (
                        <div className="sf-prod-stock-out">Agotado</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}
      </section>

      {orderTarget && (
        <OrderModal
          product={orderTarget}
          onClose={() => {
            setOrderTarget(null)
            getProducts(activeCategory || undefined).then(setProducts).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
