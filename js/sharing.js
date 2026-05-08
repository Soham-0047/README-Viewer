/**
 * MarkVault — Sharing, Focus Mode, Reading Progress
 *
 * SHARED VIEWER CHANGE:
 *   Share URLs now embed the Firebase projectId:
 *   ?share=TOKEN&pid=PROJECT_ID
 *
 *   The viewer uses the Firestore REST API (no SDK, no auth needed)
 *   to fetch the link doc. Firestore security rules allow:
 *     match /mv_shared_links/{token} { allow read: if true; }
 *   So recipients can view WITHOUT logging in or having any Firebase config.
 *
 *   View tracking also uses REST API (PATCH) — fire-and-forget.
 *
 * ADMIN ANALYTICS:
 *   listLinks() returns per-link stats: views, unique sessions, referrers.
 *   Viewer fingerprint stored in sessionStorage to deduplicate page reloads.
 */

const Sharing = (() => {
  const COLL = 'mv_shared_links';

  function _token() {
    const arr = new Uint8Array(18);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  }

  function _baseURL() {
    const { protocol, host, pathname } = window.location;
    const base = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/');
    return `${protocol}//${host}${base}`;
  }

  // Share URL now includes ?pid=PROJECT_ID so viewers can fetch without SDK
  function shareURL(token, projectId) {
    const pid = projectId || _getProjectId();
    return `${_baseURL()}?share=${token}${pid ? '&pid=' + encodeURIComponent(pid) : ''}`;
  }

  function _getProjectId() {
    try {
      const saved = localStorage.getItem('MV2_firebase_config');
      if (saved) return JSON.parse(saved).projectId || '';
    } catch {}
    return '';
  }

  // ── Firestore REST API (no SDK, no auth, works for public docs) ──
  // Used by the shared viewer so recipients need ZERO setup
  const _REST = (projectId) =>
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  async function _restGet(projectId, collection, docId) {
    const url  = `${_REST(projectId)}/${collection}/${docId}`;
    const resp = await fetch(url);
    if (resp.status === 404) throw new Error('Link not found or revoked.');
    if (!resp.ok)            throw new Error(`Firestore error ${resp.status}`);
    const json = await resp.json();
    return _fromFirestore(json.fields || {});
  }

  async function _restPatch(projectId, collection, docId, fields) {
    // Increment view counter — fire-and-forget, no auth needed for public write rules
    const url    = `${_REST(projectId)}/${collection}/${docId}`;
    const body   = { fields: _toFirestore(fields) };
    const params = new URLSearchParams();
    Object.keys(fields).forEach(k => params.append('updateMask.fieldPaths', k));
    await fetch(`${url}?${params}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }).catch(() => {}); // truly fire-and-forget
  }

  // Firestore REST response → plain JS object
  function _fromFirestore(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
      if      ('stringValue'  in v) out[k] = v.stringValue;
      else if ('integerValue' in v) out[k] = parseInt(v.integerValue);
      else if ('doubleValue'  in v) out[k] = v.doubleValue;
      else if ('booleanValue' in v) out[k] = v.booleanValue;
      else if ('nullValue'    in v) out[k] = null;
      else if ('arrayValue'   in v) out[k] = (v.arrayValue.values || []).map(x => _fromFirestore({_:x})._);
      else if ('mapValue'     in v) out[k] = _fromFirestore(v.mapValue.fields || {});
    }
    return out;
  }

  // Plain JS object → Firestore REST fields
  function _toFirestore(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if      (typeof v === 'string')  out[k] = { stringValue: v };
      else if (typeof v === 'number' && Number.isInteger(v)) out[k] = { integerValue: String(v) };
      else if (typeof v === 'number')  out[k] = { doubleValue: v };
      else if (typeof v === 'boolean') out[k] = { booleanValue: v };
      else if (v === null)             out[k] = { nullValue: null };
    }
    return out;
  }

  // ── Create link (uses SDK — owner is authenticated) ──
  async function createLink(db, fileId, content, title, expiryDays, maxViews) {
    const projectId = _getProjectId();
    const token     = _token();
    const now       = new Date().toISOString();
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000).toISOString()
      : null;

    const doc = {
      token, fileId, content, title, projectId,
      createdAt: now, expiresAt,
      maxViews: maxViews > 0 ? maxViews : 0,
      views: 0, uniqueViews: 0,
      active: true,
    };

    await db.collection(COLL).doc(token).set(doc);
    return doc;
  }

  // ── Fetch shared doc — uses REST so works without any auth ──
  async function fetchSharedPublic(token, projectId) {
    if (!projectId) throw new Error('Missing project ID in share URL. Ask the owner to reshare.');

    const data = await _restGet(projectId, COLL, token);

    if (!data.active)   throw new Error('This link has been revoked.');
    if (data.expiresAt && new Date(data.expiresAt) < new Date())
      throw new Error('This link has expired.');
    if (data.maxViews > 0 && data.views >= data.maxViews)
      throw new Error(`This link has reached its view limit (${data.maxViews} views).`);

    // Track view — deduplicated per browser session
    const sessionKey = `mv_viewed_${token}`;
    const alreadySeen = sessionStorage.getItem(sessionKey);
    if (!alreadySeen) {
      sessionStorage.setItem(sessionKey, '1');
      const newViews = (data.views || 0) + 1;
      // Increment both total and unique views
      const newUnique = (data.uniqueViews || 0) + 1;
      _restPatch(projectId, COLL, token, { views: newViews, uniqueViews: newUnique });
      data.views       = newViews;
      data.uniqueViews = newUnique;
    }

    data.projectId = projectId;
    return data;
  }

  // ── Fetch using SDK (owner side — faster, has auth) ──
  async function fetchShared(db, token) {
    const snap = await db.collection(COLL).doc(token).get();
    if (!snap.exists) throw new Error('Link not found or revoked.');
    const data = snap.data();
    if (!data.active) throw new Error('This link has been revoked.');
    if (data.expiresAt && new Date(data.expiresAt) < new Date())
      throw new Error('This link has expired.');
    if (data.maxViews > 0 && data.views >= data.maxViews)
      throw new Error(`This link has reached its view limit (${data.maxViews}).`);
    return data;
  }

  // ── List all links with full analytics ──
  async function listLinks(db) {
    const snap = await db.collection(COLL).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => d.data());
  }

  // ── Analytics summary across all links ──
  async function getAnalytics(db) {
    const links = await listLinks(db);
    const totalViews  = links.reduce((s,l) => s + (l.views || 0), 0);
    const totalUnique = links.reduce((s,l) => s + (l.uniqueViews || 0), 0);
    const activeLinks = links.filter(l => l.active && (!l.expiresAt || new Date(l.expiresAt) > new Date()));
    const topLink     = [...links].sort((a,b) => (b.views||0) - (a.views||0))[0] || null;
    return { links, totalViews, totalUnique, activeLinks: activeLinks.length, topLink };
  }

  async function revokeLink(db, token) {
    await db.collection(COLL).doc(token).update({ active: false });
  }
  async function deleteLink(db, token) {
    await db.collection(COLL).doc(token).delete();
  }
  async function getLinkForFile(db, fileId) {
    const snap = await db.collection(COLL)
      .where('fileId', '==', fileId)
      .where('active', '==', true)
      .limit(1).get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) return null;
    return data;
  }

  function fmtExpiry(data) {
    if (!data.expiresAt) return 'Never expires';
    const diff = new Date(data.expiresAt) - Date.now();
    if (diff < 0) return 'Expired';
    const days = Math.ceil(diff / 86400000);
    return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
  }
  function fmtViews(data) {
    const v   = data.views || 0;
    const u   = data.uniqueViews || 0;
    const max = data.maxViews > 0 ? `/${data.maxViews}` : '';
    return `${v}${max} view${v !== 1 ? 's' : ''} · ${u} unique`;
  }

  return {
    createLink, fetchShared, fetchSharedPublic,
    listLinks, getAnalytics,
    revokeLink, deleteLink, getLinkForFile,
    shareURL, fmtExpiry, fmtViews,
  };
})();

// ═══════════════════════════════════════════════════════
//  QR CODE
// ═══════════════════════════════════════════════════════
const QR = (() => {
  let _ready = false;
  async function _load() {
    if (_ready) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload = () => { _ready = true; res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function drawToCanvas(canvas, text, dark) {
    try {
      await _load();
      await QRCode.toCanvas(canvas, text, {
        width: 160, margin: 2,
        color: {
          dark:  dark ? '#F5A623' : '#1A1917',
          light: dark ? '#111318' : '#FDFCFA',
        },
      });
    } catch {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = dark ? '#111318' : '#fff';
      ctx.fillRect(0,0,160,160);
    }
  }
  return { drawToCanvas };
})();

// ═══════════════════════════════════════════════════════
//  FOCUS MODE
// ═══════════════════════════════════════════════════════
const FocusMode = (() => {
  let _active = false, _isDark = true;
  const PREFS_KEY = 'mv_focus_prefs';
  function _p()  { try { return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}'); } catch { return {}; } }
  function _sp() { localStorage.setItem(PREFS_KEY, JSON.stringify(_p())); }

  function enter(title, html, isDark) {
    const prefs = _p();
    _active = true; _isDark = isDark;
    const overlay  = document.getElementById('focusOverlay');
    const body     = document.getElementById('focusBody');
    const titleEl  = document.getElementById('focusTitle');
    const widthSel = document.getElementById('focusWidthSel');
    const themeBtn = document.getElementById('focusTheme');
    if (!overlay || !body) return;
    titleEl && (titleEl.textContent = title);
    body.innerHTML = html;
    const fs = prefs.fontSize || 16;
    const w  = prefs.width    || '720';
    body.style.fontSize = `${fs}px`;
    body.style.maxWidth = w === '100%' ? '100%' : `${w}px`;
    if (widthSel) widthSel.value = w;
    overlay.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeBtn) themeBtn.textContent = isDark ? '☽' : '☀︎';
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const scroll = document.getElementById('focusScroll');
    scroll?.addEventListener('scroll', _prog, { passive: true });
  }
  function exit() {
    document.getElementById('focusOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
    _active = false;
    document.getElementById('focusScroll')?.removeEventListener('scroll', _prog);
  }
  function _prog() {
    const s = document.getElementById('focusScroll');
    const f = document.getElementById('focusProgressFill');
    if (!s || !f) return;
    const pct = s.scrollHeight <= s.clientHeight ? 100
      : Math.round((s.scrollTop / (s.scrollHeight - s.clientHeight)) * 100);
    f.style.width = `${pct}%`;
  }
  function adjustFont(d) {
    const p = _p(); const b = document.getElementById('focusBody'); if (!b) return;
    p.fontSize = Math.max(12, Math.min(26, (p.fontSize||16) + d));
    b.style.fontSize = `${p.fontSize}px`;
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  }
  function setWidth(v) {
    const p = _p(); const b = document.getElementById('focusBody'); if (!b) return;
    p.width = v;
    b.style.maxWidth = v === '100%' ? '100%' : `${v}px`;
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  }
  function toggleTheme() {
    _isDark = !_isDark;
    document.getElementById('focusOverlay')?.setAttribute('data-theme', _isDark ? 'dark' : 'light');
    const btn = document.getElementById('focusTheme');
    if (btn) btn.textContent = _isDark ? '☽' : '☀︎';
  }
  function isActive() { return _active; }
  return { enter, exit, adjustFont, setWidth, toggleTheme, isActive };
})();

// ═══════════════════════════════════════════════════════
//  READING PROGRESS
// ═══════════════════════════════════════════════════════
const ReadingProgress = (() => {
  const PFX = 'mv_rpos_';
  let _el=null, _id=null, _t=null;
  function attach(el, id) {
    detach();
    _el=el; _id=id;
    const saved = parseFloat(localStorage.getItem(PFX+id)||'0');
    if (saved > 0) setTimeout(() => {
      if (_el) {
        const {scrollHeight,clientHeight} = _el;
        _el.scrollTop = saved * (scrollHeight - clientHeight);
      }
    }, 300);
    _el.addEventListener('scroll', _onScroll, { passive:true });
  }
  function detach() {
    if (_el) _el.removeEventListener('scroll', _onScroll);
    if (_t)  clearTimeout(_t);
    _el=null; _id=null;
  }
  function _onScroll() {
    if (_t) clearTimeout(_t);
    _t = setTimeout(_save, 500);
    _updateBar();
  }
  function _save() {
    if (!_el||!_id) return;
    const {scrollTop,scrollHeight,clientHeight} = _el;
    const pct = scrollHeight<=clientHeight ? 0 : scrollTop/(scrollHeight-clientHeight);
    localStorage.setItem(PFX+_id, pct.toFixed(4));
  }
  function _updateBar() {
    const bar = document.getElementById('readingProgressFill');
    if (!bar||!_el) return;
    const {scrollTop,scrollHeight,clientHeight} = _el;
    const pct = scrollHeight<=clientHeight ? 100
      : Math.round((scrollTop/(scrollHeight-clientHeight))*100);
    bar.style.width = `${pct}%`;
  }
  function clear(id) { localStorage.removeItem(PFX+(id||_id||'')); }
  function getProgress(id) { return parseFloat(localStorage.getItem(PFX+id)||'0'); }
  return { attach, detach, clear, getProgress };
})();

// ═══════════════════════════════════════════════════════
//  SHARED VIEWER — no login needed for recipients
// ═══════════════════════════════════════════════════════
const SharedViewer = (() => {

  function _getToken() { return new URLSearchParams(window.location.search).get('share'); }
  function _getPid()   { return new URLSearchParams(window.location.search).get('pid') || ''; }

  function isSharedView() { return !!_getToken(); }

  async function init() {
    const token = _getToken();
    const pid   = _getPid();
    if (!token) return false;

    // Hide the main app UI immediately
    document.getElementById('sharedViewer')?.classList.remove('hidden');
    document.getElementById('authGate')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.add('hidden');
    document.getElementById('main')?.classList.add('hidden');

    const loadingEl = document.getElementById('svLoading');
    const errorEl   = document.getElementById('svError');
    const errorMsg  = document.getElementById('svErrorMsg');
    const bodyEl    = document.getElementById('svBody');
    const metaEl    = document.getElementById('svMeta');

    loadingEl?.classList.remove('hidden');

    if (!pid) {
      _showError(errorMsg, errorEl, loadingEl,
        'This link is missing required information. Ask the owner to generate a new share link.');
      return true;
    }

    try {
      // Uses pure REST — no Firebase SDK, no login required
      const data = await Sharing.fetchSharedPublic(token, pid);
      loadingEl?.classList.add('hidden');

      document.documentElement.setAttribute('data-theme', 'dark');
      document.title = `${data.title} — MarkVault`;

      if (metaEl) {
        metaEl.innerHTML = [
          `<span title="Document title"><strong>${_esc(data.title)}</strong></span>`,
          `<span title="Total views">${data.views || 0} view${data.views !== 1 ? 's' : ''}</span>`,
          `<span title="Link status">${Sharing.fmtExpiry(data)}</span>`,
        ].join('');
      }

      if (bodyEl) await Renderer.render(data.content, bodyEl, true);

      document.getElementById('svSaveToVault')?.addEventListener('click', () => {
        Storage.save(data.title, data.content);
        toast('Saved to your vault!', 'success');
        setTimeout(() => { window.location.href = './'; }, 1200);
      });

      document.getElementById('svFocus')?.addEventListener('click', () => {
        FocusMode.enter(data.title, bodyEl?.innerHTML || '', true);
      });

    } catch(e) {
      _showError(errorMsg, errorEl, loadingEl, e.message);
    }

    return true;
  }

  function _showError(msgEl, errEl, loadEl, msg) {
    loadEl?.classList.add('hidden');
    errEl?.classList.remove('hidden');
    if (msgEl) msgEl.textContent = msg;
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function toast(msg, type) {
    const tc = document.getElementById('toastContainer');
    if (!tc) return;
    const t = document.createElement('div');
    t.className = `toast ${type||'info'}`;
    t.innerHTML = `<span class="toast-indicator"></span><span>${msg}</span>`;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  return { isSharedView, init };
})();