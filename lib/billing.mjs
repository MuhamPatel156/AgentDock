import {createHmac, timingSafeEqual, randomBytes, randomUUID} from 'node:crypto';
import {setBudgetCaps} from './budgets.mjs';

export const PLANS = {
 free: {
  id: 'free',
  name: 'Community Free',
  price_cents: 0,
  currency: 'usd',
  features: {
   daily_tokens: 12000,
   monthly_tokens: 100000,
   max_containers: 1,
   storage_mb: 20,
   github_sync: false,
   custom_domains: false
  }
 },
 pro: {
  id: 'pro',
  name: 'Professional Developer',
  price_cents: 2900, // $29.00 / month
  currency: 'usd',
  features: {
   daily_tokens: 100000,
   monthly_tokens: 2000000,
   max_containers: 4,
   storage_mb: 200,
   github_sync: true,
   custom_domains: true
  }
 },
 team: {
  id: 'team',
  name: 'Team / Organization',
  price_cents: 9900, // $99.00 / month
  currency: 'usd',
  features: {
   daily_tokens: 500000,
   monthly_tokens: 10000000,
   max_containers: 10,
   storage_mb: 1000,
   github_sync: true,
   custom_domains: true
  }
 }
};

export function getCustomer(store, userId) {
 return store.db.prepare('SELECT * FROM billing_customers WHERE user_id=?').get(userId) || null;
}

export function ensureCustomer(store, userId, {billingEmail = null} = {}) {
 const existing = getCustomer(store, userId);
 if (existing) return existing;

 const customerId = 'cus_' + randomBytes(12).toString('hex');
 const now = Date.now();
 store.db.prepare(`
  INSERT INTO billing_customers (user_id, customer_id, payment_method_status, billing_email, created, updated)
  VALUES (?, ?, 'valid', ?, ?, ?)
 `).run(userId, customerId, billingEmail, now, now);

 return getCustomer(store, userId);
}

export function getSubscription(store, userId) {
 const row = store.db.prepare('SELECT * FROM customer_subscriptions WHERE user_id=?').get(userId);
 if (!row) {
  return {
   id: 'sub_default_' + userId,
   user_id: userId,
   plan: 'free',
   status: 'active',
   current_period_start: 0,
   current_period_end: Date.now() + 30 * 86400000,
   cancel_at_period_end: false,
   plan_details: PLANS.free
  };
 }

 const planDetails = PLANS[row.plan] || PLANS.free;
 return {
  id: row.id,
  user_id: row.user_id,
  plan: row.plan,
  status: row.status,
  current_period_start: row.current_period_start,
  current_period_end: row.current_period_end,
  cancel_at_period_end: Boolean(row.cancel_at_period_end),
  created: row.created,
  updated: row.updated,
  plan_details: planDetails
 };
}

export function subscribe(store, userId, {plan, billingEmail = null, simulatePaymentFailed = false} = {}) {
 if (!PLANS[plan]) {
  throw new Error(`Invalid plan '${plan}'. Supported plans: ${Object.keys(PLANS).join(', ')}.`);
 }

 if (simulatePaymentFailed) {
  const err = new Error('Payment processing failed. Card declined.');
  err.status = 402;
  throw err;
 }

 ensureCustomer(store, userId, {billingEmail});

 const now = Date.now();
 const periodEnd = now + 30 * 86400000;
 const subId = 'sub_' + randomBytes(12).toString('hex');
 const planConfig = PLANS[plan];

 store.db.exec('BEGIN IMMEDIATE');
 try {
  store.db.prepare(`
   INSERT INTO customer_subscriptions (id, user_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created, updated)
   VALUES (?, ?, ?, 'active', ?, ?, 0, ?, ?)
   ON CONFLICT(user_id) DO UPDATE SET
     plan=excluded.plan,
     status='active',
     current_period_start=excluded.current_period_start,
     current_period_end=excluded.current_period_end,
     cancel_at_period_end=0,
     updated=excluded.updated
  `).run(subId, userId, plan, now, periodEnd, now, now);

  // Generate invoice record
  const invoiceId = 'inv_' + randomBytes(12).toString('hex');
  const lineItems = JSON.stringify([
   {
    description: `${planConfig.name} (Monthly)`,
    amount_cents: planConfig.price_cents,
    quantity: 1
   }
  ]);

  store.db.prepare(`
   INSERT INTO invoices (id, user_id, subscription_id, amount_cents, currency, status, line_items, paid_at, created)
   VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?)
  `).run(
   invoiceId,
   userId,
   subId,
   planConfig.price_cents,
   planConfig.currency,
   lineItems,
   now,
   now
  );

  // Automatically sync budget caps with plan entitlements
  store.db.prepare(`
   INSERT INTO budget_caps (id, scope, user_id, daily_token_cap, monthly_token_cap, max_concurrent_containers, max_storage_bytes, alert_threshold_percent, created, updated)
   VALUES (?, 'user', ?, ?, ?, ?, ?, 80, ?, ?)
   ON CONFLICT(scope, user_id) DO UPDATE SET
     daily_token_cap=excluded.daily_token_cap,
     monthly_token_cap=excluded.monthly_token_cap,
     max_concurrent_containers=excluded.max_concurrent_containers,
     max_storage_bytes=excluded.max_storage_bytes,
     updated=excluded.updated
  `).run(
   randomUUID(),
   userId,
   planConfig.features.daily_tokens,
   planConfig.features.monthly_tokens,
   planConfig.features.max_containers,
   planConfig.features.storage_mb * 1024 * 1024,
   now,
   now
  );

  store.db.exec('COMMIT');
 } catch (err) {
  store.db.exec('ROLLBACK');
  throw err;
 }

 return {
  subscription: getSubscription(store, userId),
  invoice: listInvoices(store, userId)[0]
 };
}

