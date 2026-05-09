/**
 * MarkVault — Subscription / Monetization
 *
 * Loaded AFTER storage.js. All feature gates resolve against a live remote
 * config in Firestore (`mv_config/features`) with a 10-min localStorage cache
 * and hardcoded defaults as a final fallback so the app NEVER breaks if
 * Firestore is unreachable.
 *
 * Public API (used by app.js):
 *   Subscription.init()                        → boot (non-blocking)
 *   Subscription.isPro()                       → bool
 *   Subscription.isOwner()                     → bool (owner_uid match)
 *   Subscription.getConfig(key)                → live config value
 *   Subscription.canUseAI()                    → { allowed, used, limit, reason }
 *   Subscription.canUseAITool(toolId)
 *   Subscription.canCreateFile(currentCount)
 *   Subscription.canCreateShareLink(currentCount)
 *   Subscription.canUsePremiumLinks()
 *   Subscription.canUsePDFDatalab()
 *   Subscription.canUseTemplate(id)
 *   Subscription.canUseFullAnalytics()
 *   Subscription.incrementUsage(metric)
 *   Subscription.getUsageToday(metric)
 *   Subscription.getTrialDaysLeft()
 *   Subscription.startCheckout(billing)
 *   Subscription.openCustomerPortal()
 *   Subscription.onChange(cb)                  → subscribe to status/config updates
 */

