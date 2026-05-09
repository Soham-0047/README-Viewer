/**
 * MarkVault — Firebase Functions
 *
 * Three callables / HTTP functions back the subscription flow:
 *   createCheckoutSession (callable) — start a Stripe Checkout
 *   createPortalSession   (callable) — open the Stripe billing portal
 *   stripeWebhook         (HTTP)    — listen for sub events, mirror status
 *                                     to users/{uid}/subscription/status
 *
 * Required Firebase config (set with `firebase functions:config:set …` or env vars):
 *   stripe.secret          — sk_live_… or sk_test_…
 *   stripe.webhook_secret  — whsec_… from the Stripe webhook endpoint
 *
 * The owner_uid is read from Firestore (mv_config/features) — no env var needed.
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Lazily init Stripe so emulator/imports don't crash if config is missing
function _stripe() {
  const key = (functions.config().stripe && functions.config().stripe.secret) || process.env.STRIPE_SECRET;
  if (!key) throw new Error('Stripe secret not configured. Run: firebase functions:config:set stripe.secret="sk_…"');
  return require('stripe')(key, { apiVersion: '2024-06-20' });
}

// ── Checkout ────────────────────────────────────────────
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const { priceId, billing = 'monthly', origin = '' } = data || {};
  if (!priceId) throw new functions.https.HttpsError('invalid-argument', 'priceId required');

  const uid   = context.auth.uid;
  const email = context.auth.token.email || undefined;
  const stripe = _stripe();

  // Reuse existing customer when possible
  const subDoc = await db.collection('users').doc(uid).collection('subscription').doc('status').get();
  let customerId = subDoc.exists ? subDoc.data().stripeCustomerId : null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { firebaseUID: uid },
    });
    customerId = customer.id;
    await db.collection('users').doc(uid).collection('subscription').doc('status').set({
      stripeCustomerId: customerId,
      plan: 'free', status: 'none',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  // Trial days from remote config
  let trialDays = 0;
  try {
    const cfgDoc = await db.collection('mv_config').doc('features').get();
    if (cfgDoc.exists) trialDays = parseInt(cfgDoc.data().pro_trial_days || 0) || 0;
  } catch {}

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: trialDays > 0 ? trialDays : undefined,
      metadata: { firebaseUID: uid },
    },
    metadata: { firebaseUID: uid, billing },
    success_url: `${origin || 'https://example.com/'}?subscribed=1`,
    cancel_url:  `${origin || 'https://example.com/'}?subscribed=0`,
    allow_promotion_codes: true,
  });

  return { sessionId: session.id };
});

// ── Customer portal ─────────────────────────────────────
exports.createPortalSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const uid = context.auth.uid;
  const subDoc = await db.collection('users').doc(uid).collection('subscription').doc('status').get();
  const customerId = subDoc.exists ? subDoc.data().stripeCustomerId : null;
  if (!customerId) throw new functions.https.HttpsError('failed-precondition', 'No Stripe customer for this user.');

  const stripe = _stripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: data?.returnUrl || 'https://example.com/',
  });
  return { url: portal.url };
});

// ── Webhook ─────────────────────────────────────────────
// Configured as raw-body HTTP function. Verify signature against the
// webhook secret from `firebase functions:config:set stripe.webhook_secret="whsec_…"`.
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const stripe = _stripe();
  const secret = (functions.config().stripe && functions.config().stripe.webhook_secret) || process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.error('[webhook] signature verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const uid = sub.metadata?.firebaseUID;
        if (!uid) { console.warn('[webhook] no firebaseUID in subscription metadata'); break; }

        const status = mapStripeStatus(sub);
        await db.collection('users').doc(uid).collection('subscription').doc('status').set({
          status,
          plan: status === 'none' ? 'free' : 'pro',
          billing: sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        // Look up uid via subscription
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription);
          const uid = sub.metadata?.firebaseUID;
          if (uid) {
            await db.collection('users').doc(uid).collection('subscription').doc('status').set({
              status: 'past_due',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
        break;
      }
      default:
        // ignore other events
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error:', err);
    res.status(500).send('handler error');
  }
});

function mapStripeStatus(sub) {
  if (!sub) return 'none';
  switch (sub.status) {
    case 'active':     return 'active';
    case 'trialing':   return 'trialing';
    case 'past_due':   return 'past_due';
    case 'canceled':   return 'canceled';
    case 'unpaid':     return 'past_due';
    case 'incomplete': return 'none';
    case 'incomplete_expired': return 'none';
    default:           return 'none';
  }
}
