/**
 * MarkVault v2 — Storage Service
 * Dual-layer: localStorage (instant) + Firebase Firestore (cross-device sync)
 *
 * Architecture:
 *   - ALL writes go to localStorage FIRST for instant feedback
 *   - If Firebase is connected, writes also go to Firestore
 *   - On connect, Firestore data is merged with local data (latest-wins per file)
 *   - Real-time listener keeps all tabs/devices in sync automatically
 */

const Storage = (() => {
  // ── Keys ──────────────────────────────────────────────
  const PREFIX   = 'MV2_file_';
  const IDX_KEY  = 'MV2_index';
  const PREF_KEY = 'MV2_prefs';
  const FB_KEY   = 'MV2_firebase_config';
  const COLL     = 'markvault_files';  // Firestore collection

  // ── Firebase state ────────────────────────────────────
  let _db           = null;   // Firestore instance
  let _fbApp        = null;   // Firebase app instance
  let _unsubscribe  = null;   // Firestore real-time listener cleanup
  let _syncStatus   = 'local'; // 'local' | 'connecting' | 'synced' | 'error'
  let _onStatusChange = null; // callback(status, label)
  let _onRemoteChange = null; // callback() — called when remote data arrives

  // ── Helpers ───────────────────────────────────────────
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function _now() { return new Date().toISOString(); }
  function _fmtSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(2)} MB`;
  }
  function _fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  // ── Index (local) ─────────────────────────────────────
  function _getIdx() {
    try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]'); }
    catch { return []; }
  }
  function _saveIdx(idx) {
    localStorage.setItem(IDX_KEY, JSON.stringify(idx));
  }
  function _upsertIdx(meta) {
    const idx = _getIdx();
    const i   = idx.findIndex(x => x.id === meta.id);
    if (i >= 0) idx[i] = meta; else idx.unshift(meta);
    _saveIdx(idx);
  }
  function _removeFromIdx(id) {
    _saveIdx(_getIdx().filter(x => x.id !== id));
  }

  // ── Build file object ─────────────────────────────────
  function _buildFile(id, name, content, existingCreatedAt = null) {
    const bytes = new TextEncoder().encode(content).length;
    const lines = content.split('\n').length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const now   = _now();
    return {
      id, name, content, bytes, lines, words,
      createdAt: existingCreatedAt || now,
      updatedAt: now,
      sizeLabel: _fmtSize(bytes),
    };
  }

  // ── CRUD: Local ───────────────────────────────────────
  function _localSave(file) {
    localStorage.setItem(PREFIX + file.id, JSON.stringify(file));
    const { content:_, ...meta } = file; // strip content from index
    _upsertIdx(meta);
  }
  function _localLoad(id) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id) || 'null'); }
    catch { return null; }
  }
  function _localDel(id) {
    localStorage.removeItem(PREFIX + id);
    _removeFromIdx(id);
  }

  // ── CRUD: Firebase ────────────────────────────────────
  async function _fbSave(file) {
    if (!_db) return;
    try {
      const { content, ...meta } = file;
      // Store content separately to avoid 1MB doc limit edge cases
      await _db.collection(COLL).doc(file.id).set({
        ...meta, content, _v: 2
      });
    } catch(e) {
      console.warn('[MV] Firestore write failed:', e.message);
    }
  }
  async function _fbDel(id) {
    if (!_db) return;
    try { await _db.collection(COLL).doc(id).delete(); }
    catch(e) { console.warn('[MV] Firestore delete failed:', e.message); }
  }
  async function _fbDelAll() {
    if (!_db) return;
    try {
      const snap = await _db.collection(COLL).get();
      const batch = _db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch(e) { console.warn('[MV] Firestore delete-all failed:', e.message); }
  }

  // ── Sync status ───────────────────────────────────────
  function _setStatus(status, label) {
    _syncStatus = status;
    if (_onStatusChange) _onStatusChange(status, label);
  }

  // ── Real-time listener ────────────────────────────────
  function _startListener() {
    if (!_db) return;
    if (_unsubscribe) _unsubscribe();

    _unsubscribe = _db.collection(COLL).onSnapshot(snapshot => {
      if (snapshot.metadata.hasPendingWrites) return; // skip local echoes
      let changed = false;

      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (!data.id || !data.name) return;

        if (change.type === 'added' || change.type === 'modified') {
          const local = _localLoad(data.id);
          // Latest wins: use whichever was updated more recently
          if (!local || data.updatedAt > local.updatedAt) {
            _localSave({ ...data, sizeLabel: _fmtSize(data.bytes) });
            changed = true;
          }
        } else if (change.type === 'removed') {
          _localDel(data.id);
          changed = true;
        }
      });

      if (changed) {
        _setStatus('synced', 'synced');
        if (_onRemoteChange) _onRemoteChange();
      }
    }, err => {
      console.warn('[MV] Firestore listener error:', err.message);
      _setStatus('error', 'error');
    });
  }

  // ── Firebase connect ──────────────────────────────────
  async function connectFirebase(configJson) {
    // Parse config
    let cfg;
    try {
      const clean = configJson
        .replace(/\/\/.*$/gm, '')   // strip JS comments
        .replace(/,\s*([}\]])/g, '$1'); // trailing commas
      cfg = JSON.parse(clean);
    } catch {
      throw new Error('Invalid JSON — check for typos or missing quotes.');
    }

    const required = ['apiKey','authDomain','projectId'];
    const missing  = required.filter(k => !cfg[k]);
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);

    // Tear down existing connection
    await disconnectFirebase(false);

    _setStatus('connecting', 'connecting…');

    try {
      // Init Firebase (handle already-initialized case)
      if (firebase.apps.length > 0) {
        _fbApp = firebase.apps[0];
        // Re-initialize with new config if projectId changed
        if (_fbApp.options.projectId !== cfg.projectId) {
          await _fbApp.delete();
          _fbApp = firebase.initializeApp(cfg, 'markvault');
        }
      } else {
        _fbApp = firebase.initializeApp(cfg, 'markvault');
      }

      _db = _fbApp.firestore();

      // Test connection with a lightweight read
      await _db.collection(COLL).limit(1).get();

      // Push all local files to Firestore (merge, local wins if newer)
      await _pushLocalToCloud();

      // Start real-time listener
      _startListener();

      // Persist config
      localStorage.setItem(FB_KEY, JSON.stringify(cfg));
      _setStatus('synced', 'synced');
      return true;
    } catch(e) {
      _db    = null;
      _fbApp = null;
      _setStatus('error', 'error');
      throw e;
    }
  }

  async function disconnectFirebase(clearConfig = true) {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    if (_fbApp) {
      try { await _fbApp.delete(); } catch {}
      _fbApp = null;
    }
    _db = null;
    if (clearConfig) localStorage.removeItem(FB_KEY);
    _setStatus('local', 'local');
  }

  // Push all local files up to Firestore (on initial connect)
  async function _pushLocalToCloud() {
    if (!_db) return;
    const idx = _getIdx();
    for (const meta of idx) {
      const file = _localLoad(meta.id);
      if (!file) continue;
      try {
        // Check if remote copy is newer; if so, skip push
        const doc = await _db.collection(COLL).doc(file.id).get();
        if (doc.exists && doc.data().updatedAt > file.updatedAt) {
          // Remote is newer → pull it down
          _localSave({ ...doc.data(), sizeLabel: _fmtSize(doc.data().bytes) });
        } else {
          // Local is newer → push up
          await _fbSave(file);
        }
      } catch {}
    }
  }

  // Auto-reconnect on load if config exists
  async function autoConnect() {
    const raw = localStorage.getItem(FB_KEY);
    if (!raw) return false;
    try {
      await connectFirebase(raw);
      return true;
    } catch(e) {
      console.warn('[MV] Auto-connect failed:', e.message);
      _setStatus('error', 'disconnected');
      return false;
    }
  }

  function getSavedConfig() {
    try { return localStorage.getItem(FB_KEY) || ''; }
    catch { return ''; }
  }

  function isConnected() { return !!_db; }
  function getSyncStatus() { return _syncStatus; }

  // ── Public CRUD ───────────────────────────────────────
  function save(name, content, existingId = null) {
    const id    = existingId || _uid();
    const old   = existingId ? _localLoad(existingId) : null;
    const file  = _buildFile(id, name, content, old?.createdAt || null);
    _localSave(file);
    if (_db) _fbSave(file).catch(() => {});
    return file;
  }

  function load(id) { return _localLoad(id); }

  function remove(id) {
    _localDel(id);
    if (_db) _fbDel(id).catch(() => {});
  }

  function removeAll() {
    const idx = _getIdx();
    idx.forEach(m => localStorage.removeItem(PREFIX + m.id));
    localStorage.removeItem(IDX_KEY);
    if (_db) _fbDelAll().catch(() => {});
  }

  function list(query = '') {
    const idx = _getIdx();
    if (!query.trim()) return idx;
    const q = query.toLowerCase();
    return idx.filter(m => m.name.toLowerCase().includes(q));
  }

  function searchContent(query) {
    if (!query.trim()) return [];
    const q  = query.toLowerCase();
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    return _getIdx()
      .map(meta => {
        const file = _localLoad(meta.id);
        if (!file) return null;
        const nameHit    = file.name.toLowerCase().includes(q);
        const matches    = (file.content.match(re) || []).length;
        if (!nameHit && !matches) return null;
        return { ...meta, matches, nameHit };
      })
      .filter(Boolean)
      .sort((a,b) => (b.nameHit - a.nameHit) || (b.matches - a.matches));
  }

  // ── Force sync (push all local to Firestore) ──────────
  async function forcSync() {
    if (!_db) return false;
    _setStatus('syncing', 'syncing…');
    await _pushLocalToCloud();
    _setStatus('synced', 'synced');
    return true;
  }

  // ── Preferences ───────────────────────────────────────
  function getPrefs()          { try { return JSON.parse(localStorage.getItem(PREF_KEY)||'{}'); } catch { return {}; } }
  function setPref(k,v)        { const p=getPrefs(); p[k]=v; localStorage.setItem(PREF_KEY,JSON.stringify(p)); }

  // ── Stats ─────────────────────────────────────────────
  function stats() {
    const idx   = _getIdx();
    const total = idx.reduce((s,m) => s+(m.bytes||0), 0);
    return { count:idx.length, totalBytes:total, label:`${idx.length} file${idx.length!==1?'s':''} · ${_fmtSize(total)}` };
  }

  function formatDate(iso)    { return _fmtDate(iso); }
  function formatSize(bytes)  { return _fmtSize(bytes); }

  // ── Event hooks ───────────────────────────────────────
  function onStatusChange(cb)  { _onStatusChange = cb; }
  function onRemoteChange(cb)  { _onRemoteChange = cb; }

  function getDB() { return _db; }

  return {
    // CRUD
    save, load, remove, removeAll, list, searchContent,
    // Firebase
    connectFirebase, disconnectFirebase, autoConnect,
    isConnected, getSyncStatus, getSavedConfig, forcSync, getDB,
    // Prefs & utils
    getPrefs, setPref, stats, formatDate, formatSize,
    // Hooks
    onStatusChange, onRemoteChange,
  };
})();
