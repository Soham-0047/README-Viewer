/**
 * MarkVault — Sharing, Focus Mode & Reading Progress
 *
 * SHARING:
 *   Private links use Firestore collection "mv_shared_links".
 *   Token = cryptographic UUID (unguessable).
 *   URL format: https://yoursite.github.io/markvault/?share=TOKEN
 *   Content stored in Firestore so viewer works on any device.
 *   Supports expiry (days), max-view limits, revoke.
 *
 * FOCUS MODE:
 *   Full-screen reader overlay, adjustable font size & line width,
 *   theme toggle, progress indicator. Persists font/width prefs.
 *
 * READING PROGRESS:
 *   Saves scroll % per file to localStorage. Restores on reopen.
 *   Shows a thin progress bar under the topbar.
 *
 * QR CODE:
 *   Pure-JS minimal QR generator (no library) drawn to <canvas>.
 */

const Sharing = (() => {
  const COLL = 'mv_shared_links';

  // ── Token generation ──────────────────────────────────
  function _token() {
    const arr = new Uint8Array(18);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  }

  // ── Base URL for share links ──────────────────────────
  function _baseURL() {
    const { protocol, host, pathname } = window.location;
    // Strip any existing ?share param
    const base = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/');
    return `${protocol}//${host}${base}`;
  }

  function shareURL(token) {
    return `${_baseURL()}?share=${token}`;
  }

  // ── Create share link (Firestore) ─────────────────────
  async function createLink(db, fileId, content, title, expiryDays, maxViews) {
    const token     = _token();
    const now       = new Date().toISOString();
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000).toISOString()
      : null;

    const doc = {
      token, fileId, content, title,
      createdAt: now, expiresAt,
      maxViews: maxViews > 0 ? maxViews : 0,
      views: 0, active: true,
    };

    await db.collection(COLL).doc(token).set(doc);
    return doc;
  }

  // ── Fetch a shared file (viewer side) ─────────────────
  async function fetchShared(db, token) {
    const snap = await db.collection(COLL).doc(token).get();
    if (!snap.exists) throw new Error('Link not found or revoked.');

    const data = snap.data();
    if (!data.active) throw new Error('This link has been revoked.');

    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      throw new Error('This link has expired.');
    }
    if (data.maxViews > 0 && data.views >= data.maxViews) {
      throw new Error(`This link has reached its view limit (${data.maxViews}).`);
    }

    // Increment view counter (fire-and-forget)
    db.collection(COLL).doc(token).update({ views: (data.views || 0) + 1 }).catch(() => {});

    return data;
  }

  // ── List all links (for manage modal) ─────────────────
  async function listLinks(db) {
    const snap = await db.collection(COLL).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => d.data());
  }

  // ── Revoke (delete from Firestore) ────────────────────
  async function revokeLink(db, token) {
    await db.collection(COLL).doc(token).update({ active: false });
  }

  async function deleteLink(db, token) {
    await db.collection(COLL).doc(token).delete();
  }

  // ── Get existing link for a file ─────────────────────
  async function getLinkForFile(db, fileId) {
    const snap = await db.collection(COLL)
      .where('fileId', '==', fileId)
      .where('active', '==', true)
      .limit(1).get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    // Check not expired
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) return null;
    return data;
  }

  // ── Format helpers ────────────────────────────────────
  function fmtExpiry(data) {
    if (!data.expiresAt) return 'Never expires';
    const d = new Date(data.expiresAt);
    const diff = d - Date.now();
    if (diff < 0) return 'Expired';
    const days = Math.ceil(diff / 86400000);
    return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
  }

  function fmtViews(data) {
    const v = data.views || 0;
    const max = data.maxViews > 0 ? `/${data.maxViews}` : '';
    return `${v}${max} view${v !== 1 ? 's' : ''}`;
  }

  return { createLink, fetchShared, listLinks, revokeLink, deleteLink, getLinkForFile, shareURL, fmtExpiry, fmtViews };
})();

