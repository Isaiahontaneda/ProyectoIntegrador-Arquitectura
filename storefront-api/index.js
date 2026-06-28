'use strict';

require('dotenv').config();
const express      = require('express');
const { Pool }     = require('pg');
const amqplib      = require('amqplib');
const Redis        = require('ioredis');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const payment      = require('./payment');

const app = express();
app.use(express.json());

// ── Prometheus metrics ─────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'storefront_' });
const httpDuration = new promClient.Histogram({
  name: 'storefront_http_request_duration_seconds',
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
  host:                 process.env.DB_HOST     || 'localhost',
  port:                 process.env.DB_PORT     || 5432,
  user:                 process.env.DB_USER     || 'postgres',
  password:             process.env.DB_PASSWORD || 'postgres',
  database:             process.env.DB_NAME     || 'storedb',
  max:                  10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 3000,
});

// ── Redis ──────────────────────────────────────────────────
const redis = new Redis({
  host:          process.env.REDIS_HOST || 'localhost',
  port:          process.env.REDIS_PORT || 6379,
  retryStrategy: (t) => Math.min(t * 100, 3000),
  lazyConnect:   true,
});
redis.on('error', (e) => console.error('[Redis]', e.message));
redis.connect().catch(() => {});

// ── RabbitMQ – persistent connection ──────────────────────
let rabbitChannel = null;
async function connectRabbit(attempt = 1) {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const ch   = await conn.createChannel();
    await ch.assertQueue('order_created',   { durable: true });
    await ch.assertQueue('low_stock_alert', { durable: true });
    rabbitChannel = ch;
    console.log('[RabbitMQ] connected');
    conn.on('close', () => {
      rabbitChannel = null;
      const delay = Math.min(attempt * 1000, 15000);
      console.warn(`[RabbitMQ] connection closed, retrying in ${delay}ms`);
      setTimeout(() => connectRabbit(attempt + 1), delay);
    });
  } catch (e) {
    const delay = Math.min(attempt * 1000, 15000);
    console.error(`[RabbitMQ] ${e.message}, retrying in ${delay}ms`);
    setTimeout(() => connectRabbit(attempt + 1), delay);
  }
}
connectRabbit();

