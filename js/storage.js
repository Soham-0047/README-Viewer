/**
 * MarkVault v2 — Storage + Auth Service
 *
 * Architecture:
 *   localStorage  → always-on, instant, works offline
 *   Firestore     → cross-device sync, keyed per authenticated user
 *
 * Firestore paths:
 *   users/{uid}/files/{fileId}   ← private per-user files
 *   mv_shared_links/{token}      ← public share tokens (readable without auth)
 *
 * Auth flow:
 *   1. Firebase is configured (connectFirebase)
 *   2. User signs in with Google  →  uid = "abc123"
 *   3. All Firestore ops use:  users/abc123/files/...
 *   4. Same Google on phone/laptop/tablet → same uid → same files
 *   5. signOut() → uid cleared → local-only mode
 */

const Storage = (() => {

  const PREFIX   = 'MV2_file_';
  const IDX_KEY  = 'MV2_index';
  const PREF_KEY = 'MV2_prefs';
  const FB_KEY   = 'MV2_firebase_config';

  let _db         = null;
  let _auth       = null;
  let _fbApp      = null;
  let _user       = null;
  let _unsubFile  = null;
  let _unsubAuth  = null;
  let _syncStatus = 'local';

  let _onStatusChange = null;
  let _onRemoteChange = null;
  let _onAuthChange   = null;

  // ── Helpers ──────────────────────────────────────────
  function _uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function _now()      { return new Date().toISOString(); }
  function _fmtSize(b) {
    if (!b) return '0 B';
    if (b < 1024)    return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(2)} MB`;
  }
  function _fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US',{ month:'short',day:'numeric',year:'numeric' });
  }

  // Firestore collection scoped to signed-in user
  function _userColl() {
    if (!_db || !_user) return null;
    return _db.collection('users').doc(_user.uid).collection('files');
  }

  // ── localStorage ─────────────────────────────────────
  function _getIdx()       { try { return JSON.parse(localStorage.getItem(IDX_KEY)||'[]'); } catch { return []; } }
  function _saveIdx(idx)   { localStorage.setItem(IDX_KEY, JSON.stringify(idx)); }
  function _upsertIdx(m)   { const idx=_getIdx(), i=idx.findIndex(x=>x.id===m.id); if(i>=0) idx[i]=m; else idx.unshift(m); _saveIdx(idx); }
  function _removeIdx(id)  { _saveIdx(_getIdx().filter(x=>x.id!==id)); }

  function _build(id, name, content, createdAt=null) {
    const bytes = new TextEncoder().encode(content).length;
    const now   = _now();
    return {
      id, name, content, bytes,
      lines:     content.split('\n').length,
      words:     content.trim() ? content.trim().split(/\s+/).length : 0,
      createdAt: createdAt || now,
      updatedAt: now,
      sizeLabel: _fmtSize(bytes),
    };
  }

  function _localSave(file) {
    localStorage.setItem(PREFIX+file.id, JSON.stringify(file));
    const { content:_, ...meta } = file;
    _upsertIdx(meta);
  }
  function _localLoad(id) { try { return JSON.parse(localStorage.getItem(PREFIX+id)||'null'); } catch { return null; } }
  function _localDel(id)  { localStorage.removeItem(PREFIX+id); _removeIdx(id); }

  // ── Firestore ─────────────────────────────────────────
  async function _fbSave(file) {
    const c = _userColl(); if (!c) return;
    try { await c.doc(file.id).set(file); } catch(e) { console.warn('[MV]',e.message); }
  }
  async function _fbDel(id) {
    const c = _userColl(); if (!c) return;
    try { await c.doc(id).delete(); } catch(e) { console.warn('[MV]',e.message); }
  }
  async function _fbDelAll() {
    const c = _userColl(); if (!c) return;
    try {
      const snap=await c.get(), batch=_db.batch();
      snap.docs.forEach(d=>batch.delete(d.ref));
      await batch.commit();
    } catch(e) { console.warn('[MV]',e.message); }
  }

  function _setStatus(status, label) {
    _syncStatus = status;
    if (_onStatusChange) _onStatusChange(status, label);
  }

  function _startFileListener() {
    if (_unsubFile) { _unsubFile(); _unsubFile=null; }
    const c = _userColl(); if (!c) return;
    _unsubFile = c.onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      let changed = false;
      snap.docChanges().forEach(ch => {
        const d = ch.doc.data();
        if (!d.id||!d.name) return;
        if (ch.type==='added'||ch.type==='modified') {
          const loc = _localLoad(d.id);
          if (!loc || d.updatedAt > loc.updatedAt) { _localSave({...d,sizeLabel:_fmtSize(d.bytes)}); changed=true; }
        } else if (ch.type==='removed') { _localDel(d.id); changed=true; }
      });
      if (changed) { _setStatus('synced','synced'); if (_onRemoteChange) _onRemoteChange(); }
    }, err => { console.warn('[MV] listener:',err.message); _setStatus('error','error'); });
  }

  // Pull cloud-only files into localStorage so the current session sees
  // everything that already exists in Firestore. This runs BEFORE push so
  // freshly signed-in users instantly see their existing cloud data.
  async function _pullCloudToLocal() {
    const c = _userColl(); if (!c) return;
    const snap = await c.get();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.id || !data.name) return;
      const loc = _localLoad(data.id);
      if (!loc || (data.updatedAt && data.updatedAt > loc.updatedAt)) {
        _localSave({ ...data, sizeLabel: _fmtSize(data.bytes) });
      }
    });
  }

  // One-time migration of legacy top-level `markvault_files` collection
  // (pre-multi-user schema) into `users/{uid}/files`. Runs once per uid;
  // tracked via a localStorage flag so it never runs twice for the same user.
  async function _migrateLegacyFiles() {
    if (!_db || !_user) return;
    const flagKey = `MV2_legacy_migrated_${_user.uid}`;
    if (localStorage.getItem(flagKey)) return;
    try {
      const legacy = await _db.collection('markvault_files').get();
      if (legacy.empty) { localStorage.setItem(flagKey, '1'); return; }

      const userColl = _userColl();
      let migrated = 0;
      for (const d of legacy.docs) {
        const data = d.data();
        // Accept either {id,name,content,...} format or legacy variants
        const id   = data.id   || d.id;
        const name = data.name || data.filename || data.title || `untitled-${d.id.slice(0,6)}.md`;
        const content = data.content ?? data.body ?? data.markdown ?? '';
        if (!content && !data.name) continue;

        const file = _build(id, name, content, data.createdAt || null);
        // Preserve original updatedAt if present so future syncs don't overwrite newer edits
        if (data.updatedAt) file.updatedAt = data.updatedAt;

        // Save locally + write to user-scoped path
        _localSave(file);
        try { await userColl.doc(file.id).set(file, { merge: true }); migrated++; } catch {}
      }
      localStorage.setItem(flagKey, '1');
      if (migrated > 0) console.info(`[MV] Migrated ${migrated} legacy files → users/${_user.uid}/files`);
    } catch(e) {
      // Don't block sign-in if legacy collection is unreadable (rules etc.)
      console.warn('[MV] legacy migration skipped:', e.message);
      localStorage.setItem(flagKey, '1');
    }
  }

  async function _pushLocalToCloud() {
    const c = _userColl(); if (!c) return;
    for (const meta of _getIdx()) {
      const file = _localLoad(meta.id); if (!file) continue;
      try {
        const doc = await c.doc(file.id).get();
        if (doc.exists && doc.data().updatedAt > file.updatedAt)
          _localSave({...doc.data(), sizeLabel:_fmtSize(doc.data().bytes)});
        else await _fbSave(file);
      } catch {}
    }
  }

  // ── Firebase connect ──────────────────────────────────
  async function connectFirebase(configJson) {
    let cfg;
    try { cfg = JSON.parse(configJson.replace(/\/\/.*$/gm,'').replace(/,\s*([}\]])/g,'$1')); }
    catch { throw new Error('Invalid JSON — check for typos.'); }
    const missing = ['apiKey','authDomain','projectId'].filter(k=>!cfg[k]);
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);

    await disconnectFirebase(false);
    _setStatus('connecting','connecting…');

    try {
      const existing = firebase.apps.find(a=>a.name==='markvault');
      if (existing && existing.options.projectId!==cfg.projectId) await existing.delete();
      _fbApp = firebase.apps.find(a=>a.name==='markvault') || firebase.initializeApp(cfg,'markvault');
      _db    = _fbApp.firestore();
      _auth  = _fbApp.auth();

      // Force LOCAL persistence (IndexedDB) so session survives reloads even
      // on named (non-default) apps. Must be set before any sign-in attempt.
      try { await _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch(e) { console.warn('[MV] persistence:', e.message); }

      // Test connectivity (non-blocking)
      _db.collection('_ping').limit(1).get().catch(()=>{});

      // Auth state listener — fires immediately with current (restored) user
      _unsubAuth = _auth.onAuthStateChanged(async user => {
        _user = user;
        if (user) {
          _setStatus('syncing','syncing…');
          // One-time migration of legacy top-level `markvault_files` docs
          try { await _migrateLegacyFiles(); } catch(e) { console.warn('[MV] migrate:', e.message); }
          // Pull-then-push: cloud is the source of truth on initial connect,
          // so existing Firestore data merges into the current local session.
          try { await _pullCloudToLocal(); } catch(e) { console.warn('[MV] pull:', e.message); }
          try { await _pushLocalToCloud(); } catch(e) { console.warn('[MV] push:', e.message); }
          _startFileListener();
          _setStatus('synced','synced');
          if (_onRemoteChange) _onRemoteChange();
        } else {
          if (_unsubFile) { _unsubFile(); _unsubFile=null; }
          _setStatus('connected','no account');
        }
        if (_onAuthChange) _onAuthChange(user);
      });

      localStorage.setItem(FB_KEY, JSON.stringify(cfg));
      _setStatus('connected','connected');
      return true;
    } catch(e) {
      _db=null; _auth=null; _fbApp=null;
      _setStatus('error','error');
      throw e;
    }
  }

  async function disconnectFirebase(clearConfig=true) {
    if (_unsubFile) { _unsubFile(); _unsubFile=null; }
    if (_unsubAuth) { _unsubAuth(); _unsubAuth=null; }
    if (_fbApp)     { try { await _fbApp.delete(); } catch {} _fbApp=null; }
    _db=null; _auth=null; _user=null;
    if (clearConfig) localStorage.removeItem(FB_KEY);
    _setStatus('local','local');
  }

  async function autoConnect() {
    const raw = localStorage.getItem(FB_KEY);
    if (!raw) return false;
    try { await connectFirebase(raw); return true; }
    catch(e) { console.warn('[MV] auto-connect:',e.message); _setStatus('error','disconnected'); return false; }
  }

  // ── Auth ─────────────────────────────────────────────
  async function signInWithGoogle() {
    if (!_auth) throw new Error('Set up Firebase first (☁ icon in sidebar).');
    // Re-assert LOCAL persistence right before sign-in (some browsers reset it)
    try { await _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch {}
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email'); provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    // Mobile / cross-origin-isolated contexts: popup is unreliable.
    // Use redirect on small screens or when COOP is set.
    const useRedirect =
      window.innerWidth < 720 ||
      /Mobi|Android/i.test(navigator.userAgent) ||
      (typeof window.crossOriginIsolated !== 'undefined' && window.crossOriginIsolated);

    if (useRedirect) {
      await _auth.signInWithRedirect(provider);
      return null;
    }

    try {
      const result = await _auth.signInWithPopup(provider);
      return result.user;
    } catch(e) {
      // Any popup-related failure (blocked, COOP, closed, network) → redirect fallback
      const code = e?.code || '';
      const popupErr = code.startsWith('auth/popup') || code === 'auth/cancelled-popup-request' ||
                       code === 'auth/web-storage-unsupported' || code === 'auth/operation-not-supported-in-this-environment';
      if (popupErr) {
        try { await _auth.signInWithRedirect(provider); return null; } catch(e2) { throw e2; }
      }
      throw e;
    }
  }

  async function handleRedirectResult() {
    if (!_auth) return null;
    try { const r = await _auth.getRedirectResult(); return r?.user || null; }
    catch { return null; }
  }

  async function signOut() {
    if (_unsubFile) { _unsubFile(); _unsubFile=null; }
    if (_auth) await _auth.signOut();
    _user = null;
    _setStatus(_db ? 'connected':'local', _db ? 'no account':'local');
    if (_onAuthChange) _onAuthChange(null);
  }

  function getCurrentUser() { return _user; }
  function isSignedIn()     { return !!_user; }
  function isConnected()    { return !!_db; }
  function getSyncStatus()  { return _syncStatus; }
  function getSavedConfig() { try { return localStorage.getItem(FB_KEY)||''; } catch { return ''; } }
  function getDB()          { return _db; }
  function getAuth()        { return _auth; }

  async function forcSync() {
    if (!_db||!_user) return false;
    _setStatus('syncing','syncing…');
    await _pushLocalToCloud();
    _setStatus('synced','synced');
    return true;
  }

  // ── Public CRUD ───────────────────────────────────────
  function save(name, content, existingId=null) {
    const id   = existingId || _uid();
    const old  = existingId ? _localLoad(existingId) : null;
    const file = _build(id, name, content, old?.createdAt);
    _localSave(file);
    if (_db && _user) _fbSave(file).catch(()=>{});
    return file;
  }
  function load(id)    { return _localLoad(id); }
  function remove(id)  { _localDel(id); if (_db&&_user) _fbDel(id).catch(()=>{}); }
  function removeAll() { _getIdx().forEach(m=>localStorage.removeItem(PREFIX+m.id)); localStorage.removeItem(IDX_KEY); if (_db&&_user) _fbDelAll().catch(()=>{}); }

  function list(query='') {
    const idx = _getIdx();
    if (!query.trim()) return idx;
    const q = query.toLowerCase();
    return idx.filter(m=>m.name.toLowerCase().includes(q));
  }

  function searchContent(query) {
    if (!query.trim()) return [];
    const q=query.toLowerCase(), re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    return _getIdx()
      .map(meta => {
        const file=_localLoad(meta.id); if (!file) return null;
        const nameHit=file.name.toLowerCase().includes(q), matches=(file.content.match(re)||[]).length;
        if (!nameHit&&!matches) return null;
        return {...meta, matches, nameHit};
      })
      .filter(Boolean).sort((a,b)=>(b.nameHit-a.nameHit)||(b.matches-a.matches));
  }

  function reorderFiles(orderedIds) {
    // orderedIds: array of file ids in the new desired order
    const idx = _getIdx();
    const map = new Map(idx.map(m => [m.id, m]));
    // Build new index: ordered ids first, then any not in the list
    const reordered = [
      ...orderedIds.map(id => map.get(id)).filter(Boolean),
      ...idx.filter(m => !orderedIds.includes(m.id)),
    ];
    _saveIdx(reordered);
  }

  function getPrefs()    { try { return JSON.parse(localStorage.getItem(PREF_KEY)||'{}'); } catch { return {}; } }
  function setPref(k,v)  { const p=getPrefs(); p[k]=v; localStorage.setItem(PREF_KEY,JSON.stringify(p)); }
  function stats() {
    const idx=_getIdx(), total=idx.reduce((s,m)=>s+(m.bytes||0),0);
    return { count:idx.length, totalBytes:total, label:`${idx.length} file${idx.length!==1?'s':''} · ${_fmtSize(total)}` };
  }
  function formatDate(iso) { return _fmtDate(iso); }
  function formatSize(b)   { return _fmtSize(b); }

  function onStatusChange(cb) { _onStatusChange=cb; }
  function onRemoteChange(cb) { _onRemoteChange=cb; }
  function onAuthChange(cb)   { _onAuthChange=cb; }

  // ── Subscription convenience helpers (used by Subscription module) ──
  async function getSubscriptionStatus() {
    if (!_db || !_user) return { plan:'free', status:'none' };
    try {
      const doc = await _db.collection('users').doc(_user.uid).collection('subscription').doc('status').get();
      return doc.exists ? doc.data() : { plan:'free', status:'none' };
    } catch { return { plan:'free', status:'none' }; }
  }
  function subscriptionStatusRef() {
    if (!_db || !_user) return null;
    return _db.collection('users').doc(_user.uid).collection('subscription').doc('status');
  }
  function userUsageRef(date) {
    if (!_db || !_user) return null;
    return _db.collection('users').doc(_user.uid).collection('usage').doc(date);
  }
  function configRef() {
    if (!_db) return null;
    return _db.collection('mv_config').doc('features');
  }

  return {
    save, load, remove, removeAll, list, searchContent, reorderFiles,
    connectFirebase, disconnectFirebase, autoConnect, forcSync,
    signInWithGoogle, handleRedirectResult, signOut,
    getCurrentUser, isSignedIn, isConnected, getSyncStatus,
    getSavedConfig, getDB, getAuth,
    getPrefs, setPref, stats, formatDate, formatSize,
    onStatusChange, onRemoteChange, onAuthChange,
    getSubscriptionStatus, subscriptionStatusRef, userUsageRef, configRef,
  };
})();