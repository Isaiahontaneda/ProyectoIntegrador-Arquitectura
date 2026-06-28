const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ── Storefront ─────────────────────────────────────────────
export const getProducts    = (category) => request('/store/products' + (category ? `?category=${category}` : ''))
export const getProduct     = (id)       => request(`/store/products/${id}`)
export const createProduct  = (body)     => request('/store/products', { method: 'POST', body: JSON.stringify(body) })
export const placeOrder     = (body)     => request('/store/orders',   { method: 'POST', body: JSON.stringify(body) })
export const getOrders      = (status)   => request('/store/orders'  + (status ? `?status=${status}` : ''))

// ── Search Lambda ──────────────────────────────────────────
export const searchProducts      = (params) => request('/search/search?'      + new URLSearchParams(params))
export const getRecommendations  = (id)     => request(`/search/recommendations/${id}`)
export const getCategories       = ()       => request('/search/categories')

// ── Admin ──────────────────────────────────────────────────
export const getInventory   = (params = {}) => request('/admin/inventory?' + new URLSearchParams(params))
export const updateStock    = (id, stock)   => request(`/admin/inventory/${id}`, { method: 'PUT',   body: JSON.stringify({ stock }) })
export const updateProduct  = (id, body)    => request(`/admin/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const getOrderReport = (params = {}) => request('/admin/reports/orders?' + new URLSearchParams(params))
export const getSalesReport = ()            => request('/admin/reports/sales')
export const getLowStock    = (threshold)   => request(`/admin/reports/low-stock?threshold=${threshold || 10}`)
