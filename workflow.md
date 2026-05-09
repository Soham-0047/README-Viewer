## My Suggestions First

Before the prompt, here's my recommended tiering philosophy:

**Don't hard-block — use friction + limits.** The most effective open-source monetization isn't "you can't use this," it's "free is good enough for casual use, pro removes all friction."

**Suggested model:**

| Layer | Free | Pro |
|-------|------|-----|
| **AI** | 5 AI requests/day total | Unlimited |
| **Sharing** | 3 active links, basic | Unlimited + paywall links |
| **PDF** | Algorithm only (no API key needed) | Datalab + Gemini |
| **Sync** | 1 device (localStorage) | All devices (Firebase) |
| **Files** | 20 file limit | Unlimited |
| **Export** | HTML only | HTML + PDF |
| **Writing tools** | 2 tools (Improve + Fix Grammar) | All 11 tools |
| **Split pane** | ✅ Free | ✅ Free |
| **Templates** | 3 templates | All 9 |
| **Focus mode** | ✅ Free | ✅ Free |
| **Premium share links** | ❌ | ✅ |
| **Analytics dashboard** | Basic (views count) | Full (unique, referrers, charts) |

**The psychology:** Free users hit soft limits naturally while using the app. The upgrade prompt appears at the exact moment of value — not as a cold popup.

---

Here's the full Claude Code prompt:

---

## Full Claude Code Prompt

