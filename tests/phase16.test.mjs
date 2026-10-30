import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {fixture} from './helpers.mjs';
import {PLANS, getSubscription, subscribe, cancelSubscription, listInvoices, listCustomersAdmin} from '../lib/billing.mjs';
import {getBudgetCaps} from '../lib/budgets.mjs';

test('Plan catalog, default subscription and upgrade with automated budget synchronization', async t => {
 const {app, call, register} = await fixture(t);
 const admin = await register('admin-billing');
 const user = await register('user-billing');

 // 1. Catalog plans endpoint
 const plansRes = await call('/api/billing/plans', {method: 'GET'});
 assert.equal(plansRes.status, 200);
 assert.ok(plansRes.data.plans.free);
 assert.ok(plansRes.data.plans.pro);
 assert.ok(plansRes.data.plans.team);
 assert.equal(plansRes.data.plans.pro.price_cents, 2900);

 // 2. Default subscription is free
 const subInitial = await call('/api/billing/subscription', {
  method: 'GET',
  cookie: user.cookie
 });
 assert.equal(subInitial.status, 200);
 assert.equal(subInitial.data.subscription.plan, 'free');
 assert.equal(subInitial.data.subscription.status, 'active');

 // 3. Subscribe to pro plan
 const subRes = await call('/api/billing/subscribe', {
  method: 'POST',
  cookie: user.cookie,
  body: {plan: 'pro', billingEmail: 'user@dock.dev'}
 });
 assert.equal(subRes.status, 200);
 assert.equal(subRes.data.subscription.plan, 'pro');
 assert.equal(subRes.data.subscription.status, 'active');
 assert.equal(subRes.data.invoice.amount_cents, 2900);
 assert.equal(subRes.data.invoice.status, 'paid');

 // 4. Check that budget caps automatically updated to pro tier
 const userCaps = getBudgetCaps(app.store, user.user.id);
 assert.equal(userCaps.dailyTokenCap, PLANS.pro.features.daily_tokens);
 assert.equal(userCaps.monthlyTokenCap, PLANS.pro.features.monthly_tokens);
 assert.equal(userCaps.maxConcurrentContainers, PLANS.pro.features.max_containers);

 // 5. List invoices
 const invRes = await call('/api/billing/invoices', {
  method: 'GET',
  cookie: user.cookie
 });
 assert.equal(invRes.status, 200);
 assert.equal(invRes.data.invoices.length, 1);
 assert.equal(invRes.data.invoices[0].amount_cents, 2900);
 assert.ok(invRes.data.invoices[0].line_items[0].description.includes('Professional Developer'));
});

test('Subscription cancellation (period-end and immediate) and invalid plan validation', async t => {
 const {app, call, register} = await fixture(t);
 const user = await register('canceler-billing');

 // Attempt invalid plan
 const invalidPlan = await call('/api/billing/subscribe', {
  method: 'POST',
  cookie: user.cookie,
  body: {plan: 'non-existent-tier'}
 });
 assert.equal(invalidPlan.status, 400);
 assert.ok(invalidPlan.data.error.includes('Invalid plan'));

 // Subscribe to team
 await call('/api/billing/subscribe', {
  method: 'POST',
  cookie: user.cookie,
  body: {plan: 'team'}
 });

 // Cancel at period end
 const cancelEnd = await call('/api/billing/cancel', {
  method: 'POST',
  cookie: user.cookie,
  body: {immediate: false}
 });
 assert.equal(cancelEnd.status, 200);
 assert.equal(cancelEnd.data.subscription.cancel_at_period_end, true);
 assert.equal(cancelEnd.data.subscription.plan, 'team');

 // Immediate cancellation
 const cancelNow = await call('/api/billing/cancel', {
  method: 'POST',
  cookie: user.cookie,
  body: {immediate: true}
 });
 assert.equal(cancelNow.status, 200);
 assert.equal(cancelNow.data.subscription.status, 'canceled');
 assert.equal(cancelNow.data.subscription.plan, 'free');
});

