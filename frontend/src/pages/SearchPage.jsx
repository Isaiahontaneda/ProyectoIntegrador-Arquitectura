import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchProducts, getRecommendations, getCategories } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import OrderModal from '../components/OrderModal.jsx'
import './SearchPage.css'

const LOGO = 'https://res.cloudinary.com/dcabuupn1/image/upload/v1782615005/Logo_ECOMM_ttq36x.png'

const PRODUCT_IMAGES = {
  'Desk Lamp':          'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311154/Desk_Lamp_ppolpc.jpg',
  'Laptop Bag':         'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311161/Laptop_bag_uoh0gn.jpg',
  'Laptop Pro':         'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311169/Laptop_pro_e30xa9.jpg',
  'Mechanical Keyboard':'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311518/Mechanical_Keyboard_mq8nfq.jpg',
  'Monitor Stand':      'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311534/Monitor_stand_eodoyv.jpg',
  'USB-C Hub':          'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311526/USB_C_glfmfx.jpg',
  'Webcam HD':          'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311581/Webcam_HD_u7646u.jpg',
  'Wireless Mouse':     'https://res.cloudinary.com/dcabuupn1/image/upload/v1783311136/Wireless_Mouse_irwxil.jpg',
}

const IcoSearch  = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoUser = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="#9db4d6" strokeWidth="1.8"/>
    <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" stroke="#9db4d6" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoFilter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M6 12h12M9 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoBag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 7h14l-1.2 10.2A2 2 0 0 1 15.8 19H8.2a2 2 0 0 1-2-1.8L5 7z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M8.5 7a3.5 3.5 0 0 1 7 0" stroke="#fff" strokeWidth="1.8"/>
  </svg>
)
const IcoSimilar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="5" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M19 19l-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M11 8v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IcoCache = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IcoLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function SearchPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery]             = useState('')
  const [category, setCategory]       = useState('')
  const [minPrice, setMinPrice]       = useState('')
  const [maxPrice, setMaxPrice]       = useState('')
  const [categories, setCategories]   = useState([])
  const [results, setResults]         = useState(null)
  const [recs, setRecs]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [orderTarget, setOrderTarget] = useState(null)
  const [searched, setSearched]       = useState(false)

  useEffect(() => {
    getCategories().then(d => setCategories(d.categories || [])).catch(() => {})
  }, [])

  async function handleSearch(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    setRecs(null)
    setSearched(true)
    try {
      const params = {}
      if (query)    params.q         = query
      if (category) params.category  = category
      if (minPrice) params.min_price = minPrice
      if (maxPrice) params.max_price = maxPrice
      const data = await searchProducts(params)
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecommend(product) {
    setRecs(null)
    try {
      const data = await getRecommendations(product.id)
      setRecs({ product: data.product, list: data.recommendations })
    } catch (_) {}
    setOrderTarget(product)
  }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="sp-root">

      {/* ── Header ── */}
      <header className="sp-header">
        <a className="sp-brand" onClick={() => navigate('/')}>
          <img src={LOGO} alt="Logo" className="sp-brand-logo" />
        </a>

        <form className="sp-searchbar" onSubmit={handleSearch}>
          <IcoSearch />
          <input
            className="sp-searchbar-input"
            placeholder="Buscar productos, marcas, categorías…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="sp-clear" onClick={() => { setQuery(''); setResults(null); setSearched(false) }}>✕</button>
          )}
          <button type="submit" className="sp-search-btn">Buscar</button>
        </form>

        <div className="sp-spacer" />

        {user ? (
          <div className="sp-user-row">
            <span className="sp-user-name">{user.name}</span>
            <button className="sp-logout-btn" onClick={handleLogout}>
              <IcoLogout />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <button className="sp-icon-btn" onClick={() => navigate('/login')} title="Iniciar sesión"><IcoUser /></button>
        )}
      </header>

      {/* ── Nav ── */}
      <nav className="sp-nav">
        <a className="sp-nav-link" onClick={() => navigate('/')}>Inicio</a>
        <a className="sp-nav-link active">Categorías</a>
      </nav>

      {/* ── Main content ── */}
      <div className="sp-body">

        {/* ── Filters sidebar ── */}
        <aside className="sp-sidebar">
          <div className="sp-sidebar-title"><IcoFilter /> Filtros</div>

          <div className="sp-filter-group">
            <label className="sp-filter-label">Categoría</label>
            <select
              className="sp-filter-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>
          </div>

          <div className="sp-filter-group">
            <label className="sp-filter-label">Rango de precio</label>
            <div className="sp-price-range">
              <input
                className="sp-filter-input"
                type="number" placeholder="Mín $" min="0"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
              />
              <span className="sp-price-sep">–</span>
              <input
                className="sp-filter-input"
                type="number" placeholder="Máx $" min="0"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <button className="sp-filter-apply" onClick={handleSearch}>
            Aplicar filtros
          </button>

          {(category || minPrice || maxPrice) && (
            <button className="sp-filter-clear" onClick={() => {
              setCategory(''); setMinPrice(''); setMaxPrice('')
            }}>
              Limpiar filtros
            </button>
          )}
        </aside>

        {/* ── Results ── */}
        <section className="sp-results">
          {!searched && !loading && (
            <div className="sp-empty-state">
              <div className="sp-empty-icon"><IcoSearch /></div>
              <p className="sp-empty-title">Busca lo que necesitas</p>
              <p className="sp-empty-sub">Ingresa un término, filtra por categoría o rango de precio</p>
            </div>
          )}

          {loading && (
            <div className="sp-loading">
              <div className="sp-spinner" />
              <p>Buscando en el catálogo…</p>
            </div>
          )}

          {error && <div className="sp-error">{error}</div>}

          {results && !loading && (
            <>
              <div className="sp-results-meta">
                <span className="sp-results-count">
                  {results.total} resultado{results.total !== 1 ? 's' : ''}
                  {query ? ` para "${query}"` : ''}
                </span>
                <span className={`sp-cache-badge ${results.source === 'cache' ? 'sp-cache-hit' : 'sp-cache-miss'}`}>
                  <IcoCache />
                  {results.source === 'cache' ? 'Redis cache' : 'PostgreSQL'}
                </span>
              </div>

              {results.results.length === 0 ? (
                <div className="sp-no-results">
                  <p>No se encontraron productos.</p>
                  <p className="sp-empty-sub">Intenta con otros términos o elimina los filtros.</p>
                </div>
              ) : (
                <div className="sp-grid">
                  {results.results.map(p => (
                    <div key={p.id} className="sp-card">
                      <div className="sp-card-img">
                        {PRODUCT_IMAGES[p.name]
                          ? <img src={PRODUCT_IMAGES[p.name]} alt={p.name} className="sp-card-img-photo" />
                          : <span className="sp-card-img-label">product photo</span>
                        }
                        <span className="sp-card-cat">{p.category}</span>
                      </div>
                      <div className="sp-card-body">
                        <h3 className="sp-card-name">{p.name}</h3>
                        <p className="sp-card-desc">{p.description}</p>
                        <div className="sp-card-footer">
                          <span className="sp-card-price">${parseFloat(p.price).toFixed(2)}</span>
                          <div className="sp-card-actions">
                            <button
                              className="sp-btn-sim"
                              onClick={() => handleRecommend(p)}
                              title="Ver similares"
                            >
                              <IcoSimilar /> Similares
                            </button>
                            <button
                              className="sp-btn-buy"
                              disabled={p.stock === 0}
                              onClick={() => { if (user) setOrderTarget(p); else navigate('/login') }}
                            >
                              <IcoBag />
                            </button>
                          </div>
                        </div>
                        {p.stock <= 10 && p.stock > 0 && (
                          <p className="sp-stock-warn">Solo {p.stock} en stock</p>
                        )}
                        {p.stock === 0 && <p className="sp-stock-out">Agotado</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Recommendations ── */}
          {recs && recs.list.length > 0 && (
            <div className="sp-recs">
              <h3 className="sp-recs-title">Similares a "{recs.product?.name}"</h3>
              <div className="sp-recs-grid">
                {recs.list.map(p => (
                  <div key={p.id} className="sp-rec-card">
                    <span className="sp-card-cat" style={{ fontSize: '10px' }}>{p.category}</span>
                    <p className="sp-rec-name">{p.name}</p>
                    <div className="sp-rec-footer">
                      <span className="sp-card-price" style={{ fontSize: '15px' }}>${parseFloat(p.price).toFixed(2)}</span>
                      <button
                        className="sp-btn-buy"
                        disabled={p.stock === 0}
                        onClick={() => { if (user) setOrderTarget(p); else navigate('/login') }}
                      >
                        <IcoBag />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {orderTarget && (
        <OrderModal
          product={orderTarget}
          onClose={() => { setOrderTarget(null); setRecs(null) }}
        />
      )}
    </div>
  )
}
