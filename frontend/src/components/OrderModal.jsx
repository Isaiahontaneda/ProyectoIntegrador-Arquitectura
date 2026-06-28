import { useState } from 'react'
import { placeOrder } from '../api/client.js'

const TEST_CARDS = [
  { label: 'Visa •••• 4242  (aprobada)',            value: 'tok_visa'             },
  { label: 'Mastercard •••• 5555  (aprobada)',       value: 'tok_mastercard'       },
  { label: 'Tarjeta declinada',                      value: 'tok_chargeDeclined'   },
  { label: 'Fondos insuficientes',                   value: 'tok_insufficientFunds'},
]

const IcoCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.8"/>
    <path d="M7 12l3.5 3.5 6.5-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IcoCard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7"/>
  </svg>
)

export default function OrderModal({ product, onClose }) {
  const [quantity, setQuantity]     = useState(1)
  const [email, setEmail]           = useState('')
  const [cardToken, setCardToken]   = useState('tok_visa')
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(null)
  const [error, setError]           = useState(null)

  const total = (product.price * quantity).toFixed(2)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const order = await placeOrder({
        product_id:        product.id,
        quantity,
        customer_email:    email || undefined,
        payment_method_id: cardToken,
      })
      setSuccess(order)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {success ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <IcoCheck />
              <h3 style={{ margin: 0 }}>Pago exitoso</h3>
            </div>
            <p className="mb-1">Orden <strong>#{success.id}</strong> confirmada.</p>
            <p className="text-muted mb-1">Producto: <strong>{product.name}</strong></p>
            <p className="text-muted mb-1">Total cobrado: <strong>${parseFloat(success.total_price).toFixed(2)}</strong></p>
            {success.payment_intent_id && (
              <p className="text-muted mb-2" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                Payment ID: <code style={{ color: '#10b981' }}>{success.payment_intent_id}</code>
              </p>
            )}
            {email && <p className="text-muted mb-2" style={{ fontSize: '12.5px' }}>Confirmación enviada a <strong>{email}</strong></p>}
            <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>Cerrar</button>
          </>
        ) : (
          <>
            <h3>Ordenar: {product.name}</h3>
            <p className="text-muted mb-2">Precio unitario: <strong>${parseFloat(product.price).toFixed(2)}</strong></p>
            {error && <div className="alert alert-error mb-2">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <label className="text-sm font-bold mb-1" style={{ display: 'block' }}>Cantidad</label>
                <input
                  type="number" min={1} max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="text-sm font-bold mb-1" style={{ display: 'block' }}>Email (recibe confirmación)</label>
                <input
                  type="email" placeholder="cliente@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="mb-2">
                <label className="text-sm font-bold mb-1" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IcoCard /> Método de pago
                </label>
                <select value={cardToken} onChange={(e) => setCardToken(e.target.value)}>
                  {TEST_CARDS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
                <span className="text-muted text-sm">Total a cobrar</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#4d9fff' }}>${total}</span>
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Procesando pago...' : `Pagar $${total}`}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