const Subscription = (() => {

  const CONFIG_CACHE_KEY = 'mv_config_cache';
  const CONFIG_CACHE_TTL = 10 * 60 * 1000;          // 10 min
  const USAGE_LOCAL_KEY  = (date) => `mv_usage_${date}`;

  let _config = null;
  let _status = null;
  let _unsubConfig = null;
  let _unsubStatus = null;
  let _listeners = new Set();
  const _shownReasons = new Set();                  // session-scoped

  // Hardcoded defaults — used only if Firestore + cache are both unavailable
  const DEFAULTS = {
    ai_requests_per_day_free:    5,
    ai_requests_per_day_pro:    -1,
    ai_tools_free:               ['improve','fixgrammar'],
    ai_tools_pro:                ['improve','simplify','expand','shorten','fixgrammar','formal','casual','bullets','table','summarize','translate'],
    ai_chat_free:                true,
    ai_chat_pro:                 true,
    ai_summary_free:             true,
    ai_summary_pro:              true,
    pdf_algo_free:               true,
    pdf_datalab_free:            false,
    pdf_gemini_free:             true,
    pdf_datalab_pro:             true,
    sharing_max_links_free:      3,
    sharing_max_links_pro:      -1,
    sharing_premium_links_free:  false,
    sharing_premium_links_pro:   true,
    sharing_analytics_free:      'basic',
    sharing_analytics_pro:       'full',
    files_max_free:              20,
    files_max_pro:              -1,
    templates_free:              ['blank','meeting','readme'],
    templates_pro:               ['blank','meeting','readme','blog','api-docs','weekly-review','research','decision','changelog'],
    split_pane_free:             true,
    focus_mode_free:             true,
    export_html_free:            true,
    export_pdf_free:             false,
    export_pdf_pro:              true,
    cloud_sync_free:             true,
    cloud_sync_device_limit_free: 1,
    cloud_sync_device_limit_pro: -1,
    pro_price_monthly:           5,
    pro_price_yearly:            45,
    pro_trial_days:              7,
    stripe_price_id_monthly:     '',
    stripe_price_id_yearly:      '',
    stripe_publishable_key:      '',
    paywall_preview_lines:       80,
    upgrade_modal_show_after_days: 3,
    owner_uid:                   '',
  };

  // ── Helpers ──────────────────────────────────────────
  const today = () => new Date().toISOString().slice(0,10);
  function _emit() { _listeners.forEach(cb => { try { cb(); } catch {} }); }

  function _readCachedConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG_CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }
  function _writeCachedConfig(data) {
    try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  // ── Config ───────────────────────────────────────────
  async function loadConfig() {
    // 1. Cached value first (instant UI)
    const cached = _readCachedConfig();
    if (cached) _config = { ...DEFAULTS, ...cached };
    else _config = { ...DEFAULTS };

    // 2. Live Firestore fetch + listener (auth NOT required — read is public)
    if (typeof Storage === 'undefined' || !Storage.isConnected()) return _config;
    const ref = Storage.configRef();
    if (!ref) return _config;

    try {
      // One-shot snapshot for fast first paint
      const snap = await ref.get();
      if (snap.exists) {
        _config = { ...DEFAULTS, ...snap.data() };
        _writeCachedConfig(snap.data());
      }
    } catch (e) {
      console.warn('[Sub] config fetch:', e.message);
    }

    // Live updates — admin changes propagate within seconds
    if (_unsubConfig) { try { _unsubConfig(); } catch {} _unsubConfig = null; }
    try {
      _unsubConfig = ref.onSnapshot(s => {
        if (!s.exists) return;
        _config = { ...DEFAULTS, ...s.data() };
        _writeCachedConfig(s.data());
        _emit();
      }, err => console.warn('[Sub] config listener:', err.message));
    } catch {}

    return _config;
  }

  function getConfig(key) {
    if (key === undefined) return { ..._config };
    return _config?.[key] ?? DEFAULTS[key];
  }

  // ── Subscription status ──────────────────────────────
  async function loadStatus() {
    if (!Storage.isSignedIn()) {
      _status = { plan:'free', status:'none' };
      return _status;
    }
    try {
      _status = await Storage.getSubscriptionStatus();
    } catch { _status = { plan:'free', status:'none' }; }

    // Live updates so users get instant Pro after webhook fires
    if (_unsubStatus) { try { _unsubStatus(); } catch {} _unsubStatus = null; }
    const ref = Storage.subscriptionStatusRef();
    if (ref) {
      try {
        _unsubStatus = ref.onSnapshot(s => {
          _status = s.exists ? s.data() : { plan:'free', status:'none' };
          _emit();
        }, err => console.warn('[Sub] status listener:', err.message));
      } catch {}
    }
    return _status;
  }

  function isPro() {
    return _status?.status === 'active' || _status?.status === 'trialing';
  }
  function isOwner() {
    const uid = Storage.getCurrentUser()?.uid;
    return !!uid && uid === getConfig('owner_uid');
  }
  function getStatus() { return { ..._status }; }
  function getTrialDaysLeft() {
    if (_status?.status !== 'trialing' || !_status?.trialEnd) return 0;
    const diff = new Date(_status.trialEnd) - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  // ── Usage tracking (localStorage + Firestore mirror) ──
  function _readLocalUsage(date) {
    try { return JSON.parse(localStorage.getItem(USAGE_LOCAL_KEY(date)) || '{}'); }
    catch { return {}; }
  }
  function _writeLocalUsage(date, data) {
    try { localStorage.setItem(USAGE_LOCAL_KEY(date), JSON.stringify(data)); } catch {}
  }

  async function getUsageToday(metric) {
    const date = today();
    const local = _readLocalUsage(date);
    return Number(local[metric] || 0);
  }

  async function incrementUsage(metric, by = 1) {
    const date  = today();
    const local = _readLocalUsage(date);
    local[metric] = Number(local[metric] || 0) + by;
    local.date = date;
    _writeLocalUsage(date, local);

    // Mirror to Firestore (best-effort)
    const ref = Storage.userUsageRef(date);
    if (ref && firebase?.firestore?.FieldValue) {
      try {
        await ref.set({
          [metric]: firebase.firestore.FieldValue.increment(by),
          date,
        }, { merge: true });
      } catch (e) { console.warn('[Sub] usage mirror:', e.message); }
    }
    _emit();
    return local[metric];
  }

  // ── Feature gates (return { allowed, reason, limit, used, upgradeReason }) ──
  async function canUseAI() {
    if (isPro()) return { allowed: true };
    const limit = getConfig('ai_requests_per_day_free');
    if (limit === -1) return { allowed: true };
    const used = await getUsageToday('ai_requests');
    return {
      allowed: used < limit,
      reason: `Free plan: ${limit} AI requests/day`,
      limit, used,
      upgradeReason: 'ai',
    };
  }

  function canUseAITool(toolId) {
    if (isPro()) return { allowed: true };
    const free = getConfig('ai_tools_free') || [];
    return {
      allowed: free.includes(toolId),
      reason: `"${toolId}" is a Pro writing tool`,
      upgradeReason: 'writing_tools',
    };
  }

  function canCreateFile(currentCount) {
    if (isPro()) return { allowed: true };
    const limit = getConfig('files_max_free');
    if (limit === -1) return { allowed: true };
    return {
      allowed: currentCount < limit,
      reason: `Free plan: ${limit} files max`,
      limit, used: currentCount,
      upgradeReason: 'files',
    };
  }

  function canCreateShareLink(currentLinkCount) {
    if (isPro()) return { allowed: true };
    const limit = getConfig('sharing_max_links_free');
    if (limit === -1) return { allowed: true };
    return {
      allowed: currentLinkCount < limit,
      reason: `Free plan: ${limit} active share links`,
      limit, used: currentLinkCount,
      upgradeReason: 'sharing',
    };
  }

  function canUsePremiumLinks() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('sharing_premium_links_free') === true,
      reason: 'Premium share links require Pro',
      upgradeReason: 'premium_links',
    };
  }

  function canUsePDFDatalab() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('pdf_datalab_free') === true,
      reason: 'Datalab PDF conversion requires Pro',
      upgradeReason: 'pdf',
    };
  }

  function canUseTemplate(templateId) {
    if (isPro()) return { allowed: true };
    const free = getConfig('templates_free') || [];
    return {
      allowed: free.includes(templateId),
      reason: 'This template requires Pro',
      upgradeReason: 'templates',
    };
  }

  function canUseFullAnalytics() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('sharing_analytics_free') === 'full',
      reason: 'Full analytics requires Pro',
      upgradeReason: 'analytics',
    };
  }

  function canExportPDF() {
    if (isPro()) return { allowed: true };
    return {
      allowed: getConfig('export_pdf_free') === true,
      reason: 'PDF export requires Pro',
      upgradeReason: 'export_pdf',
    };
  }

  // ── Stripe checkout (calls Firebase callable functions) ──
  async function startCheckout(billing = 'monthly') {
    if (!Storage.isSignedIn()) {
      throw new Error('Please sign in with Google before subscribing.');
    }
    const fn = firebase.app('markvault').functions ? firebase.app('markvault').functions() : null;
    if (!fn) throw new Error('Firebase Functions not available — check your Firebase project.');

    const priceId = billing === 'yearly'
      ? getConfig('stripe_price_id_yearly')
      : getConfig('stripe_price_id_monthly');
    if (!priceId) throw new Error('Stripe is not configured yet (price ID missing).');

    try {
      const callable = fn.httpsCallable('createCheckoutSession');
      const { data } = await callable({
        priceId,
        billing,
        origin: window.location.origin + window.location.pathname,
      });
      const pubKey = getConfig('stripe_publishable_key');
      if (!pubKey || typeof Stripe === 'undefined') throw new Error('Stripe.js not loaded.');
      const stripe = Stripe(pubKey);
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (e) {
      throw new Error(e.message || 'Could not start checkout.');
    }
  }

  async function openCustomerPortal() {
    if (!Storage.isSignedIn()) throw new Error('Sign in first.');
    const fn = firebase.app('markvault').functions ? firebase.app('markvault').functions() : null;
    if (!fn) throw new Error('Firebase Functions not available.');
    const callable = fn.httpsCallable('createPortalSession');
    const { data } = await callable({
      returnUrl: window.location.origin + window.location.pathname,
    });
    if (data?.url) window.location.href = data.url;
  }

  // ── Reason-shown gate (don't spam upgrade modal) ─────
  function markReasonShown(reason) { _shownReasons.add(reason); }
  function wasReasonShown(reason)  { return _shownReasons.has(reason); }

  // ── Public listener API ──────────────────────────────
  function onChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }

  // ── Init (non-blocking) ─────────────────────────────
  async function init() {
    // Always load config and status in parallel; never let a failure block the UI.
    await Promise.all([
      loadConfig().catch(() => {}),
      loadStatus().catch(() => {}),
    ]);

    // Re-load status when auth changes
    if (typeof Storage !== 'undefined' && Storage.onAuthChange) {
      const prev = Storage._authChangeChained;       // chain so we don't override app.js's handler
      // app.js sets onAuthChange too. Instead, use Storage.onChange semantics if any;
      // simplest: piggy-back via window event.
    }

    // Returning from Stripe → refresh status
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === '1') {
      await loadStatus();
      window.history.replaceState({}, '', window.location.pathname);
      _emit();
    }
    _emit();
    return true;
  }

  return {
    init, loadConfig, loadStatus, getConfig, getStatus,
    isPro, isOwner, getTrialDaysLeft,
    incrementUsage, getUsageToday,
    canUseAI, canUseAITool, canCreateFile, canCreateShareLink,
    canUsePremiumLinks, canUsePDFDatalab, canUseTemplate, canUseFullAnalytics,
    canExportPDF,
    startCheckout, openCustomerPortal,
    markReasonShown, wasReasonShown,
    onChange,
  };
})();
