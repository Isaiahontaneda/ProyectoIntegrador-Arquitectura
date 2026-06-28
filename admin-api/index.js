'use strict';

require('dotenv').config();
const express      = require('express');
const { Pool }     = require('pg');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());

// ── Prometheus metrics ─────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'admin_' });
const httpDuration = new promClient.Histogram({
  name: 'admin_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode }));
  next();
});

// ── PostgreSQL ─────────────────────────────────────────────
const pool = new Pool({
  host:                    process.env.DB_HOST     || 'localhost',
  port:                    process.env.DB_PORT     || 5432,
  user:                    process.env.DB_USER     || 'postgres',
  password:                process.env.DB_PASSWORD || 'postgres',
  database:                process.env.DB_NAME     || 'storedb',
  max:                     10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 3000,
});

// ── Swagger ────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Admin API',
      version:     '1.0.0',
      description: 'Internal administration API: inventory management and reporting',
    },
    servers: [
      { url: 'http://localhost:8000/admin', description: 'Via API Gateway (Kong)' },
      { url: 'http://localhost:3002',       description: 'Direct access'          },
    ],
    tags: [
      { name: 'Inventory', description: 'Stock and product management' },
      { name: 'Reports',   description: 'Business intelligence reports' },
      { name: 'Health',    description: 'Service health check'          },
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id:          { type: 'integer' },
            name:        { type: 'string'  },
            description: { type: 'string'  },
            category:    { type: 'string'  },
            price:       { type: 'number'  },
            stock:       { type: 'integer' },
            updated_at:  { type: 'string', format: 'date-time' },
          },
        },
        StockUpdate: {
          type: 'object',
          required: ['stock'],
          properties: {
            stock: { type: 'integer', minimum: 0 },
          },
        },
        OrderReport: {
          type: 'object',
          properties: {
            order_id:       { type: 'integer' },
            product_name:   { type: 'string'  },
            category:       { type: 'string'  },
            quantity:       { type: 'integer' },
            total_price:    { type: 'number'  },
            status:         { type: 'string'  },
            customer_email: { type: 'string'  },
            created_at:     { type: 'string', format: 'date-time' },
          },
        },
        SalesSummary: {
          type: 'object',
          properties: {
            category:      { type: 'string'  },
            total_orders:  { type: 'integer' },
            total_revenue: { type: 'number'  },
            avg_order:     { type: 'number'  },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  },
  apis: ['./index.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (_req, res) => res.json(swaggerSpec));

// ── Health ─────────────────────────────────────────────────
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Service health check
 *     responses:
 *       200:
 *         description: Service healthy
 *       503:
 *         description: Database unreachable
 */
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'admin-api', db: 'ok' });
  } catch (e) {
    res.status(503).json({ service: 'admin-api', db: 'error', detail: e.message });
  }
});

// ── Inventory ──────────────────────────────────────────────
/**
 * @openapi
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: List all products sorted by stock (lowest first)
 *     parameters:
 *       - in: query
 *         name: low_stock
 *         schema: { type: boolean }
 *         description: If true, return only products with stock <= 10
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Inventory list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 */
app.get('/inventory', async (req, res) => {
  try {
    const { low_stock, category } = req.query;
    const conditions = [];
    const params     = [];
    let pi = 1;
    if (low_stock === 'true') { conditions.push(`stock <= 10`); }
    if (category)             { conditions.push(`category = $${pi++}`); params.push(category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM products ${where} ORDER BY stock ASC`, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /inventory/{id}:
 *   put:
 *     tags: [Inventory]
 *     summary: Update product stock level
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StockUpdate' }
 *     responses:
 *       200:
 *         description: Stock updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Invalid stock value
 *       404:
 *         description: Product not found
 */
app.put('/inventory/:id', async (req, res) => {
  const { stock } = req.body;
  if (stock == null || stock < 0) return res.status(400).json({ error: 'stock must be >= 0' });
  try {
    const result = await pool.query(
      'UPDATE products SET stock=$1 WHERE id=$2 RETURNING *',
      [stock, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /inventory/{id}:
 *   patch:
 *     tags: [Inventory]
 *     summary: Update product details (price, description, category)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:       { type: number  }
 *               description: { type: string  }
 *               category:    { type: string  }
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Not found
 */
app.patch('/inventory/:id', async (req, res) => {
  const allowed = ['price', 'description', 'category', 'name'];
  const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields provided' });
  const sets   = fields.map((f, i) => `${f}=$${i + 1}`).join(', ');
  const values = fields.map(f => req.body[f]);
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE products SET ${sets} WHERE id=$${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reports ────────────────────────────────────────────────
/**
 * @openapi
 * /reports/orders:
 *   get:
 *     tags: [Reports]
 *     summary: Detailed order report joined with product data
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Order report
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/OrderReport' }
 */
app.get('/reports/orders', async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const conditions = [];
    const params     = [];
    let   pi         = 1;
    if (status) { conditions.push(`o.status=$${pi++}`); params.push(status); }
    if (from)   { conditions.push(`o.created_at >= $${pi++}`); params.push(from); }
    if (to)     { conditions.push(`o.created_at <= $${pi++}`); params.push(to + ' 23:59:59'); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT o.id as order_id, p.name as product_name, p.category, o.quantity,
              o.total_price, o.status, o.customer_email, o.created_at
       FROM orders o JOIN products p ON o.product_id=p.id
       ${where} ORDER BY o.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /reports/sales:
 *   get:
 *     tags: [Reports]
 *     summary: Sales summary grouped by category
 *     responses:
 *       200:
 *         description: Sales summary
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/SalesSummary' }
 */
app.get('/reports/sales', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.category,
             COUNT(o.id)::int        AS total_orders,
             COALESCE(SUM(o.total_price), 0)::numeric(10,2) AS total_revenue,
             COALESCE(AVG(o.total_price), 0)::numeric(10,2) AS avg_order
      FROM products p
      LEFT JOIN orders o ON o.product_id = p.id
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /reports/low-stock:
 *   get:
 *     tags: [Reports]
 *     summary: Products with stock at or below threshold
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Low-stock products
 */
app.get('/reports/low-stock', async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10;
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE stock <= $1 ORDER BY stock ASC',
      [threshold]
    );
    res.json({ threshold, count: result.rows.length, products: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`[admin-api] running on port ${PORT}`));
