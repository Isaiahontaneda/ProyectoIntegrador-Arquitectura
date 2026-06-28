'use strict';

require('dotenv').config();
const amqplib  = require('amqplib');
const nodemailer = require('nodemailer');

// ── Email transport (Ethereal – catches all emails, no real sending) ──
let transporter = null;

async function createTransport() {
  const account = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host:   'smtp.ethereal.email',
    port:   587,
    secure: false,
    auth:   { user: account.user, pass: account.pass },
  });
  console.log('[Mailer] Ethereal test account ready:', account.user);
}

async function sendEmail({ to, subject, html }) {
  if (!transporter) return;
  try {
    const info = await transporter.sendMail({
      from:    '"EcommStore" <noreply@ecommstore.local>',
      to, subject, html,
    });
    console.log(`[Mailer] Email sent → ${nodemailer.getTestMessageUrl(info)}`);
  } catch (e) {
    console.error('[Mailer] Send failed:', e.message);
  }
}

// ── Handlers ───────────────────────────────────────────────
async function handleOrderCreated(order) {
  console.log('[Notification] Order created:', JSON.stringify(order));
  await sendEmail({
    to:      order.customer_email || 'customer@example.com',
    subject: `Order #${order.id} confirmed – ${order.product_name}`,
    html: `
      <h2>Thank you for your order!</h2>
      <p>Order ID: <strong>#${order.id}</strong></p>
      <p>Product: <strong>${order.product_name}</strong></p>
      <p>Quantity: ${order.quantity}</p>
      <p>Total: <strong>$${order.total_price}</strong></p>
      <p>Status: ${order.status}</p>
    `,
  });
}

async function handleLowStockAlert(alert) {
  console.log('[Alert] Low stock:', JSON.stringify(alert));
  await sendEmail({
    to:      process.env.ADMIN_EMAIL || 'admin@ecommstore.local',
    subject: `[LOW STOCK] ${alert.product_name} – ${alert.remaining_stock} units left`,
    html: `
      <h2>Low Stock Alert</h2>
      <p>Product: <strong>${alert.product_name}</strong> (ID: ${alert.product_id})</p>
      <p>Remaining stock: <strong>${alert.remaining_stock}</strong></p>
      <p>Please restock as soon as possible.</p>
    `,
  });
}

// ── RabbitMQ consumer ─────────────────────────────────────
async function startConsumer(attempt = 1) {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const ch   = await conn.createChannel();
    ch.prefetch(5);

    await ch.assertQueue('order_created',   { durable: true });
    await ch.assertQueue('low_stock_alert', { durable: true });

    ch.consume('order_created', async (msg) => {
      if (!msg) return;
      try {
        await handleOrderCreated(JSON.parse(msg.content.toString()));
        ch.ack(msg);
      } catch (e) {
        console.error('[Consumer] order_created handler error:', e.message);
        ch.nack(msg, false, false);
      }
    });

    ch.consume('low_stock_alert', async (msg) => {
      if (!msg) return;
      try {
        await handleLowStockAlert(JSON.parse(msg.content.toString()));
        ch.ack(msg);
      } catch (e) {
        console.error('[Consumer] low_stock_alert handler error:', e.message);
        ch.nack(msg, false, false);
      }
    });

    console.log('[Notifications] Listening on queues: order_created, low_stock_alert');

    conn.on('close', () => {
      const delay = Math.min(attempt * 2000, 30000);
      console.warn(`[RabbitMQ] Connection closed. Retrying in ${delay}ms (attempt ${attempt})`);
      setTimeout(() => startConsumer(attempt + 1), delay);
    });

  } catch (e) {
    const delay = Math.min(attempt * 2000, 30000);
    console.error(`[RabbitMQ] ${e.message}. Retrying in ${delay}ms (attempt ${attempt})`);
    setTimeout(() => startConsumer(attempt + 1), delay);
  }
}

(async () => {
  await createTransport();
  await startConsumer();
})();
