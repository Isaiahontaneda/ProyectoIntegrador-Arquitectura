'use strict';

require('dotenv').config();
const express      = require('express');
const crypto       = require('crypto');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const handler      = require('./handler');

const app = express();
app.use(express.json());

// ── Prometheus metrics ─────────────────────────────────────
const promClient = require('prom-client');
promClient.collectDefaultMetrics({ prefix: 'search_' });
const httpDuration = new promClient.Histogram({
  name: 'search_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode }));
  next();
});

// ── Lambda adapter ──────────────────────────────────────────
function buildEvent(req) {
  return {
    httpMethod:            req.method,
    path:                  req.path,
    queryStringParameters: req.query   || {},
    pathParameters:        req.params  || {},
    headers:               req.headers || {},
    body:                  req.body ? JSON.stringify(req.body) : null,
    requestContext: {
      requestId:    crypto.randomUUID(),
      functionName: 'ecommerce-search',
    },
  };
}

function buildContext(fnName) {
  return {
    functionName:    fnName,
    awsRequestId:    crypto.randomUUID(),
    invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${fnName}`,
    getRemainingTimeInMillis: () => 30000,
  };
}

async function invoke(handlerFn, req, res) {
  const event   = buildEvent(req);
  const context = buildContext(handlerFn.name || 'lambda');
  try {
    const result = await handlerFn(event, context);
    res.status(result.statusCode).set(result.headers || {}).send(result.body);
  } catch (e) {
    console.error('[Lambda invoke error]', e.message);
    res.status(500).json({ error: 'Internal Lambda error' });
  }
}

// ── Swagger ────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Search Lambda API',
      version:     '1.0.0',
      description: 'Serverless-style search and recommendations service (Lambda handler pattern)',
    },
    servers: [
      { url: 'http://localhost:8000/search', description: 'Via API Gateway' },
      { url: 'http://localhost:3003',        description: 'Direct access'   },
    ],
    tags: [
      { name: 'Search',          description: 'Product search with full-text and filters' },
      { name: 'Recommendations', description: 'Product recommendations engine'            },
      { name: 'Categories',      description: 'Product category listing'                  },
      { name: 'Health',          description: 'Service health'                            },
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
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            source:  { type: 'string', enum: ['cache', 'db'] },
            total:   { type: 'integer' },
            page:    { type: 'integer' },
            limit:   { type: 'integer' },
            pages:   { type: 'integer' },
            results: { type: 'array', items: { '$ref': '#/components/schemas/Product' } },
          },
        },
      },
    },
  },
  apis: ['./server.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (_req, res) => res.json(swaggerSpec));

// ── Routes (HTTP trigger → Lambda handler) ─────────────────

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (_req, res) => res.json({ service: 'search-lambda', status: 'ok' }));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Full-text product search with filters
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search term (full-text)
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: min_price
 *         schema: { type: number }
 *       - in: query
 *         name: max_price
 *         schema: { type: number }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResult'
 */
app.get('/search', (req, res) => invoke(handler.searchProducts, req, res));

/**
 * @openapi
 * /recommendations/{id}:
 *   get:
 *     tags: [Recommendations]
 *     summary: Get related product recommendations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Source product ID
 *     responses:
 *       200:
 *         description: Recommendations list
 *       404:
 *         description: Product not found
 */
app.get('/recommendations/:id', (req, res) => invoke(handler.getRecommendations, req, res));

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories with product counts and price range
 *     responses:
 *       200:
 *         description: Category list
 */
app.get('/categories', (req, res) => invoke(handler.getCategories, req, res));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`search-lambda running on port ${PORT}`));
