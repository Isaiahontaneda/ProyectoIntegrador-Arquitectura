import './ProductCard.css'

export default function ProductCard({ product, onOrder }) {
  const stockBadge = product.stock === 0
    ? <span className="badge badge-red">Agotado</span>
    : product.stock <= 10
      ? <span className="badge badge-gray">Pocas unidades</span>
      : <span className="badge badge-green">En stock</span>

  return (
    <div className="product-card card">
      <div className="product-card__category tag">{product.category}</div>
      <h3 className="product-card__name">{product.name}</h3>
      {product.description && (
        <p className="product-card__desc text-muted">{product.description}</p>
      )}
      <div className="product-card__footer">
        <div>
          <div className="product-card__price">${parseFloat(product.price).toFixed(2)}</div>
          <div className="flex-center gap-1 mt-1">
            {stockBadge}
            <span className="text-muted text-sm">{product.stock} uds.</span>
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={product.stock === 0}
          onClick={() => onOrder(product)}
        >
          Ordenar
        </button>
      </div>
    </div>
  )
}