test('Signed HMAC webhook processes payment and subscription lifecycle events securely', async t => {
 const webhookSecret = 'test_webhook_secret_key_123';
 const {app, call, register} = await fixture(t, {
  config: {billingWebhookSecret: webhookSecret}
 });
 const user = await register('webhook-user');

 const sign = payload => {
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = createHmac('sha256', webhookSecret).update(buf).digest('hex');
  return {buf, hmac};
 };

 // 1. Webhook with invalid signature is rejected 401
 const badSig = await call('/api/billing/webhook', {
  method: 'POST',
  body: {type: 'customer.subscription.updated', data: {userId: user.user.id, plan: 'team'}},
  origin: null
 });
 assert.equal(badSig.status, 401);

 // 2. Valid signature for subscription update
 const payloadUpdate = {
  type: 'customer.subscription.updated',
  data: {userId: user.user.id, plan: 'team', status: 'active'}
 };
 const {buf: bufUpdate, hmac: hmacUpdate} = sign(payloadUpdate);

 const resUpdate = await new Promise(resolve => {
  const chunks = [];
  const fakeReq = {
   method: 'POST',
   url: '/api/billing/webhook',
   headers: {
    host: '127.0.0.1:4199',
    'x-agentdock-signature': hmacUpdate,
    'content-type': 'application/json'
   },
   [Symbol.asyncIterator]: async function* () {
    yield bufUpdate;
   }
  };
  const fakeRes = {
   headers: {},
   status: 0,
   writeHead(status, headers = {}) {
    this.status = status;
    this.headers = headers;
   },
   end(data) {
    try {
     this.data = JSON.parse(data.toString());
    } catch {
     this.data = data?.toString();
    }
    resolve({status: this.status, data: this.data});
   }
  };
  app.handler(fakeReq, fakeRes);
 });

 assert.equal(resUpdate.status, 200);
 assert.equal(resUpdate.data.received, true);

 // Verify subscription updated in DB
 const sub = getSubscription(app.store, user.user.id);
 assert.equal(sub.plan, 'team');

 // 3. Valid signature for subscription deleted
 const payloadDelete = {
  type: 'customer.subscription.deleted',
  data: {userId: user.user.id}
 };
 const {buf: bufDel, hmac: hmacDel} = sign(payloadDelete);

 const resDel = await new Promise(resolve => {
  const fakeReq = {
   method: 'POST',
   url: '/api/billing/webhook',
   headers: {
    host: '127.0.0.1:4199',
    'x-agentdock-signature': hmacDel,
    'content-type': 'application/json'
   },
   [Symbol.asyncIterator]: async function* () {
    yield bufDel;
   }
  };
  const fakeRes = {
   headers: {},
   status: 0,
   writeHead(status, headers = {}) {
    this.status = status;
    this.headers = headers;
   },
   end(data) {
    try {
     this.data = JSON.parse(data.toString());
    } catch {
     this.data = data?.toString();
    }
    resolve({status: this.status, data: this.data});
   }
  };
  app.handler(fakeReq, fakeRes);
 });

 assert.equal(resDel.status, 200);
 const subAfterDel = getSubscription(app.store, user.user.id);
 assert.equal(subAfterDel.status, 'canceled');
 assert.equal(subAfterDel.plan, 'free');
});

test('Customer administration endpoint enforces admin controls and provides aggregate metrics', async t => {
 const {app, call, register} = await fixture(t);
 const admin = await register('admin-customers');
 const user1 = await register('cust-one');
 const user2 = await register('cust-two');

 // User 1 subscribes to pro ($29.00)
 await call('/api/billing/subscribe', {
  method: 'POST',
  cookie: user1.cookie,
  body: {plan: 'pro', billingEmail: 'cust1@dock.dev'}
 });

 // User 2 subscribes to team ($99.00)
 await call('/api/billing/subscribe', {
  method: 'POST',
  cookie: user2.cookie,
  body: {plan: 'team', billingEmail: 'cust2@dock.dev'}
 });

 // Regular user blocked from admin customers
 const regCheck = await call('/api/admin/customers', {
  method: 'GET',
  cookie: user1.cookie
 });
 assert.equal(regCheck.status, 403);

 // Admin inspects customer administration
 const adminCheck = await call('/api/admin/customers', {
  method: 'GET',
  cookie: admin.cookie
 });
 assert.equal(adminCheck.status, 200);
 assert.ok(adminCheck.data.customers.length >= 3);
 assert.equal(adminCheck.data.summary.activePaidSubscriptions, 2);
 assert.equal(adminCheck.data.summary.totalRevenueCents, 2900 + 9900); // $128.00

 const c1 = adminCheck.data.customers.find(c => c.username === 'cust-one');
 assert.ok(c1);
 assert.equal(c1.plan, 'pro');
 assert.equal(c1.totalSpendCents, 2900);
 assert.equal(c1.billingEmail, 'cust1@dock.dev');
});