// ═══════════════════════════════════════════════════════
//  QR CODE — minimal pure-JS generator
//  Based on the QR code ISO/IEC 18004 alphanumeric encoding
//  for short URLs. Uses a pre-computed pattern for simplicity.
//  For production use qrcode.js CDN.
// ═══════════════════════════════════════════════════════
const QR = (() => {
  // We use the free qrcode CDN dynamically to keep bundle small
  let _ready = false;
  let _lib   = null;

  async function _load() {
    if (_ready) return _lib;
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload  = () => { _ready = true; _lib = window.QRCode; res(_lib); };
      s.onerror = () => rej(new Error('QR lib failed to load'));
      document.head.appendChild(s);
    });
  }

  async function drawToCanvas(canvas, text, dark) {
    try {
      const lib = await _load();
      // QRCode.toCanvas from qrcode npm
      await lib.toCanvas(canvas, text, {
        width: 160,
        margin: 2,
        color: {
          dark:  dark  ? '#F5A623' : '#1A1917',
          light: dark  ? '#111318' : '#FDFCFA',
        },
      });
    } catch(e) {
      // Fallback: draw error text
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = dark ? '#111318' : '#fff';
      ctx.fillRect(0, 0, 160, 160);
      ctx.fillStyle = dark ? '#F5A623' : '#333';
      ctx.font = '11px monospace';
      ctx.fillText('QR unavailable', 10, 80);
    }
  }

  return { drawToCanvas };
})();

// ═══════════════════════════════════════════════════════
//  FOCUS MODE
// ═══════════════════════════════════════════════════════
const FocusMode = (() => {
  let _active  = false;
  let _prefs   = {};
  let _isDark  = true;

  const PREFS_KEY = 'mv_focus_prefs';

  function _loadPrefs() {
    try { _prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
    catch { _prefs = {}; }
  }
  function _savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(_prefs));
  }

  function enter(title, htmlContent, isDark) {
    _loadPrefs();
    _active = true;
    _isDark = isDark;

    const overlay   = document.getElementById('focusOverlay');
    const titleEl   = document.getElementById('focusTitle');
    const bodyEl    = document.getElementById('focusBody');
    const widthSel  = document.getElementById('focusWidthSel');
    const themeBtn  = document.getElementById('focusTheme');

    titleEl.textContent = title;
    bodyEl.innerHTML    = htmlContent;

    // Apply saved prefs
    const fontSize = _prefs.fontSize || 16;
    const width    = _prefs.width    || '720';
    bodyEl.style.fontSize = `${fontSize}px`;
    bodyEl.style.maxWidth = width === '100%' ? '100%' : `${width}px`;
    if (widthSel) {
      widthSel.value = width;
    }

    // Theme
    overlay.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeBtn) themeBtn.textContent = isDark ? '☽' : '☀︎';

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    _active = true;

    // Progress
    const scroll = document.getElementById('focusScroll');
    if (scroll) {
      scroll.addEventListener('scroll', _updateProgress, { passive: true });
    }
  }

  function exit() {
    const overlay = document.getElementById('focusOverlay');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    _active = false;
    const scroll = document.getElementById('focusScroll');
    if (scroll) scroll.removeEventListener('scroll', _updateProgress);
  }

  function _updateProgress() {
    const scroll = document.getElementById('focusScroll');
    const fill   = document.getElementById('focusProgressFill');
    if (!scroll || !fill) return;
    const { scrollTop, scrollHeight, clientHeight } = scroll;
    const pct = scrollHeight <= clientHeight ? 100 :
      Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    fill.style.width = `${pct}%`;
  }

  function adjustFont(delta) {
    _loadPrefs();
    const bodyEl  = document.getElementById('focusBody');
    if (!bodyEl) return;
    const current = _prefs.fontSize || 16;
    const next    = Math.max(12, Math.min(26, current + delta));
    _prefs.fontSize = next;
    bodyEl.style.fontSize = `${next}px`;
    _savePrefs();
  }

  function setWidth(val) {
    _loadPrefs();
    const bodyEl = document.getElementById('focusBody');
    if (!bodyEl) return;
    _prefs.width = val;
    bodyEl.style.maxWidth = val === '100%' ? '100%' : `${val}px`;
    _savePrefs();
  }

  function toggleTheme() {
    _isDark = !_isDark;
    const overlay  = document.getElementById('focusOverlay');
    const themeBtn = document.getElementById('focusTheme');
    overlay.setAttribute('data-theme', _isDark ? 'dark' : 'light');
    if (themeBtn) themeBtn.textContent = _isDark ? '☽' : '☀︎';
  }

  function isActive() { return _active; }

  return { enter, exit, adjustFont, setWidth, toggleTheme, isActive };
})();