```
You are adding a fully dynamic, admin-configurable subscription/monetization 
system to MarkVault — a static GitHub Pages Markdown app using Firebase 
Firestore + Google Auth. No backend server exists except Firebase Functions 
for Stripe webhooks.

Read ALL existing files fully before making any changes:
index.html, app.js, storage.js, ai.js, sharing.js, renderer.js, 
pdfhandler.js, templates.js, style.css, and the MarkVault project bible.

---

## GOAL

Build a subscription system where:
1. ALL feature gates are controlled by a live Firestore config document
2. An owner admin panel (in-app, behind owner UID check) lets you toggle 
   any feature free/pro, set usage limits, change pricing copy — all 
   without redeploying
3. Stripe handles payments via Firebase Functions
4. Free users hit soft limits with contextual upgrade prompts, not hard walls
5. Shared links can be marked "premium" — non-subscribers see a partial 
   preview with a paywall

---

## PART 1 — FIRESTORE SCHEMA

Create these Firestore collections/documents:

### A. Remote Feature Config (one document, owner-editable)
Path: `mv_config/features`

```json
{
  "ai_requests_per_day_free": 5,
  "ai_requests_per_day_pro": -1,
  "ai_tools_free": ["improve", "fixgrammar"],
  "ai_tools_pro": ["improve","simplify","expand","shorten","fixgrammar",
                   "formal","casual","bullets","table","summarize","translate"],
  "ai_chat_free": true,
  "ai_chat_pro": true,
  "ai_summary_free": true,
  "ai_summary_pro": true,
  "pdf_algo_free": true,
  "pdf_datalab_free": false,
  "pdf_gemini_free": true,
  "pdf_datalab_pro": true,
  "sharing_max_links_free": 3,
  "sharing_max_links_pro": -1,
  "sharing_premium_links_free": false,
  "sharing_premium_links_pro": true,
  "sharing_analytics_free": "basic",
  "sharing_analytics_pro": "full",
  "files_max_free": 20,
  "files_max_pro": -1,
  "templates_free": ["blank","meeting","readme"],
  "templates_pro": ["blank","meeting","readme","blog","api-docs",
                    "weekly-review","research","decision","changelog"],
  "split_pane_free": true,
  "focus_mode_free": true,
  "export_html_free": true,
  "export_pdf_free": false,
  "export_pdf_pro": true,
  "cloud_sync_free": true,
  "cloud_sync_device_limit_free": 1,
  "cloud_sync_device_limit_pro": -1,
  "pro_price_monthly": 5,
  "pro_price_yearly": 45,
  "pro_trial_days": 7,
  "stripe_price_id_monthly": "price_REPLACE_ME",
  "stripe_price_id_yearly": "price_REPLACE_ME_YEARLY",
  "stripe_publishable_key": "pk_live_REPLACE_ME",
  "paywall_preview_lines": 80,
  "upgrade_modal_show_after_days": 3,
  "owner_uid": "REPLACE_WITH_YOUR_FIREBASE_UID"
}
```

Firestore security rules for this:
```
match /mv_config/{doc} {
  allow read: if true;
  allow write: if request.auth != null && 
    request.auth.uid == resource.data.owner_uid;
}
```

### B. User Subscription
Path: `users/{uid}/subscription/status`
```json
{
  "status": "active|trialing|canceled|none",
  "plan": "pro|free",
  "billing": "monthly|yearly",
  "stripeCustomerId": "cus_xxx",
  "currentPeriodEnd": "ISO string",
  "cancelAtPeriodEnd": false,
  "trialEnd": "ISO string or null",
  "updatedAt": "ISO string"
}
```

### C. Usage Tracking
Path: `users/{uid}/usage/{YYYY-MM-DD}`
```json
{
  "ai_requests": 0,
  "date": "2024-01-01"
}
```
For anonymous/local users, mirror this in localStorage under `mv_usage_{date}`.

---

## PART 2 — NEW FILE: `subscription.js`

Create `/js/subscription.js` and load it AFTER storage.js in index.html.

This module handles everything subscription-related:

```javascript
const Subscription = (() => {

  let _config = null;        // remote feature config
  let _status = null;        // current user's sub status
  let _usage  = null;        // today's usage
  let _onUpgrade = null;     // callback when user upgrades

  const CONFIG_PATH = 'mv_config/features';
  const TODAY = () => new Date().toISOString().split('T')[0];

  // ── Load remote config (cached, refreshed every 10 min) ──
  // Falls back to hardcoded defaults if Firestore unreachable
  const DEFAULTS = {
    ai_requests_per_day_free: 5,
    ai_tools_free: ['improve', 'fixgrammar'],
    sharing_max_links_free: 3,
    files_max_free: 20,
    templates_free: ['blank', 'meeting', 'readme'],
    pro_price_monthly: 5,
    pro_trial_days: 7,
    paywall_preview_lines: 80,
    stripe_publishable_key: '',
    stripe_price_id_monthly: '',
  };

  async function loadConfig() {
    // Try Firestore first, fall back to localStorage cache, then defaults
    // Cache in localStorage with 10-minute TTL
    // Return merged object
  }

  function getConfig(key) {
    return _config?.[key] ?? DEFAULTS[key];
  }

  // ── Subscription status ──
  async function loadStatus() {
    // Load from Firestore if signed in, else return {plan:'free',status:'none'}
    // Cache in memory for session
  }

  function isPro() {
    return _status?.status === 'active' || _status?.status === 'trialing';
  }

  function getTrialDaysLeft() {
    if (_status?.status !== 'trialing' || !_status?.trialEnd) return 0;
    const diff = new Date(_status.trialEnd) - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  // ── Usage tracking ──
  async function getUsageToday(metric) {
    // Check localStorage first (works offline + for anon users)
    // If signed in, also check Firestore (source of truth)
    // Return number
  }

  async function incrementUsage(metric) {
    // Increment in localStorage AND Firestore (if signed in)
    // Firestore path: users/{uid}/usage/{today}
  }

  // ── Feature checks (main public API) ──
  // Each returns { allowed: bool, reason: string, limit: number, used: number }

  async function canUseAI() {
    if (isPro()) return { allowed: true };
    const limit = getConfig('ai_requests_per_day_free');
    if (limit === -1) return { allowed: true };
    const used = await getUsageToday('ai_requests');
    return {
      allowed: used < limit,
      reason: `Free plan: ${limit} AI requests/day`,
      limit, used,
      upgradeReason: 'ai'
    };
  }

  function canUseAITool(toolId) {
    if (isPro()) return { allowed: true };
    const freeTools = getConfig('ai_tools_free');
    return {
      allowed: freeTools.includes(toolId),
      reason: `"${toolId}" is a Pro writing tool`,
      upgradeReason: 'writing_tools'
    };
  }

  async function canCreateFile(currentCount) {
    if (isPro()) return { allowed: true };
    const limit = getConfig('files_max_free');
    if (limit === -1) return { allowed: true };
    return {
      allowed: currentCount < limit,
      reason: `Free plan: ${limit} files max`,
      limit, used: currentCount,
      upgradeReason: 'files'
    };
  }

  async function canCreateShareLink(currentLinkCount) {
    if (isPro()) return { allowed: true };
    const limit = getConfig('sharing_max_links_free');
    if (limit === -1) return { allowed: true };
    return {
      allowed: currentLinkCount < limit,
      reason: `Free plan: ${limit} active share links`,
      limit, used: currentLinkCount,
      upgradeReason: 'sharing'
    };
  }

  function canUsePremiumLinks() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('sharing_premium_links_free') === true,
      reason: 'Premium share links require Pro',
      upgradeReason: 'premium_links'
    };
  }

  function canUsePDFDatalab() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('pdf_datalab_free') === true,
      reason: 'Datalab PDF conversion requires Pro',
      upgradeReason: 'pdf'
    };
  }

  function canUseTemplate(templateId) {
    if (isPro()) return { allowed: true };
    const freeTemplates = getConfig('templates_free');
    return {
      allowed: freeTemplates.includes(templateId),
      reason: 'This template requires Pro',
      upgradeReason: 'templates'
    };
  }

  function canUseFullAnalytics() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('sharing_analytics_free') === 'full',
      reason: 'Full analytics requires Pro',
      upgradeReason: 'analytics'
    };
  }

  // ── Stripe checkout ──
  async function startCheckout(billing = 'monthly') {
    // 1. Ensure user is signed in (prompt if not)
    // 2. Call Firebase Function createCheckoutSession
    // 3. Redirect to Stripe Checkout
    // billing: 'monthly' | 'yearly'
  }

  async function openCustomerPortal() {
    // Call Firebase Function createPortalSession
    // Redirects to Stripe portal (cancel, change plan, invoices)
  }

  // ── onUpgrade callback ──
  function onUpgrade(cb) { _onUpgrade = cb; }

  // ── Init ──
  async function init() {
    await Promise.all([loadConfig(), loadStatus()]);
    _usage = await getUsageToday('ai_requests');

    // Check ?subscribed=1 query param (returning from Stripe)
    if (new URLSearchParams(window.location.search).get('subscribed')) {
      await loadStatus(); // refresh
      if (_onUpgrade) _onUpgrade(_status);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  return {
    init, loadConfig, loadStatus, getConfig, isPro,
    getTrialDaysLeft, incrementUsage,
    canUseAI, canUseAITool, canCreateFile, canCreateShareLink,
    canUsePremiumLinks, canUsePDFDatalab, canUseTemplate, canUseFullAnalytics,
    startCheckout, openCustomerPortal, onUpgrade,
  };
})();
```

---

## PART 3 — UPGRADE MODAL SYSTEM

Create a global, reusable upgrade modal in `app.js`. It must be 
context-aware — it shows different messaging based on WHY the user hit 
the gate.

The upgrade reasons and their copy:

```javascript
const UPGRADE_REASONS = {
  ai: {
    icon: '🤖',
    title: "You've used today's AI credits",
    desc: 'Free plan includes {limit} AI requests per day. Upgrade for unlimited.',
    highlight: true, // show usage bar
  },
  writing_tools: {
    icon: '✍️',
    title: 'Pro Writing Tool',
    desc: 'This writing tool is available on Pro. Free plan includes Improve and Fix Grammar.',
  },
  files: {
    icon: '📁',
    title: 'File limit reached',
    desc: 'Free plan supports up to {limit} files. Upgrade for unlimited.',
    highlight: true,
  },
  sharing: {
    icon: '🔗',
    title: 'Share link limit reached',
    desc: 'Free plan supports {limit} active share links.',
    highlight: true,
  },
  premium_links: {
    icon: '🔒',
    title: 'Premium Share Links',
    desc: 'Create paywall-protected links that only your subscribers can access.',
  },
  pdf: {
    icon: '📄',
    title: 'Advanced PDF Conversion',
    desc: 'Datalab API gives near-perfect PDF conversion with table and math support.',
  },
  templates: {
    icon: '📋',
    title: 'Pro Template',
    desc: 'This template is available on Pro. Free plan includes Blank, Meeting Notes, and README.',
  },
  analytics: {
    icon: '📊',
    title: 'Full Analytics',
    desc: 'See unique viewers, geographic data, and per-link charts.',
  },
};
```

The modal HTML should:
- Show the reason-specific icon, title, and description
- List all Pro features in a scrollable grid (pulled from remote config copy)
- Show pricing: Monthly ($X/mo) and Yearly ($Y/mo, save Z%) side by side
- Show "Start free trial" if trial_days > 0, else "Upgrade now"
- Show a usage bar if `highlight: true` (e.g., "3/5 AI requests used today")
- Have a subtle "Maybe later" link at the bottom (not a button — reduce prominence)
- If user is already signed in but not pro, show their email so it feels personal
- Animate in from bottom on mobile (sheet), center on desktop

---

## PART 4 — USAGE INDICATOR IN SIDEBAR

Add a subtle usage indicator to the sidebar footer that shows:
- For free users: "3 / 5 AI credits today" with a small progress bar
  - Turns orange when ≥ 80% used
  - Turns red and shows "Upgrade" link when at 100%
- For pro users: "◈ Pro" badge with their plan period end date on hover
- For trial users: "Trial — X days left" with urgency if < 3 days

Position it above the storage info in the sidebar footer.

---

## PART 5 — SOFT GATES (replace hard blocks)

In the existing code, add these gates. Each gate should:
1. Check the relevant Subscription method
2. If not allowed: show the upgrade modal with correct reason
3. If allowed but near limit: show a subtle inline toast warning
4. If allowed: proceed normally AND call `Subscription.incrementUsage()`

Gates to add:

### AI requests (ai.js or app.js — wherever AI calls originate)
Before every AIRouter.complete() call, check canUseAI().
After a successful response, call incrementUsage('ai_requests').
When at 4/5 (one left), show: toast("1 AI credit left today — upgrade for unlimited", "warn")

### Writing tools (_initWritingTools in app.js)
When a tool button is clicked, check canUseAITool(toolId).
Free tools (improve, fixgrammar) work normally.
Pro tools show a small lock icon overlay on the button.
Clicking a locked tool shows the upgrade modal immediately, before any 
network call.

### New file (newFile() in app.js)  
Before creating, check canCreateFile(Storage.list().length).
Show count in the modal: "You have 18/20 files (free plan)"

### Share links (_generateShareLink in app.js)
Check canCreateShareLink(existingLinkCount).
Add a "Premium link 🔒" toggle in the share modal — disabled with tooltip 
if canUsePremiumLinks() is false.

### PDF conversion (openConvertModal in app.js)
In the Datalab tab, show a lock overlay if !canUsePDFDatalab().
Clicking it shows the upgrade modal with reason 'pdf'.

### Templates (_openTemplates in app.js)
Pro-only template cards show a "⭐ Pro" badge in the corner.
Clicking them shows the upgrade modal with reason 'templates'.
Do NOT hide them — seeing them drives upgrade intent.

---

## PART 6 — PAYWALL IN SHARED VIEWER (sharing.js)

Modify SharedViewer.init() to handle premium shared links:

1. After fetching link data, if `data.premium === true`:
   a. Check if viewer is signed in AND has active subscription
   b. If yes: render full content normally
   c. If no: 
      - Render only first `config.paywall_preview_lines` lines
      - Add a CSS blur/fade overlay on the last 25% of visible content
      - Inject a sticky paywall card at the bottom with:
        * Document title and author (from link data)
        * "You're reading a preview" label
        * "Subscribe to continue reading" CTA
        * Monthly/yearly pricing toggle
        * Stripe checkout button
        * "Sign in if you're already subscribed" link
      - Do NOT show this as a modal — it should feel like a natural 
        end-of-preview, like Medium

2. If viewer signs in mid-session and IS subscribed, 
   automatically remove the paywall and render the full content 
   without page reload.

3. Track paywall_hits separately in the link analytics.

---

## PART 7 — ADMIN PANEL (owner only)

Add an "Admin" option in the account dropdown menu, visible only when 
`Storage.getCurrentUser()?.uid === Subscription.getConfig('owner_uid')`.

The admin panel is a full-screen modal with tabs:

### Tab 1: Feature Flags
A live-editable table of ALL config keys with:
- Feature name (human-readable label)
- Free tier setting (editable inline: toggle, number input, or multi-select)
- Pro tier setting (editable inline)
- Save button per row (PATCH to Firestore mv_config/features)

Group rows by category:
- AI Features
- File & Storage  
- Sharing & Links
- PDF Conversion
- Templates
- Pricing & Billing

### Tab 2: Pricing
- Monthly price (number input → updates Stripe price copy + config)
- Yearly price + discount display
- Trial days
- Stripe price IDs (text inputs)
- "Test checkout" button that opens Stripe test mode checkout

### Tab 3: Subscribers
- Live list from Firestore: all users with active subscriptions
- Columns: email, plan, status, joined date, period end
- "Grant Pro" button to manually upgrade any email (sets sub status in Firestore)
- "Revoke" button
- Total MRR estimate (count × monthly price)

### Tab 4: Usage Analytics
- Total AI requests today / this week / this month
- Breakdown: free users vs pro users
- Top 10 power users by AI requests
- Conversion funnel: users who hit limits → upgraded

### Tab 5: Paywall Config
- Preview lines slider (20–200, live preview)
- Paywall card copy editor (title, description, CTA text)
- A/B test toggle (50% of visitors see variant copy)
- Premium link count and total paywall hits

All admin writes go directly to Firestore (owner UID passes security rules).
No server needed for admin operations.

---

## PART 8 — FIREBASE FUNCTIONS (functions/index.js)

Create these three callable functions:

### createCheckoutSession
Input: { priceId, billing, origin }
- Create/retrieve Stripe customer linked to Firebase UID
- Create Stripe Checkout session with 7-day trial if configured
- Return { sessionId }

### createPortalSession  
Input: { returnUrl }
- Look up stripeCustomerId from Firestore
- Create Stripe billing portal session
- Return { url }

### stripeWebhook (HTTP, not callable)
Handle these events:
- customer.subscription.created
- customer.subscription.updated  
- customer.subscription.deleted
- customer.subscription.trial_will_end → send email reminder (optional)
- invoice.payment_failed → mark status as 'past_due'

On each event, update `users/{uid}/subscription/status` in Firestore.
Map Firebase UID via `subscription.metadata.firebaseUID`.

---

## PART 9 — SUBSCRIPTION STATUS UI

### Sidebar footer badge
Add above storage info:
```
Free: [░░░░░░░░░█] 3/5 AI today  [Upgrade]
Pro:  [◈ Pro · renews Jan 12]
Trial: [⏱ 5 days left in trial]  [Upgrade]
```

### Account menu additions
After the existing menu items, add:
- If free: "Upgrade to Pro ✦" (highlighted in accent color)
- If pro: "◈ Pro Plan" label + "Manage subscription" link → Stripe portal
- If trial: "Trial ends {date}" + "Upgrade now" 
- If owner: "Admin Panel ⚙" separator + link

### Topbar pro badge
When a pro user is viewing the app, add a subtle "◈ Pro" pill 
next to the topbar title. Clicking it opens the account menu.

---

## PART 10 — STYLE ADDITIONS (style.css)

Add these CSS sections:

### Usage bar in sidebar
```css
.usage-bar-wrap { ... }
.usage-bar-fill { ... } /* accent when <80%, danger when 100% */
.usage-badge { ... }
.usage-badge.pro { ... }  /* gold gradient */
.usage-badge.trial { ... } /* orange, pulse if <3 days */
```

### Upgrade modal
```css
.upgrade-modal { ... }
.upgrade-pricing-toggle { ... } /* monthly/yearly selector */
.upgrade-plan-card { ... }
.upgrade-feature-grid { ... }
.upgrade-cta-primary { ... }
/* Mobile: slides up from bottom */
@media (max-width: 640px) {
  .upgrade-modal { border-radius: 20px 20px 0 0; align-self: flex-end; }
}
```

### Pro badges on templates/tools
```css
.pro-badge { 
  font-size: 9px; background: var(--accent); color: #180D00;
  padding: 1px 5px; border-radius: 3px; font-weight: 700;
  letter-spacing: .04em;
}
.locked-overlay { ... } /* semi-transparent + lock icon on locked items */
```

### Paywall in shared viewer
```css
.paywall-fade { ... }    /* gradient overlay */
.paywall-card { ... }    /* sticky bottom card */
.paywall-pricing { ... } /* monthly/yearly toggle */
```

---

## PART 11 — index.html CHANGES

1. Add script tag for subscription.js AFTER storage.js:
   `<script src="js/subscription.js?v=6"></script>`

2. Bump ALL script ?v= to ?v=6

3. Add Stripe.js in <head>:
   `<script src="https://js.stripe.com/v3/"></script>`

4. Add admin panel modal HTML (full-screen, with tab structure)

5. Add usage indicator HTML in sidebar footer:
   ```html
   <div class="usage-indicator hidden" id="usageIndicator">
     <div class="usage-bar-wrap">
       <div class="usage-bar-fill" id="usageBarFill"></div>
     </div>
     <div class="usage-bar-label" id="usageBarLabel"></div>
   </div>
   ```

---

## PART 12 — INTEGRATION IN app.js

In the `init()` function, after `await Storage.autoConnect()`:

```javascript
// Initialize subscription system
await Subscription.init();

