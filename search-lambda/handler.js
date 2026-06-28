'use strict';

const { Pool } = require('pg');
const Redis = require('ioredis');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'storedb',
  max: 5,
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (t) => Math.min(t * 100, 3000),
});

redis.on('error', (e) => console.error('[Redis]', e.message));

function ok(body, extra = {}) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...extra };
}
function err(code, message) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

/**
 * Lambda handler: full-text product search
 * Event shape: { queryStringParameters: { q, category, min_price, max_price, page, limit } }
 */
exports.searchProducts = async (event, context) => {
  const q          = event.queryStringParameters?.q        || '';
  const category   = event.queryStringParameters?.category || '';
  const minPrice   = parseFloat(event.queryStringParameters?.min_price) || 0;
  const maxPrice   = parseFloat(event.queryStringParameters?.max_price) || 9999999;
  const page       = Math.max(1, parseInt(event.queryStringParameters?.page)  || 1);
  const limit      = Math.min(50, parseInt(event.queryStringParameters?.limit) || 10);
  const offset     = (page - 1) * limit;

  const cacheKey = `search:${q}:${category}:${minPrice}:${maxPrice}:${page}:${limit}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return ok({ source: 'cache', ...JSON.parse(cached) });
    }
  } catch (_) {}

  try {
    const conditions = ['price BETWEEN $1 AND $2'];
    const params     = [minPrice, maxPrice];
    let   pi         = 3;

    if (q) {
      conditions.push(`to_tsvector('english', name || ' ' || COALESCE(description,'')) @@ plainto_tsquery('english', $${pi})`);
      params.push(q);
      pi++;
    }
    if (category) {
      conditions.push(`category = $${pi}`);
      params.push(category);
      pi++;
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(`SELECT COUNT(*) FROM products WHERE ${where}`, params);
    const total    = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM products WHERE ${where} ORDER BY name LIMIT $${pi} OFFSET $${pi + 1}`,
      params
    );

    const payload = { total, page, limit, pages: Math.ceil(total / limit), results: dataRes.rows };
    try { await redis.setex(cacheKey, 120, JSON.stringify(payload)); } catch (_) {}

    return ok({ source: 'db', ...payload });
  } catch (e) {
    console.error('[searchProducts]', e.message);
    return err(500, e.message);
  }
};

/**
 * Lambda handler: product recommendations (same category, excluding self)
 * Event shape: { pathParameters: { id } }
 */
exports.getRecommendations = async (event, context) => {
  const productId = parseInt(event.pathParameters?.id);
  if (!productId || isNaN(productId)) return err(400, 'Invalid product id');

  const cacheKey = `recommendations:${productId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return ok({ source: 'cache', recommendations: JSON.parse(cached) });
  } catch (_) {}

  try {
    const prodRes = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) return err(404, 'Product not found');

    const product = prodRes.rows[0];
    const recRes  = await pool.query(
      'SELECT * FROM products WHERE category = $1 AND id != $2 ORDER BY stock DESC LIMIT 5',
      [product.category, productId]
    );

    try { await redis.setex(cacheKey, 300, JSON.stringify(recRes.rows)); } catch (_) {}

    return ok({ source: 'db', product, recommendations: recRes.rows });
  } catch (e) {
    console.error('[getRecommendations]', e.message);
    return err(500, e.message);
  }
};

/**
 * Lambda handler: list product categories with counts
 */
exports.getCategories = async (event, context) => {
  const cacheKey = 'categories:all';
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return ok({ source: 'cache', categories: JSON.parse(cached) });
  } catch (_) {}

  try {
    const res = await pool.query(
      'SELECT category, COUNT(*) as product_count, MIN(price) as min_price, MAX(price) as max_price FROM products GROUP BY category ORDER BY category'
    );
    try { await redis.setex(cacheKey, 300, JSON.stringify(res.rows)); } catch (_) {}
    return ok({ source: 'db', categories: res.rows });
  } catch (e) {
    return err(500, e.message);
  }
};
