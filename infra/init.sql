-- ============================================================
-- Schema: storedb
-- ============================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  category     VARCHAR(100) NOT NULL DEFAULT 'general',
  price        DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                 SERIAL PRIMARY KEY,
  product_id         INTEGER REFERENCES products(id),
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  status             VARCHAR(50) NOT NULL DEFAULT 'pending',
  customer_email     VARCHAR(255),
  total_price        DECIMAL(10,2),
  payment_intent_id  VARCHAR(120),
  payment_status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method     VARCHAR(100),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification audit log
CREATE TABLE IF NOT EXISTS notification_log (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER REFERENCES orders(id),
  customer_email VARCHAR(255),
  type           VARCHAR(50) NOT NULL,
  status         VARCHAR(50) NOT NULL DEFAULT 'sent',
  payload        JSONB,
  sent_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_product_id  ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer     ON orders(customer_email);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_stock      ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price      ON products(price);

-- Full-text search index (supports /search endpoint)
CREATE INDEX IF NOT EXISTS idx_products_fts ON products
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Notification log
CREATE INDEX IF NOT EXISTS idx_notif_order_id  ON notification_log(order_id);
CREATE INDEX IF NOT EXISTS idx_notif_type      ON notification_log(type);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migrations (idempotent — safe to run on existing DBs)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status    VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(100);

-- ============================================================
-- Seed data
-- ============================================================

INSERT INTO products (name, description, category, price, stock) VALUES
  ('Laptop Pro',           'High-performance laptop for professionals',       'electronics',  1299.99,  50),
  ('Wireless Mouse',       'Ergonomic wireless mouse with long battery life', 'electronics',    29.99, 200),
  ('Mechanical Keyboard',  'RGB mechanical keyboard with tactile switches',   'electronics',    89.99, 150),
  ('USB-C Hub',            '7-in-1 USB-C hub with HDMI and power delivery',  'electronics',    49.99,  80),
  ('Monitor Stand',        'Adjustable monitor stand with USB ports',         'accessories',    39.99,  60),
  ('Laptop Bag',           'Waterproof laptop bag with multiple compartments','accessories',    59.99, 100),
  ('Webcam HD',            '1080p HD webcam with built-in microphone',        'electronics',    79.99,  40),
  ('Desk Lamp',            'LED desk lamp with adjustable brightness',        'accessories',    24.99,   8)
ON CONFLICT DO NOTHING;