// ── Swagger ────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Storefront API',
      version:     '1.0.0',
      description: 'Customer-facing API: product catalog and order placement',
    },
    servers: [
      { url: 'http://localhost:8000/store', description: 'Via API Gateway (Kong)' },
      { url: 'http://localhost:3001',       description: 'Direct access'          },
    ],
    tags: [
      { name: 'Products', description: 'Product catalog'       },
      { name: 'Orders',   description: 'Order management'      },
      { name: 'Health',   description: 'Service health checks' },
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1          },
            name:        { type: 'string',  example: 'Laptop Pro' },
            description: { type: 'string'  },
            category:    { type: 'string',  example: 'electronics' },
            price:       { type: 'number',  example: 1299.99    },
            stock:       { type: 'integer', example: 50         },
            created_at:  { type: 'string',  format: 'date-time' },
          },
        },
        ProductInput: {
          type: 'object',
          required: ['name', 'price'],
          properties: {
            name:        { type: 'string'  },
            description: { type: 'string'  },
            category:    { type: 'string', default: 'general' },
            price:       { type: 'number'  },
            stock:       { type: 'integer', default: 0 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id:                { type: 'integer' },
            product_id:        { type: 'integer' },
            quantity:          { type: 'integer' },
            status:            { type: 'string'  },
            customer_email:    { type: 'string'  },
            total_price:       { type: 'number'  },
            payment_intent_id: { type: 'string', example: 'pi_mock_abc123_def456' },
            payment_status:    { type: 'string', example: 'succeeded', enum: ['pending','succeeded','failed'] },
            payment_method:    { type: 'string', example: 'tok_visa' },
            created_at:        { type: 'string', format: 'date-time' },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['product_id', 'quantity'],
          properties: {
            product_id:        { type: 'integer', example: 1 },
            quantity:          { type: 'integer', example: 2 },
            customer_email:    { type: 'string',  example: 'cliente@email.com' },
            payment_method_id: {
              type: 'string',
              example: 'tok_visa',
              description: 'Payment method token. Use tok_visa (success), tok_chargeDeclined (failure)',
            },
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
 *         description: All dependencies healthy
 *       503:
 *         description: One or more dependencies degraded
 */
app.get('/health', async (_req, res) => {
  const status = { service: 'storefront-api', db: 'unknown', redis: 'unknown', rabbitmq: 'unknown' };
  try { await pool.query('SELECT 1'); status.db = 'ok'; }       catch { status.db = 'error'; }
  try { await redis.ping();           status.redis = 'ok'; }    catch { status.redis = 'error'; }
  status.rabbitmq = rabbitChannel ? 'ok' : 'error';
  const healthy = ['db', 'redis', 'rabbitmq'].every(k => status[k] === 'ok');
  res.status(healthy ? 200 : 503).json(status);
});

// ── Products ───────────────────────────────────────────────
/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List all products (Redis cached, TTL 60s)
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Product list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/products', async (req, res) => {
  const { category } = req.query;
  const cacheKey = `products:${category || 'all'}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(JSON.parse(cached));
  } catch (_) {}
  try {
    const sql    = category ? 'SELECT * FROM products WHERE category=$1 ORDER BY name' : 'SELECT * FROM products ORDER BY name';
    const result = await pool.query(sql, category ? [category] : []);
    try { await redis.setex(cacheKey, 60, JSON.stringify(result.rows)); } catch (_) {}
    res.set('X-Cache', 'MISS').json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a single product by ID (Redis cached, TTL 120s)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Not found
 */
app.get('/products/:id', async (req, res) => {
  const cacheKey = `product:${req.params.id}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(JSON.parse(cached));
  } catch (_) {}
  try {
    const result = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    try { await redis.setex(cacheKey, 120, JSON.stringify(result.rows[0])); } catch (_) {}
    res.set('X-Cache', 'MISS').json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductInput' }
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Validation error
 */
app.post('/products', async (req, res) => {
  const { name, description, category, price, stock } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price are required' });
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, category, price, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description || null, category || 'general', price, stock || 0]
    );
    try {
      await redis.del('products:all');
      await redis.del(`products:${category || 'general'}`);
    } catch (_) {}
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Orders ─────────────────────────────────────────────────
/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order — processes payment via Payment Gateway then creates order
 *     description: |
 *       Flow: validate stock → call Payment Gateway (Stripe) → atomic stock deduction → publish RabbitMQ events.
 *       Test payment methods: `tok_visa` (success), `tok_chargeDeclined` (card declined), `tok_insufficientFunds` (insufficient funds).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderInput' }
 *           example:
 *             product_id: 1
 *             quantity: 2
 *             customer_email: "cliente@email.com"
 *             payment_method_id: "tok_visa"
 *     responses:
 *       201:
 *         description: Order placed and payment confirmed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       400:
 *         description: Insufficient stock or payment declined
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:         { type: string }
 *                 payment_code:  { type: string }
 *       404:
 *         description: Product not found
 */
app.post('/orders', async (req, res) => {
  const { product_id, quantity, customer_email, payment_method_id = 'tok_visa' } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity are required' });
  if (quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });

  // ── Step 1: pre-check stock before charging card ──
  let preProduct;
  try {
    const preRes = await pool.query('SELECT price, stock FROM products WHERE id=$1', [product_id]);
    if (!preRes.rows.length) return res.status(404).json({ error: 'Product not found' });
    preProduct = preRes.rows[0];
    if (preProduct.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock', available: preProduct.stock });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // ── Step 2: process payment via Payment Gateway (Stripe) ──
  const charge_amount = parseFloat((preProduct.price * quantity).toFixed(2));
  let paymentIntent;
  try {
    paymentIntent = await payment.createPaymentIntent({
      amount:            Math.round(charge_amount * 100), // Stripe uses cents
      currency:          'usd',
      payment_method_id,
      metadata:          { product_id: String(product_id), quantity: String(quantity), customer_email: customer_email || '' },
    });
  } catch (payErr) {
    return res.status(402).json({
      error:        payErr.message,
      payment_code: payErr.code || 'payment_failed',
    });
  }

  // ── Step 3: atomic stock deduction + order creation (row-level lock) ──
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prodRes = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [product_id]);
    if (!prodRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = prodRes.rows[0];
    if (product.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock', available: product.stock });
    }

    const total = parseFloat((product.price * quantity).toFixed(2));
    await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [quantity, product_id]);
    const orderRes = await client.query(
      `INSERT INTO orders
         (product_id, quantity, status, customer_email, total_price,
          payment_intent_id, payment_status, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [product_id, quantity, 'completed', customer_email || null, total,
       paymentIntent.id, paymentIntent.status, payment_method_id]
    );
    const order = orderRes.rows[0];
    await client.query('COMMIT');

    // Invalidate cache
    try {
      await redis.del('products:all');
      await redis.del(`product:${product_id}`);
      await redis.del(`products:${product.category}`);
    } catch (_) {}

    // Publish events
    if (rabbitChannel) {
      const event = { ...order, product_name: product.name, product_price: product.price };
      rabbitChannel.sendToQueue('order_created', Buffer.from(JSON.stringify(event)), { persistent: true });
      const newStock = product.stock - quantity;
      if (newStock <= 10) {
        rabbitChannel.sendToQueue('low_stock_alert', Buffer.from(JSON.stringify({
          product_id, product_name: product.name, remaining_stock: newStock,
        })), { persistent: true });
      }
    }

    res.status(201).json(order);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, shipped, delivered, cancelled] }
 *     responses:
 *       200:
 *         description: Order list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Order' }
 */
app.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const sql    = status ? 'SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC' : 'SELECT * FROM orders ORDER BY created_at DESC';
    const result = await pool.query(sql, status ? [status] : []);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID (includes product name)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order detail
 *       404:
 *         description: Not found
 */
app.get('/orders/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT o.*, p.name as product_name, p.category FROM orders o JOIN products p ON o.product_id=p.id WHERE o.id=$1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[storefront-api] running on port ${PORT}`));