// Update sidebar usage indicator
_updateUsageIndicator();

// Wire upgrade button in account menu
document.getElementById('accountMenuUpgrade')
  ?.addEventListener('click', () => Subscription.startCheckout('monthly'));

// Wire manage subscription  
document.getElementById('accountMenuManageSub')
  ?.addEventListener('click', () => Subscription.openCustomerPortal());

// Wire admin panel
document.getElementById('accountMenuAdmin')
  ?.addEventListener('click', _openAdminPanel);
```

Add `_updateUsageIndicator()` function that:
- Gets today's usage from Subscription
- Updates the sidebar bar width and label
- Shows/hides the indicator based on pro status
- Re-runs every time an AI request completes

---

## IMPLEMENTATION NOTES

1. All feature config reads must fall back gracefully to DEFAULTS 
   if Firestore is unavailable — never break the core app

2. Usage tracking must work for non-signed-in users via localStorage
   key `mv_usage_{YYYY-MM-DD}` = `{ ai_requests: N }`

3. The Subscription.init() should be non-blocking — use 
   Promise.all() and don't await it before showing the app UI
   Use optimistic UI then update when data loads

4. Never show an upgrade prompt more than once per session for the 
   same reason (track shown reasons in sessionStorage)

5. The admin panel feature flag changes take effect immediately via 
   Firestore's onSnapshot listener — no reload needed

6. Stripe webhook must verify signature — never trust raw POST bodies

7. For the shared viewer paywall, load Stripe.js lazily only when 
   a premium link is detected — don't load it for all viewers

8. Test mode: if stripe_publishable_key starts with 'pk_test_', 
   add a "TEST MODE" banner to the upgrade modal

9. The owner_uid field in config lets you keep the app fully open 
   source — each deployer sets their own UID and Stripe keys

10. Add a `mv_config/features` document listener in Subscription.init()
    so if the owner changes a feature flag, it takes effect for ALL 
    active sessions within seconds without any reload

---

## FILE STRUCTURE AFTER CHANGES

```
├── index.html          (updated — new modals, Stripe.js, v=6)
├── js/
│   ├── storage.js      (updated — subscription status methods)
│   ├── subscription.js (NEW — all subscription logic)
│   ├── app.js          (updated — gates, admin panel, UI)
│   ├── ai.js           (updated — usage tracking on complete())
│   ├── sharing.js      (updated — paywall in shared viewer)
│   ├── templates.js    (unchanged)
│   ├── pdfhandler.js   (unchanged)
│   └── renderer.js     (unchanged)
├── functions/
│   ├── index.js        (NEW — Stripe webhook + checkout functions)
│   └── package.json    (NEW — stripe, firebase-admin, firebase-functions)
├── style.css           (updated — all new UI components)
├── manifest.json       (unchanged)
└── sw.js               (unchanged)
```

Begin with subscription.js, then style.css additions, then the 
integration changes to app.js and sharing.js, then Firebase Functions.
Do not break any existing functionality.