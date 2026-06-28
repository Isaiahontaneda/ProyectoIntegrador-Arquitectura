'use strict';

/**
 * Payment Gateway module — mock implementation for development/demo.
 * Interface mirrors the Stripe API (createPaymentIntent / confirmPaymentIntent).
 *
 * To switch to real Stripe:
 *   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 *   module.exports = stripe.paymentIntents;
 *
 * Test payment methods:
 *   tok_visa             → always succeeds
 *   tok_chargeDeclined   → always declines
 *   tok_insufficientFunds→ insufficient funds error
 */

const DECLINE_CODES = {
  tok_chargeDeclined:      { code: 'card_declined',        message: 'Your card was declined.' },
  tok_insufficientFunds:   { code: 'insufficient_funds',   message: 'Your card has insufficient funds.' },
  '4000000000000002':      { code: 'card_declined',        message: 'Your card was declined.' },
  '4000000000009995':      { code: 'insufficient_funds',   message: 'Your card has insufficient funds.' },
};

function generatePaymentIntentId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `pi_mock_${ts}_${rnd}`;
}

/**
 * Create and immediately confirm a payment intent.
 * @param {{ amount: number, currency?: string, payment_method_id?: string, metadata?: object }} opts
 * @returns {Promise<{ id: string, status: string, amount: number, currency: string, payment_method: string }>}
 */
async function createPaymentIntent({ amount, currency = 'usd', payment_method_id = 'tok_visa', metadata = {} }) {
  // Simulate Stripe network latency (80-180ms)
  await new Promise(r => setTimeout(r, 80 + Math.random() * 100));

  const decline = DECLINE_CODES[payment_method_id];
  if (decline) {
    const err = new Error(decline.message);
    err.code = decline.code;
    err.type = 'StripeCardError';
    err.statusCode = 402;
    throw err;
  }

  return {
    id:             generatePaymentIntentId(),
    object:         'payment_intent',
    amount,
    currency,
    status:         'succeeded',
    payment_method: payment_method_id,
    metadata,
    created:        Math.floor(Date.now() / 1000),
    livemode:       false,
  };
}

module.exports = { createPaymentIntent };