export function cancelSubscription(store, userId, {immediate = false} = {}) {
 const sub = store.db.prepare('SELECT * FROM customer_subscriptions WHERE user_id=?').get(userId);
 if (!sub) {
  throw new Error('No active subscription found.');
 }

 const now = Date.now();
 if (immediate) {
  store.db.prepare(`
   UPDATE customer_subscriptions
   SET status='canceled', plan='free', cancel_at_period_end=0, updated=?
   WHERE user_id=?
  `).run(now, userId);
 } else {
  store.db.prepare(`
   UPDATE customer_subscriptions
   SET cancel_at_period_end=1, updated=?
   WHERE user_id=?
  `).run(now, userId);
 }

 return getSubscription(store, userId);
}

export function listInvoices(store, userId) {
 const rows = store.db.prepare('SELECT * FROM invoices WHERE user_id=? ORDER BY created DESC').all(userId);
 return rows.map(r => ({
  id: r.id,
  user_id: r.user_id,
  subscription_id: r.subscription_id,
  amount_cents: r.amount_cents,
  currency: r.currency,
  status: r.status,
  line_items: JSON.parse(r.line_items),
  paid_at: r.paid_at,
  created: r.created
 }));
}

export function verifyWebhookSignature(payloadRaw, signatureHeader, secret) {
 if (!payloadRaw || !signatureHeader || !secret) return false;
 const expected = createHmac('sha256', secret).update(payloadRaw).digest('hex');
 const sig = signatureHeader.replace(/^sha256=/, '').trim();
 if (expected.length !== sig.length) return false;
 return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function handleBillingWebhook(store, {rawBody, signature, secret}) {
 if (!verifyWebhookSignature(rawBody, signature, secret)) {
  const err = new Error('Invalid webhook signature.');
  err.status = 401;
  throw err;
 }

 const event = JSON.parse(rawBody.toString('utf8'));
 const now = Date.now();

 switch (event.type) {
  case 'invoice.payment_succeeded': {
   const {invoiceId, userId, amountCents} = event.data;
   if (invoiceId) {
    store.db.prepare('UPDATE invoices SET status=\'paid\', paid_at=? WHERE id=?').run(now, invoiceId);
   }
   break;
  }
  case 'customer.subscription.updated': {
   const {userId, plan, status} = event.data;
   if (userId && plan && PLANS[plan]) {
    const subId = 'sub_' + randomBytes(12).toString('hex');
    const periodEnd = now + 30 * 86400000;
    store.db.prepare(`
     INSERT INTO customer_subscriptions (id, user_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       plan=excluded.plan,
       status=excluded.status,
       updated=excluded.updated
    `).run(subId, userId, plan, status || 'active', now, periodEnd, now, now);
   }
   break;
  }
  case 'customer.subscription.deleted': {
   const {userId} = event.data;
   if (userId) {
    const subId = 'sub_' + randomBytes(12).toString('hex');
    const periodEnd = now + 30 * 86400000;
    store.db.prepare(`
     INSERT INTO customer_subscriptions (id, user_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created, updated)
     VALUES (?, ?, 'free', 'canceled', ?, ?, 0, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       plan='free',
       status='canceled',
       updated=excluded.updated
    `).run(subId, userId, now, periodEnd, now, now);
   }
   break;
  }
  default:
   // Unhandled event type acknowledged
   break;
 }

 return {received: true, type: event.type};
}

export function listCustomersAdmin(store, adminUserId) {
 const adminUser = store.db.prepare('SELECT admin FROM users WHERE id=?').get(adminUserId);
 if (!adminUser || !adminUser.admin) {
  const err = new Error('Admin permission required to view customer administration.');
  err.status = 403;
  throw err;
 }

 const rows = store.db.prepare(`
  SELECT u.id, u.username, u.created as user_created,
         COALESCE(s.plan, 'free') as plan,
         COALESCE(s.status, 'active') as subscription_status,
         s.current_period_end,
         s.cancel_at_period_end,
         c.customer_id, c.billing_email,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM invoices WHERE user_id = u.id AND status = 'paid') as total_spend_cents,
         (SELECT COUNT(*) FROM invoices WHERE user_id = u.id) as invoice_count
  FROM users u
  LEFT JOIN customer_subscriptions s ON s.user_id = u.id
  LEFT JOIN billing_customers c ON c.user_id = u.id
  ORDER BY u.created DESC
 `).all();

 const customers = rows.map(r => ({
  id: r.id,
  username: r.username,
  plan: r.plan,
  planName: PLANS[r.plan]?.name || 'Community Free',
  subscriptionStatus: r.subscription_status,
  currentPeriodEnd: r.current_period_end,
  cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
  customerId: r.customer_id,
  billingEmail: r.billing_email,
  totalSpendCents: r.total_spend_cents,
  invoiceCount: r.invoice_count,
  created: r.user_created
 }));

 const totalRevenueCents = customers.reduce((sum, c) => sum + c.totalSpendCents, 0);
 const activePaid = customers.filter(c => c.plan !== 'free' && c.subscriptionStatus === 'active').length;

 return {
  customers,
  summary: {
   totalCustomers: customers.length,
   activePaidSubscriptions: activePaid,
   totalRevenueCents,
   currency: 'usd'
  }
 };
}
