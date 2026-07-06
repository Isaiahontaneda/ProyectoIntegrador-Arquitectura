import { useState, useEffect, useCallback } from 'react'
import { getInventory, updateStock, getOrderReport, getSalesReport, getLowStock } from '../api/client.js'
import './AdminPage.css'

// ─── Nav icons ───────────────────────────────────────
const IcoDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IcoInventory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)
const IcoOrders = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)
const IcoProducts = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IcoClients = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  Icon: IcoDashboard  },
  { id: 'inventory', label: 'Inventario', Icon: IcoInventory  },
  { id: 'orders',    label: 'Órdenes',    Icon: IcoOrders     },
  { id: 'products',  label: 'Productos',  Icon: IcoProducts   },
]

// ─── Main ────────────────────────────────────────────
export default function AdminPage() {
  const [section, setSection] = useState('dashboard')

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-label">Menú</div>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`admin-nav-item${section === id ? ' active' : ''}`}
            onClick={() => setSection(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </aside>

      <main className="admin-main">
        {section === 'dashboard'  && <DashboardSection />}
        {section === 'inventory'  && <InventorySection />}
        {section === 'orders'     && <OrdersSection />}
        {section === 'products'   && <ProductsSection />}
      </main>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────
function DashboardSection() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSalesReport()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="admin-spinner" />

  const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0)
  const totalOrders  = rows.reduce((s, r) => s + parseInt(r.total_orders   || 0), 0)
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <>
      <h2 className="admin-page-title">Dashboard</h2>
      <div className="admin-kpi-row">
        <div className="admin-kpi">
          <div className="admin-kpi-label">Ingresos totales</div>
          <div className="admin-kpi-value accent">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Total de órdenes</div>
          <div className="admin-kpi-value">{totalOrders}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Categorías activas</div>
          <div className="admin-kpi-value green">{rows.length}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Ticket promedio</div>
          <div className="admin-kpi-value amber">${avgOrder.toFixed(2)}</div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Órdenes</th>
                <th>Ingresos</th>
                <th>Promedio orden</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.category}>
                  <td><span className="a-tag">{r.category}</span></td>
                  <td>{r.total_orders}</td>
                  <td>${parseFloat(r.total_revenue).toFixed(2)}</td>
                  <td>${parseFloat(r.avg_order).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="admin-empty">Sin datos de ventas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Inventory ───────────────────────────────────────
function InventorySection() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState({})
  const [msg, setMsg]       = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getInventory()
      .then(setRows)
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function saveStock(id) {
    const stock = parseInt(editing[id])
    if (isNaN(stock) || stock < 0) return
    try {
      await updateStock(id, stock)
      setMsg({ type: 'success', text: `Stock de #${id} actualizado a ${stock}` })
      setEditing(e => { const n = { ...e }; delete n[id]; return n })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  if (loading) return <div className="admin-spinner" />

  return (
    <>
      <h2 className="admin-page-title">Inventario</h2>
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>{msg.text}</div>
      )}
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td><span className="a-tag">{r.category}</span></td>
                  <td>${parseFloat(r.price).toFixed(2)}</td>
                  <td>
                    {r.id in editing
                      ? <input
                          type="number" min="0" value={editing[r.id]}
                          onChange={e => setEditing(ed => ({ ...ed, [r.id]: e.target.value }))}
                          className="admin-input-sm"
                        />
                      : <span className={r.stock <= 10 ? 'a-badge a-badge-red' : 'a-badge a-badge-green'}>
                          {r.stock}
                        </span>
                    }
                  </td>
                  <td style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                    {r.id in editing ? (
                      <>
                        <button className="admin-btn-primary" onClick={() => saveStock(r.id)}>Guardar</button>
                        <button className="admin-btn-outline" onClick={() => setEditing(e => { const n = { ...e }; delete n[r.id]; return n })}>Cancelar</button>
                      </>
                    ) : (
                      <button className="admin-btn-outline" onClick={() => setEditing(e => ({ ...e, [r.id]: r.stock }))}>Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Orders ──────────────────────────────────────────
const STATUS_BADGE = {
  pending:   'a-badge a-badge-gray',
  confirmed: 'a-badge a-badge-blue',
  shipped:   'a-badge a-badge-blue',
  delivered: 'a-badge a-badge-green',
  cancelled: 'a-badge a-badge-red',
}

function OrdersSection() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    getOrderReport(status ? { status } : {})
      .then(setRows)
      .finally(() => setLoading(false))
  }, [status])

  if (loading) return <div className="admin-spinner" />

  return (
    <>
      <h2 className="admin-page-title">Órdenes</h2>
      <div className="admin-controls">
        <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {['pending','confirmed','shipped','delivered','cancelled'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span style={{ fontSize: '.82rem', color: '#4a6080' }}>{rows.length} resultados</span>
      </div>
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Producto</th><th>Categoría</th><th>Cant.</th><th>Total</th><th>Estado</th><th>Cliente</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.order_id}>
                  <td>{r.order_id}</td>
                  <td>{r.product_name}</td>
                  <td><span className="a-tag">{r.category}</span></td>
                  <td>{r.quantity}</td>
                  <td>${parseFloat(r.total_price || 0).toFixed(2)}</td>
                  <td><span className={STATUS_BADGE[r.status] || 'a-badge a-badge-gray'}>{r.status}</span></td>
                  <td style={{ color: '#4a6080', fontSize: '.8rem' }}>{r.customer_email || '—'}</td>
                  <td style={{ color: '#4a6080', fontSize: '.8rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="admin-empty">Sin órdenes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Products (low stock focus) ───────────────────────
function ProductsSection() {
  const [data, setData]         = useState(null)
  const [threshold, setThreshold] = useState(10)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    getLowStock(threshold)
      .then(setData)
      .finally(() => setLoading(false))
  }, [threshold])

  if (loading) return <div className="admin-spinner" />

  return (
    <>
      <h2 className="admin-page-title">Productos</h2>
      <div className="admin-controls">
        <label style={{ fontSize: '.82rem', color: '#7a95b8', fontWeight: 600 }}>Stock crítico menor a:</label>
        <input
          type="number" min="1" value={threshold}
          onChange={e => setThreshold(parseInt(e.target.value) || 10)}
          className="admin-input-sm"
        />
        {data && (
          <span className="a-badge a-badge-red">{data.count} producto{data.count !== 1 ? 's' : ''} crítico{data.count !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="admin-product-grid">
        {data?.products.map(p => (
          <div key={p.id} className="admin-product-card">
            <span className="a-tag">{p.category}</span>
            <p className="admin-product-name">{p.name}</p>
            <p className="admin-product-desc">{p.description}</p>
            <p className="admin-product-stock">{p.stock} uds.</p>
          </div>
        ))}
        {data?.products.length === 0 && (
          <p style={{ color: '#2a3d55', fontSize: '.85rem' }}>No hay productos con stock bajo.</p>
        )}
      </div>
    </>
  )
}