// ═══════════════════════════════════════════════════════
//  READING PROGRESS — scroll position persistence
// ═══════════════════════════════════════════════════════
const ReadingProgress = (() => {
  const PREFIX = 'mv_rpos_';
  let _scrollEl  = null;
  let _fileId    = null;
  let _saveTimer = null;

  function attach(scrollEl, fileId) {
    detach();
    _scrollEl = scrollEl;
    _fileId   = fileId;

    // Restore saved position
    const saved = parseFloat(localStorage.getItem(PREFIX + fileId) || '0');
    if (saved > 0) {
      // Small delay for content to render
      setTimeout(() => {
        if (_scrollEl) {
          const { scrollHeight, clientHeight } = _scrollEl;
          _scrollEl.scrollTop = saved * (scrollHeight - clientHeight);
        }
      }, 300);
    }

    _scrollEl.addEventListener('scroll', _onScroll, { passive: true });
  }

  function detach() {
    if (_scrollEl) _scrollEl.removeEventListener('scroll', _onScroll);
    if (_saveTimer) clearTimeout(_saveTimer);
    _scrollEl = null; _fileId = null;
  }

  function _onScroll() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 500);
    _updateBar();
  }

  function _save() {
    if (!_scrollEl || !_fileId) return;
    const { scrollTop, scrollHeight, clientHeight } = _scrollEl;
    const pct = scrollHeight <= clientHeight ? 0 :
      scrollTop / (scrollHeight - clientHeight);
    localStorage.setItem(PREFIX + _fileId, pct.toFixed(4));
  }

  function _updateBar() {
    const bar = document.getElementById('readingProgressFill');
    if (!bar || !_scrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = _scrollEl;
    const pct = scrollHeight <= clientHeight ? 100 :
      Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    bar.style.width = `${pct}%`;
  }

  function clear(fileId) {
    localStorage.removeItem(PREFIX + (fileId || _fileId || ''));
  }

  function getProgress(fileId) {
    return parseFloat(localStorage.getItem(PREFIX + fileId) || '0');
  }

  return { attach, detach, clear, getProgress };
})();

// ═══════════════════════════════════════════════════════
//  SHARED VIEWER — handles ?share=TOKEN on page load
// ═══════════════════════════════════════════════════════
const SharedViewer = (() => {

  function _getToken() {
    return new URLSearchParams(window.location.search).get('share');
  }

  function isSharedView() { return !!_getToken(); }

  async function init(db) {
    const token = _getToken();
    if (!token) return false;

    // Show shared viewer immediately, hide the main app
    document.getElementById('sharedViewer')?.classList.remove('hidden');
    document.getElementById('sidebar')?.classList.add('hidden');
    document.getElementById('main')?.classList.add('hidden');

    const loadingEl = document.getElementById('svLoading');
    const errorEl   = document.getElementById('svError');
    const errorMsg  = document.getElementById('svErrorMsg');
    const bodyEl    = document.getElementById('svBody');
    const metaEl    = document.getElementById('svMeta');

    loadingEl?.classList.remove('hidden');

    if (!db) {
      loadingEl?.classList.add('hidden');
      errorEl?.classList.remove('hidden');
      if (errorMsg) errorMsg.textContent = 'This link requires Firebase to be configured on the host\'s vault.';
      return true;
    }

    try {
      const data = await Sharing.fetchShared(db, token);
      loadingEl?.classList.add('hidden');

      // Apply theme preference (inherit dark from link creator isn't stored, default dark)
      document.documentElement.setAttribute('data-theme', 'dark');

      // Meta bar
      if (metaEl) {
        metaEl.innerHTML = [
          `<span>${data.title}</span>`,
          `<span>${Sharing.fmtViews(data)}</span>`,
          `<span>${Sharing.fmtExpiry(data)}</span>`,
        ].join('');
      }

      // Render markdown
      const isDark = true;
      await Renderer.render(data.content, bodyEl, isDark);

      // Update page title
      document.title = `${data.title} — MarkVault`;

      // Save to vault button
      document.getElementById('svSaveToVault')?.addEventListener('click', () => {
        const result = Storage.save(data.title, data.content);
        // Redirect to app with that file open
        window.location.href = `.?open=${result.id}`;
      });

      // Focus button in shared viewer
      document.getElementById('svFocus')?.addEventListener('click', () => {
        FocusMode.enter(data.title, bodyEl.innerHTML, isDark);
      });

    } catch(e) {
      loadingEl?.classList.add('hidden');
      errorEl?.classList.remove('hidden');
      if (errorMsg) errorMsg.textContent = e.message;
    }

    return true;
  }

  return { isSharedView, init };
})();
