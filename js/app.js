/**
 * MarkVault v2 — App Controller
 * Full UI orchestration: sidebar, editor, preview, cloud sync, mobile bottom nav
 */

const App = (() => {

  // ── State ─────────────────────────────────────────────
  const S = {
    activeId:   null,
    isDark:     true,
    mode:       'drop',   // 'drop' | 'preview' | 'editor' | 'pdf' | 'split'
    tocItems:   [],
    searchQ:    '',
    tocOpen:    false,
    rendering:  false,
    pdfDoc:     null,
    pdfScale:   1.0,
    pdfName:    '',
    splitMode:  false,
    _lastSummary: '',
  };

  // ── DOM ───────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const el = {
    // Sidebar
    sidebar:         $('sidebar'),
    sidebarOpen:     $('sidebarOpen'),
    sidebarClose:    $('sidebarClose'),
    sidebarBackdrop: $('sidebarBackdrop'),
    fileList:        $('fileList'),
    fileCount:       $('fileCount'),
    searchInput:     $('searchInput'),
    searchClear:     $('searchClear'),
    newFileBtn:      $('newFileBtn'),
    importBtn:       $('importBtn'),
    syncNowBtn:      $('syncNowBtn'),
    themeToggle:     $('themeToggle'),
    themeIconDark:   $('themeIconDark'),
    themeIconLight:  $('themeIconLight'),
    storageInfo:     $('storageInfo'),
    deleteAllBtn:    $('deleteAllBtn'),
    syncBadge:       $('syncBadge'),
    syncDot:         $('syncDot'),
    syncLabel:       $('syncLabel'),
    cloudSetupBtn:   $('cloudSetupBtn'),
    // Topbar
    topbarTitle:     $('topbarTitle'),
    tocBtn:          $('tocBtn'),
    editBtn:         $('editBtn'),
    copyBtn:         $('copyBtn'),
    exportBtn:       $('exportBtn'),
    printBtn:        $('printBtn'),
    // Content
    dropZone:        $('dropZone'),
    browseBtn:       $('browseBtn'),
    writeNewBtn:     $('writeNewBtn'),
    editorWrap:      $('editorWrap'),
    editorFilename:  $('editorFilename'),
    editorArea:      $('editorArea'),
    editorSaveBtn:   $('editorSaveBtn'),
    editorCancelBtn: $('editorCancelBtn'),
    editorWordCount: $('editorWordCount'),
    previewWrap:     $('previewWrap'),
    previewMeta:     $('previewMeta'),
    markdownBody:    $('markdownBody'),
    tocPanel:        $('tocPanel'),
    tocContent:      $('tocContent'),
    tocClose:        $('tocClose'),
    // Bottom nav
    bottomNav:       $('bottomNav'),
    bnFiles:         $('bnFiles'),
    bnEdit:          $('bnEdit'),
    bnExport:        $('bnExport'),
    bnNew:           $('bnNew'),
    // Lightbox
    lightbox:        $('lightbox'),
    lightboxClose:   $('lightboxClose'),
    // Modals
    toastContainer:  $('toastContainer'),
    modalOverlay:    $('modalOverlay'),
    modalMsg:        $('modalMsg'),
    modalConfirm:    $('modalConfirm'),
    modalCancel:     $('modalCancel'),
    newFileOverlay:  $('newFileOverlay'),
    newFileName:     $('newFileName'),
    newFileCreate:   $('newFileCreate'),
    newFileCancel:   $('newFileCancel'),
    cloudModal:      $('cloudModal'),
    cloudConfigInput:$('cloudConfigInput'),
    cloudConnect:    $('cloudConnect'),
    cloudDisconnect: $('cloudDisconnect'),
    cloudCancel:     $('cloudCancel'),
    cloudError:      $('cloudError'),
    cloudConnecting: $('cloudConnecting'),
    fileInput:       $('fileInput'),
    // PDF
    pdfWrap:          $('pdfWrap'),
    pdfTopbar:        $('pdfTopbar'),
    pdfFilename:      $('pdfFilename'),
    pdfPageInfo:      $('pdfPageInfo'),
    pdfProgress:      $('pdfProgress'),
    pdfProgressBar:   $('pdfProgressBar'),
    pdfProgressLabel: $('pdfProgressLabel'),
    pdfLoading:       $('pdfLoading'),
    pdfLoadLabel:     $('pdfLoadLabel'),
    pdfPages:         $('pdfPages'),
    pdfConvertBtn:    $('pdfConvertBtn'),
    pdfZoomIn:        $('pdfZoomIn'),
    pdfZoomOut:       $('pdfZoomOut'),
    pdfConvertModal:  $('pdfConvertModal'),
    convertProgress:  $('convertProgress'),
    convertBar:       $('convertBar'),
    convertLabel:     $('convertLabel'),
    pdfConvertStart:  $('pdfConvertStart'),
    pdfConvertCancel:  $('pdfConvertCancel'),
    pdfSaveBtn:        $('pdfSaveBtn'),
    geminiKeyInput:    $('geminiKeyInput'),
    geminiKeyToggle:   $('geminiKeyToggle'),
    saveGeminiKey:     $('saveGeminiKey'),
    convertError:      $('convertError'),
    // Share
    shareBtn:          $('shareBtn'),
    shareModal:        $('shareModal'),
    shareFileName:     $('shareFileName'),
    sharePanel:        $('sharePanel'),
    shareRequiresCloud:$('shareRequiresCloud'),
    shareGoCloud:      $('shareGoCloud'),
    shareLinkWrap:     $('shareLinkWrap'),
    shareLinkInput:    $('shareLinkInput'),
    shareCopyLink:     $('shareCopyLink'),
    shareQRBtn:        $('shareQRBtn'),
    shareLinkMeta:     $('shareLinkMeta'),
    shareRevokeBtn:    $('shareRevokeBtn'),
    shareNoLink:       $('shareNoLink'),
    shareExpiry:       $('shareExpiry'),
    shareMaxViews:     $('shareMaxViews'),
    shareQRWrap:       $('shareQRWrap'),
    shareQRCanvas:     $('shareQRCanvas'),
    shareGenerate:     $('shareGenerate'),
    shareManageBtn:    $('shareManageBtn'),
    shareClose:        $('shareClose'),
    manageLinksModal:  $('manageLinksModal'),
    managedLinksList:  $('managedLinksList'),
    manageLinksClose:  $('manageLinksClose'),
    // Focus
    focusBtn:          $('focusBtn'),
    focusOverlay:      $('focusOverlay'),
    focusExit:         $('focusExit'),
    focusFontDec:      $('focusFontDec'),
    focusFontInc:      $('focusFontInc'),
    focusWidthSel:     $('focusWidthSel'),
    focusTheme:        $('focusTheme'),
    // Progress
    readingProgressBar:$('readingProgressBar'),
    previewScroll:     $('previewScroll'),
    // AI Chat
    aiChatBtn:         $('aiChatBtn'),
    aiChatPanel:       $('aiChatPanel'),
    aiChatClose:       $('aiChatClose'),
    aiChatClear:       $('aiChatClear'),
    aiChatMessages:    $('aiChatMessages'),
    aiChatInput:       $('aiChatInput'),
    aiChatSend:        $('aiChatSend'),
    aiChatProvider:    $('aiChatProvider'),
    aiChatStarters:    $('aiChatStarters'),
    // AI Summary
    aiSummaryBtn:      $('aiSummaryBtn'),
    aiSummaryModal:    $('aiSummaryModal'),
    aiSummaryBody:     $('aiSummaryBody'),
    aiSummaryTags:     $('aiSummaryTags'),
    aiSummarySave:     $('aiSummarySave'),
    aiSummaryClose:    $('aiSummaryClose'),
    // AI Settings
    aiSettingsModal:   $('aiSettingsModal'),
    aiProvidersList:   $('aiProvidersList'),
    aiSettingsSave:    $('aiSettingsSave'),
    aiSettingsClose:   $('aiSettingsClose'),
    // Writing Tools
    writingToolsBar:   $('writingToolsBar'),
    wtTools:           $('wtTools'),
    wtTranslate:       $('wtTranslate'),
    wtLangInput:       $('wtLangInput'),
    wtTranslateGo:     $('wtTranslateGo'),
    wtResult:          $('wtResult'),
    wtResultLabel:     $('wtResultLabel'),
    wtResultText:      $('wtResultText'),
    wtAccept:          $('wtAccept'),
    wtDiscard:         $('wtDiscard'),
    wtClose:           $('wtClose'),
    // Command Palette
    commandPalette:    $('commandPalette'),
    cpInput:           $('cpInput'),
    cpList:            $('cpList'),
  };

  // ── Toast ─────────────────────────────────────────────
  function toast(msg, type = 'success', duration = 3000) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-indicator"></span><span>${_esc(msg)}</span>`;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastOut 180ms var(--ease) forwards';
      setTimeout(() => t.remove(), 200);
    }, duration);
  }

  // ── Confirm modal ─────────────────────────────────────
  function confirm(msg, onOk, btnLabel = 'Delete') {
    el.modalMsg.textContent = msg;
    el.modalConfirm.textContent = btnLabel;
    el.modalOverlay.classList.remove('hidden');
    el.modalConfirm.onclick = () => { el.modalOverlay.classList.add('hidden'); onOk(); };
    el.modalCancel.onclick  = () => el.modalOverlay.classList.add('hidden');
    el.modalOverlay.onclick = e => { if (e.target === el.modalOverlay) el.modalOverlay.classList.add('hidden'); };
  }

  // ── HTML escape helper ────────────────────────────────
  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Theme ─────────────────────────────────────────────
  function applyTheme(dark) {
    S.isDark = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    $('hljs-dark').disabled  = !dark;
    $('hljs-light').disabled = dark;
    el.themeIconDark.classList.toggle('hidden', !dark);
    el.themeIconLight.classList.toggle('hidden', dark);
    Storage.setPref('theme', dark ? 'dark' : 'light');
    // Re-render mermaid diagrams with new theme
    if (S.mode === 'preview' && el.markdownBody.innerHTML) {
      Renderer.rerender(el.markdownBody).catch(() => {});
    }
  }

  // ── Sync badge ────────────────────────────────────────
  function _updateSyncBadge(status, label) {
    el.syncDot.className = 'sync-dot';
    if (status === 'connecting' || status === 'syncing') el.syncDot.classList.add('syncing');
    else if (status === 'synced')   el.syncDot.classList.add('connected');
    else if (status === 'error')    el.syncDot.classList.add('error');
    el.syncLabel.textContent = label || status;
    el.syncNowBtn.classList.toggle('hidden', !Storage.isConnected());
    el.cloudDisconnect.style.display = Storage.isConnected() ? 'inline-flex' : 'none';
  }

  // ── File list ─────────────────────────────────────────
  // ── Drag-to-reorder state ────────────────────────────
  let _dragSrcId = null;

  function refreshList() {
    const allFiles = Storage.list(S.searchQ);
    const starred  = _getStarred();
    const stats    = Storage.stats();
    el.fileCount.textContent   = stats.count;
    el.storageInfo.textContent = stats.label;

    if (allFiles.length === 0) {
      el.fileList.innerHTML = `
        <li class="empty-state">
          <span class="empty-icon">◈</span>
          <span class="empty-title">${S.searchQ ? 'No results' : 'No files yet'}</span>
          <span class="empty-sub">${S.searchQ ? `"${_esc(S.searchQ)}"` : 'Drop a .md file or click Import'}</span>
        </li>`;
      return;
    }

    const pinnedFiles = !S.searchQ ? allFiles.filter(f => starred.includes(f.id)) : [];
    const normalFiles = !S.searchQ ? allFiles.filter(f => !starred.includes(f.id)) : allFiles;

    const renderItem = (f) => `
      <li class="file-item ${f.id === S.activeId ? 'active' : ''}"
          data-id="${_esc(f.id)}" role="option" tabindex="0"
          aria-selected="${f.id === S.activeId}"
          draggable="true">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="file-item-icon">${f.id === S.activeId ? '◈' : '◇'}</span>
        <div class="file-item-info">
          <span class="file-item-name" title="${_esc(f.name)}">${_esc(f.name)}</span>
          <span class="file-item-meta">${Storage.formatDate(f.updatedAt)} · ${f.sizeLabel || '—'}</span>
        </div>
        <button class="file-item-star ${starred.includes(f.id) ? 'starred' : ''}"
          data-id="${_esc(f.id)}" title="${starred.includes(f.id) ? 'Unstar' : 'Star'}">
          ${starred.includes(f.id) ? '★' : '☆'}
        </button>
        <div class="file-item-actions">
          <button class="ia-edit" data-id="${_esc(f.id)}" title="Edit">✎</button>
          <button class="ia-del"  data-id="${_esc(f.id)}" title="Delete">✕</button>
        </div>
      </li>`;

    let html = '';
    if (pinnedFiles.length) {
      html += `<div class="file-list-section">★ Starred</div>`;
      html += pinnedFiles.map(renderItem).join('');
      if (normalFiles.length) html += `<div class="file-list-section">Files</div>`;
    }
    html += normalFiles.map(renderItem).join('');
    el.fileList.innerHTML = html;

    // ── Click / keyboard ──────────────────────────────
    el.fileList.querySelectorAll('.file-item').forEach(item => {
      const id = item.dataset.id;
      item.addEventListener('click', e => {
        if (e.target.closest('.ia-del,.ia-edit,.file-item-star,.drag-handle')) return;
        openFile(id);
        closeSidebar();
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFile(id); }
      });
    });
    el.fileList.querySelectorAll('.ia-edit').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); editFile(btn.dataset.id); }));
    el.fileList.querySelectorAll('.ia-del').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); deleteFile(btn.dataset.id); }));
    el.fileList.querySelectorAll('.file-item-star').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); _toggleStar(btn.dataset.id); }));

    // ── Drag-to-reorder ───────────────────────────────
    // Only active when not searching (order is meaningful)
    if (!S.searchQ) _bindDragReorder(el.fileList);
  }

  function _bindDragReorder(list) {
    const items = list.querySelectorAll('.file-item[draggable]');
    let _dragOver = null;

    items.forEach(item => {
      // ── Drag start ──────────────────────────────────
      item.addEventListener('dragstart', e => {
        _dragSrcId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', _dragSrcId);
        // Slight delay so the drag image captures normal style
        setTimeout(() => item.classList.add('drag-ghost'), 0);
      });

      // ── Drag over ───────────────────────────────────
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item.dataset.id === _dragSrcId) return;

        // Remove indicator from previous target
        if (_dragOver && _dragOver !== item) {
          _dragOver.classList.remove('drag-over-above', 'drag-over-below');
        }
        _dragOver = item;

        // Determine above/below by cursor Y vs item midpoint
        const rect = item.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          item.classList.add('drag-over-above');
          item.classList.remove('drag-over-below');
        } else {
          item.classList.add('drag-over-below');
          item.classList.remove('drag-over-above');
        }
      });

      item.addEventListener('dragleave', e => {
        if (!item.contains(e.relatedTarget)) {
          item.classList.remove('drag-over-above', 'drag-over-below');
        }
      });

      // ── Drop ────────────────────────────────────────
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-over-above', 'drag-over-below');
        const srcId  = _dragSrcId;
        const dstId  = item.dataset.id;
        if (!srcId || srcId === dstId) return;

        // Build new order from current DOM
        const allItems  = [...list.querySelectorAll('.file-item[data-id]')];
        let   orderedIds = allItems.map(i => i.dataset.id);

        // Remove src from current position
        orderedIds = orderedIds.filter(id => id !== srcId);

        // Insert before or after dst
        const dstIdx = orderedIds.indexOf(dstId);
        const rect   = item.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        const insertAt = insertBefore ? dstIdx : dstIdx + 1;
        orderedIds.splice(insertAt, 0, srcId);

        Storage.reorderFiles(orderedIds);
        refreshList();
      });

      // ── Drag end ─────────────────────────────────────
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging', 'drag-ghost');
        list.querySelectorAll('.drag-over-above,.drag-over-below,.dragging,.drag-ghost')
          .forEach(el => el.classList.remove('drag-over-above','drag-over-below','dragging','drag-ghost'));
        _dragSrcId = null;
        _dragOver  = null;
      });
    });
  }

  // ── Open file (preview mode) ──────────────────────────
  async function openFile(id) {
    const file = Storage.load(id);
    if (!file) { toast('File not found', 'error'); return; }
    S.activeId = id;
    S.mode     = 'preview';
    refreshList();
    setMode('preview');
    el.topbarTitle.textContent = file.name;
    el.previewMeta.innerHTML = [
      Storage.formatDate(file.updatedAt),
      `${file.lines ?? '?'} lines`,
      `${file.words ?? '?'} words`,
      file.sizeLabel || Storage.formatSize(file.bytes),
    ].map(s => `<span>${s}</span>`).join('');
    _showPreviewButtons(true);
    _updateBottomNav();
    Storage.setPref('lastOpenId', id);
    await _renderFile(file);
    if (el.previewScroll) ReadingProgress.attach(el.previewScroll, id);
    closeSidebar();
  }

  async function _renderFile(file) {
    if (S.rendering) return;
    S.rendering = true;
    el.markdownBody.innerHTML = '<div style="padding:32px;color:var(--txt3);font-size:13px;font-family:var(--font-mono)">Rendering…</div>';
    try {
      S.tocItems = await Renderer.render(file.content, el.markdownBody, S.isDark);
      Renderer.renderTOC(S.tocItems, el.tocContent);
      el.tocBtn?.classList.toggle('hidden', S.tocItems.length < 2);
    } catch(e) {
      el.markdownBody.innerHTML = `<div style="padding:32px;color:var(--danger);font-size:13px">Render error: ${_esc(e.message)}</div>`;
    } finally {
      S.rendering = false;
    }
  }

  // ── Edit file ─────────────────────────────────────────
  function editFile(id) {
    const file = Storage.load(id);
    if (!file) return;
    S.activeId = id;
    S.mode     = 'editor';
    refreshList();
    setMode('editor');
    el.editorFilename.value  = file.name;
    el.editorArea.value      = file.content;
    el.topbarTitle.textContent = `Editing: ${file.name}`;
    _showPreviewButtons(false);
    _updateBottomNav();
    _updateWordCount();
    el.editorArea.focus();
    closeSidebar();
  }

  function newFile(starterName = '') {
    el.newFileName.value = starterName || 'untitled.md';
    el.newFileOverlay.classList.remove('hidden');
    setTimeout(() => { el.newFileName.focus(); el.newFileName.select(); }, 60);
  }

  function _createNewFile(name) {
    if (!name || !name.trim()) name = 'untitled.md';
    if (!name.match(/\.(md|markdown|txt)$/i)) name += '.md';
    S.activeId = null;
    S.mode     = 'editor';
    setMode('editor');
    el.editorFilename.value  = name;
    el.editorArea.value      = `# ${name.replace(/\.(md|markdown|txt)$/i, '')}\n\n`;
    el.topbarTitle.textContent = `New: ${name}`;
    _showPreviewButtons(false);
    _updateBottomNav();
    _updateWordCount();
    el.editorArea.focus();
    const len = el.editorArea.value.length;
    el.editorArea.setSelectionRange(len, len);
    closeSidebar();
  }

  function saveEditor() {
    const content = el.editorArea.value;
    const name    = el.editorFilename.value.trim() || 'untitled.md';
    const result  = Storage.save(name, content, S.activeId || undefined);
    S.activeId    = result.id;
    refreshList();
    openFile(result.id);
    toast(`Saved: ${name}`);
  }

  function cancelEditor() {
    if (S.activeId) {
      openFile(S.activeId);
    } else {
      S.mode = 'drop';
      setMode('drop');
      el.topbarTitle.textContent = 'Select or create a file';
      _showPreviewButtons(false);
      _updateBottomNav();
    }
  }

  // Word count while typing
  function _updateWordCount() {
    const words = el.editorArea.value.trim()
      ? el.editorArea.value.trim().split(/\s+/).length : 0;
    el.editorWordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  // ── Import files ──────────────────────────────────────
  function importFiles(fileList) {
    let first = null;
    Array.from(fileList).forEach(file => {
      // PDF handling
      if (file.name.match(/\.pdf$/i)) {
        openPDF(file); return;
      }
      if (!file.name.match(/\.(md|markdown|txt)$/i)) {
        toast(`Skipped: ${file.name} (not a Markdown or PDF file)`, 'warn'); return;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast(`${file.name} is too large (max 15 MB)`, 'error'); return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const result = Storage.save(file.name, e.target.result);
        refreshList();
        if (!first) { first = result.id; openFile(result.id); }
        toast(`Imported: ${file.name}`);
      };
      reader.onerror = () => toast(`Failed to read: ${file.name}`, 'error');
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ── PDF: open & render ────────────────────────────────
  async function openPDF(file) {
    if (file.size > 150 * 1024 * 1024) { toast('PDF too large (max 150 MB)', 'error'); return; }
    S.pdfName = file.name;
    S.mode    = 'pdf';
    setMode('pdf');
    el.topbarTitle.textContent    = file.name;
    el.pdfFilename.textContent    = file.name;
    el.pdfPageInfo.textContent    = '';
    el.pdfPages.innerHTML         = '';
    el.pdfLoading.classList.remove('hidden');
    el.pdfLoadLabel.textContent   = 'Loading PDF…';
    _showPreviewButtons(false);
    _updateBottomNav();
    closeSidebar();

    try {
      toast('Rendering PDF…', 'info', 1500);
      // Use _loadFromFile so raw bytes are preserved for AI conversion
      const pdfDoc = await PDFHandler._loadFromFile(file);
      S.pdfDoc = pdfDoc;
      el.pdfLoadLabel.textContent = `Rendering ${pdfDoc.numPages} pages…`;
      el.pdfProgress.classList.remove('hidden');

      await PDFHandler.renderToContainer(pdfDoc, el.pdfPages, (cur, tot) => {
        const pct = Math.round((cur / tot) * 100);
        el.pdfProgressBar.style.setProperty('--pct', pct + '%');
        el.pdfProgressLabel.textContent = `${pct}%`;
        el.pdfPageInfo.textContent = `${cur} / ${tot} pages`;
      });

      el.pdfProgress.classList.add('hidden');
      el.pdfLoading.classList.add('hidden');
      el.pdfPageInfo.textContent = `${pdfDoc.numPages} pages`;
      toast(`Loaded: ${file.name} (${pdfDoc.numPages} pages)`);
    } catch(e) {
      el.pdfLoading.classList.add('hidden');
      el.pdfProgress.classList.add('hidden');
      toast(`PDF error: ${e.message}`, 'error', 5000);
    }
  }

  // ── PDF: zoom ─────────────────────────────────────────
  function pdfZoom(delta) {
    if (!S.pdfDoc) return;
    S.pdfScale = Math.max(0.5, Math.min(3.0, S.pdfScale + delta));
    el.pdfPages.innerHTML = '';
    el.pdfLoading.classList.remove('hidden');
    el.pdfLoadLabel.textContent = 'Re-rendering…';
    PDFHandler.renderToContainer(S.pdfDoc, el.pdfPages, (c, t) => {
      el.pdfPageInfo.textContent = `${c} / ${t} pages`;
    }).then(() => el.pdfLoading.classList.add('hidden'));
  }

  // ── PDF: save rendered as HTML ────────────────────────
  async function savePDFRendered() {
    if (!S.pdfDoc || !el.pdfPages.querySelector('canvas')) {
      toast('Render the PDF first', 'warn'); return;
    }
    try {
      await PDFHandler.saveRenderedHTML(el.pdfPages, S.pdfName, S.isDark);
      toast('Saved rendered PDF as HTML file');
    } catch(e) {
      toast('Save failed: ' + e.message, 'error');
    }
  }

  // ── PDF: convert modal ────────────────────────────────
  // ═══════════════════════════════════════════════════════
  //  DATALAB KEY MANAGER
  //  Keys stored as: [{ id, label, key, exhausted }]
  //  in Storage prefs under 'datalabKeys'
  // ═══════════════════════════════════════════════════════

  function _dlGetKeys()         { return Storage.getPrefs().datalabKeys || []; }
  function _dlSaveKeys(keys)    { Storage.setPref('datalabKeys', keys); }
  function _dlUid()             { return 'dk_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  function _dlRenderKeys() {
    const keys     = _dlGetKeys();
    const listEl   = document.getElementById('dlKeyList');
    const noKeysEl = document.getElementById('dlNoKeys');
    if (!listEl) return;

    if (keys.length === 0) {
      listEl.innerHTML = '';
      noKeysEl?.classList.remove('hidden');
      return;
    }
    noKeysEl?.classList.add('hidden');

    listEl.innerHTML = keys.map((k, i) => `
      <div class="dl-key-row" data-id="${k.id}">
        <span class="dl-key-num">${i + 1}</span>
        <div class="dl-key-fields">
          <input class="dl-key-label-inp" data-id="${k.id}" type="text"
            placeholder="Label (e.g. Account 1)" value="${_escApp(k.label || '')}"
            autocomplete="off" spellcheck="false" />
          <div class="dl-key-secret-wrap">
            <input class="dl-key-val-inp" data-id="${k.id}" type="password"
              placeholder="Datalab API key" value="${_escApp(k.key || '')}"
              autocomplete="off" spellcheck="false" />
            <button class="dl-key-eye" data-id="${k.id}" title="Show/hide">👁</button>
          </div>
        </div>
        <div class="dl-key-status ${k.exhausted ? 'exhausted' : 'ok'}" title="${k.exhausted ? 'Credits exhausted' : 'Active'}">
          ${k.exhausted ? '⚠' : '●'}
        </div>
        <div class="dl-key-btns">
          ${i > 0 ? `<button class="dl-key-up"   data-id="${k.id}" title="Move up">↑</button>` : '<span></span>'}
          ${i < keys.length-1 ? `<button class="dl-key-dn" data-id="${k.id}" title="Move down">↓</button>` : '<span></span>'}
          <button class="dl-key-del" data-id="${k.id}" title="Remove">✕</button>
        </div>
      </div>`).join('');

    // Bind save-on-change for label + key inputs
    listEl.querySelectorAll('.dl-key-label-inp').forEach(inp => {
      inp.addEventListener('change', () => {
        const keys = _dlGetKeys();
        const k = keys.find(x => x.id === inp.dataset.id);
        if (k) { k.label = inp.value.trim(); _dlSaveKeys(keys); }
      });
    });
    listEl.querySelectorAll('.dl-key-val-inp').forEach(inp => {
      inp.addEventListener('change', () => {
        const keys = _dlGetKeys();
        const k = keys.find(x => x.id === inp.dataset.id);
        if (k) { k.key = inp.value.trim(); k.exhausted = false; _dlSaveKeys(keys); _dlRenderKeys(); }
      });
    });
    // Show/hide toggle
    listEl.querySelectorAll('.dl-key-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = listEl.querySelector(`.dl-key-val-inp[data-id="${btn.dataset.id}"]`);
        if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });
    // Move up/down
    listEl.querySelectorAll('.dl-key-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const keys = _dlGetKeys();
        const i = keys.findIndex(x => x.id === btn.dataset.id);
        if (i > 0) { [keys[i-1], keys[i]] = [keys[i], keys[i-1]]; _dlSaveKeys(keys); _dlRenderKeys(); }
      });
    });
    listEl.querySelectorAll('.dl-key-dn').forEach(btn => {
      btn.addEventListener('click', () => {
        const keys = _dlGetKeys();
        const i = keys.findIndex(x => x.id === btn.dataset.id);
        if (i < keys.length-1) { [keys[i], keys[i+1]] = [keys[i+1], keys[i]]; _dlSaveKeys(keys); _dlRenderKeys(); }
      });
    });
    // Delete
    listEl.querySelectorAll('.dl-key-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const keys = _dlGetKeys().filter(x => x.id !== btn.dataset.id);
        _dlSaveKeys(keys); _dlRenderKeys();
      });
    });
  }

  function _dlAddKey() {
    const keys = _dlGetKeys();
    keys.push({ id: _dlUid(), label: `Account ${keys.length + 1}`, key: '', exhausted: false });
    _dlSaveKeys(keys);
    _dlRenderKeys();
    // Focus the new key input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.dl-key-val-inp');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  }

  function _escApp(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

  // ── Active mode helper ──────────────────────────────────
  function _activeConvertMode() {
    const active = document.querySelector('.cmode-tab.active');
    return active?.dataset.mode || 'datalab';
  }

  // ── Open modal ────────────────────────────────────────
  function openConvertModal() {
    if (!S.pdfDoc) return;
    el.convertProgress.classList.add('hidden');
    el.convertBar.style.width = '0%';
    if (el.convertError) { el.convertError.classList.add('hidden'); el.convertError.textContent = ''; }
    el.pdfConvertStart.disabled = false;
    // Populate Gemini key
    const prefs = Storage.getPrefs();
    if (el.geminiKeyInput && prefs.geminiKey) el.geminiKeyInput.value = prefs.geminiKey;
    // Render Datalab keys
    _dlRenderKeys();
    el.pdfConvertModal.classList.remove('hidden');
  }

  // ── Run conversion ────────────────────────────────────
  async function runPDFConvert() {
    if (!S.pdfDoc) return;
    const mode = _activeConvertMode();

    // ── Validate ────────────────────────────────────────
    if (mode === 'datalab') {
      const keys = _dlGetKeys().filter(k => k.key?.trim());
      if (!keys.length) {
        _showConvertError('Add at least one Datalab API key, or switch to another mode.');
        return;
      }
    }
    if (mode === 'ai') {
      const key = el.geminiKeyInput?.value?.trim();
      if (!key) { _showConvertError('Paste your Gemini API key above, or switch to another mode.'); return; }
    }

    el.convertProgress.classList.remove('hidden');
    if (el.convertError) el.convertError.classList.add('hidden');
    el.pdfConvertStart.disabled = true;
    el.convertBar.style.width   = '0%';
    el.convertLabel.textContent  = 'Starting…';

    const onProg = (done, total, msg) => {
      const pct = total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0;
      el.convertBar.style.width   = pct + '%';
      el.convertLabel.textContent = msg || `${pct}%`;
    };

    try {
      let content, outputFormat = 'markdown';

      if (mode === 'datalab') {
        const dlKeys = _dlGetKeys().filter(k => k.key?.trim());
        const fmt    = document.getElementById('dlOutputFormat')?.value || 'markdown';
        const proc   = document.getElementById('dlMode')?.value || 'balanced';
        outputFormat = fmt;

        const { content: c, usedKey } = await PDFHandler.convertWithDatalab(
          S.pdfDoc.__fileBlob, S.pdfDoc.__fileName,
          dlKeys, fmt, proc, onProg
        );
        content = c;
        toast(`Converted via ${usedKey?.label || 'Datalab'}`, 'success', 2000);

      } else if (mode === 'ai') {
        const key = el.geminiKeyInput.value.trim();
        if (el.saveGeminiKey?.checked) Storage.setPref('geminiKey', key);
        content = await PDFHandler.convertWithAI(S.pdfDoc, key, onProg);

      } else {
        content = await PDFHandler.convertWithAlgo(S.pdfDoc, onProg);
      }

      // Save result
      const base    = S.pdfName.replace(/\.pdf$/i, '');
      const ext     = outputFormat === 'html' ? '.html' : '.md';
      const outName = base + ext;
      const result  = Storage.save(outName, content);
      refreshList();
      el.pdfConvertModal.classList.add('hidden');
      el.pdfConvertStart.disabled = false;
      toast(`Saved as "${outName}"`, 'success', 4000);
      // For HTML output, open in new tab; for markdown open in viewer
      if (outputFormat === 'html') {
        const blob = new Blob([content], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        openFile(result.id);
      }

    } catch(e) {
      el.pdfConvertStart.disabled = false;
      const msg = e.message || String(e);

      // Mark exhausted keys in UI
      if (e.exhaustedIds?.length) {
        const keys = _dlGetKeys();
        e.exhaustedIds.forEach(id => { const k = keys.find(x => x.id === id); if (k) k.exhausted = true; });
        _dlSaveKeys(keys); _dlRenderKeys();
      }

      _showConvertError(msg);
      toast('Conversion failed: ' + msg.slice(0, 80), 'error', 6000);
    }
  }

  function _showConvertError(msg) {
    if (!el.convertError) return;
    el.convertError.textContent = '⚠ ' + msg;
    el.convertError.classList.remove('hidden');
  }

  // ── Delete ────────────────────────────────────────────
  function deleteFile(id) {
    const meta = Storage.list().find(f => f.id === id);
    const name = meta?.name || 'this file';
    confirm(`Delete "${name}"? This cannot be undone.`, () => {
      Storage.remove(id);
      if (S.activeId === id) {
        S.activeId = null;
        S.mode     = 'drop';
        setMode('drop');
        el.topbarTitle.textContent = 'Select or create a file';
        _showPreviewButtons(false);
        _updateBottomNav();
      }
      refreshList();
      toast(`Deleted: ${name}`, 'info');
    });
  }

  function deleteAll() {
    const s = Storage.stats();
    if (s.count === 0) { toast('No files to delete', 'info'); return; }
    confirm(
      `Delete all ${s.count} file${s.count !== 1 ? 's' : ''}? Cannot be undone.`,
      () => {
        Storage.removeAll();
        S.activeId = null; S.mode = 'drop';
        setMode('drop');
        el.topbarTitle.textContent = 'Select or create a file';
        _showPreviewButtons(false);
        _updateBottomNav();
        refreshList();
        toast('All files deleted', 'info');
      }
    );
  }

  // ── Mode switching ────────────────────────────────────
  function setMode(mode) {
    el.dropZone.classList.toggle("hidden",    mode !== "drop");
    el.editorWrap.classList.toggle("hidden",  mode !== "editor");
    el.previewWrap.classList.toggle("hidden", mode !== "preview");
    if (el.pdfWrap) el.pdfWrap.classList.toggle("hidden", mode !== "pdf");
    document.getElementById("splitWrap")?.classList.toggle("hidden", mode !== "split");
    if (mode !== "preview") { el.tocPanel.classList.add("hidden"); S.tocOpen = false; }
    if (mode !== "pdf" && S.pdfDoc) PDFHandler.cancelRender();
    if (mode !== "split") S.splitMode = false;
  }

  function _showPreviewButtons(show) {
    [el.editBtn, el.copyBtn, el.shareBtn, el.aiChatBtn, el.aiSummaryBtn,
     el.focusBtn, el.exportBtn, el.printBtn,
     document.getElementById('splitBtn'),
     document.getElementById('findBtn'),
    ].forEach(b => { if (b) b.classList.toggle('hidden', !show); });
    if (!show) {
      el.tocBtn?.classList.add('hidden');
      el.readingProgressBar?.classList.add('hidden');
      el.aiChatPanel?.classList.add('hidden');
      _closeFindBar();
    } else {
      el.readingProgressBar?.classList.remove('hidden');
    }
  }

  // ── Sidebar open/close ───────────────────────────────
  function _isMobile() { return window.innerWidth <= 640; }
  function _sidebarVisible() { return !document.body.classList.contains('sidebar-collapsed'); }

  function openSidebar() {
    document.body.classList.remove('sidebar-collapsed');
    if (_isMobile()) {
      el.sidebar.classList.add('open');
      el.sidebarBackdrop.classList.remove('hidden');
      el.sidebarBackdrop.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSidebar() {
    document.body.classList.add('sidebar-collapsed');
    el.sidebar.classList.remove('open');
    el.sidebarBackdrop.classList.remove('show');
    el.sidebarBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    if (_sidebarVisible()) closeSidebar(); else openSidebar();
  }

  // ── Bottom nav ────────────────────────────────────────
  function _updateBottomNav() {
    const inPreview = S.mode === 'preview' && S.activeId;
    const inEditor  = S.mode === 'editor';
    el.bnEdit.classList.toggle('hidden',   !inPreview);
    el.bnExport.classList.toggle('hidden', !inPreview);
    el.bnNew.classList.toggle('hidden',    inEditor);
    // Active state
    el.bnFiles.classList.toggle('active', false);
    el.bnEdit.classList.toggle('active',  inEditor);
  }

  // ── TOC ───────────────────────────────────────────────
  function toggleTOC() {
    S.tocOpen = !S.tocOpen;
    el.tocPanel.classList.toggle('hidden', !S.tocOpen);
  }

  // ── Drag & drop ───────────────────────────────────────
  function _initDragDrop() {
    const dz = el.dropZone;

    ['dragenter','dragover'].forEach(ev => {
      dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); });
    });
    ['dragleave','dragend'].forEach(ev => {
      dz.addEventListener(ev, e => {
        if (!dz.contains(e.relatedTarget)) dz.classList.remove('drag-over');
      });
    });
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    });

    // Global drop (outside drop zone too)
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    });
  }

  // ── Cloud setup modal ─────────────────────────────────
  function openCloudModal() {
    const saved = Storage.getSavedConfig();
    if (saved) el.cloudConfigInput.value = saved;
    el.cloudError?.classList.add('hidden');
    el.cloudConnecting?.classList.add('hidden');

    const isConn   = Storage.isConnected();
    const isSigned = Storage.isSignedIn();
    const user     = Storage.getCurrentUser();

    // Show/hide config vs sign-in sections
    document.getElementById('cloudStepConfig')?.classList.toggle('hidden', isConn && isSigned);
    const signinSection = document.getElementById('cloudSigninSection');
    if (signinSection) signinSection.classList.toggle('hidden', !isConn || isSigned);

    // Update sign-in status text
    const statusEl = document.getElementById('cloudSigninStatus');
    if (statusEl) {
      if (isSigned && user) {
        statusEl.innerHTML = `<div class="cloud-user-row">
          ${user.photoURL ? `<img src="${user.photoURL}" class="cloud-user-photo" />` : ''}
          <div>
            <strong>${_esc(user.displayName || 'Signed in')}</strong>
            <span>${_esc(user.email || '')}</span>
          </div>
          <span class="sync-dot connected" style="flex-shrink:0"></span>
        </div>`;
      } else if (isConn) {
        statusEl.innerHTML = `<p style="font-size:12.5px;color:var(--txt2)">Firebase connected. Sign in with Google to sync across devices.</p>`;
      }
    }

    // Button visibility
    if (el.cloudDisconnect) el.cloudDisconnect.style.display = isConn ? 'inline-flex' : 'none';
    const signOutBtn = document.getElementById('cloudSignOutBtn');
    if (signOutBtn)   signOutBtn.style.display = isSigned ? 'inline-flex' : 'none';
    if (el.cloudConnect) el.cloudConnect.style.display = isConn ? 'none' : 'inline-flex';

    el.cloudModal.classList.remove('hidden');
  }

  async function handleCloudConnect() {
    const raw = el.cloudConfigInput?.value?.trim();
    if (!raw) { _showCloudError('Paste your Firebase config JSON above.'); return; }
    el.cloudError?.classList.add('hidden');
    el.cloudConnecting?.classList.remove('hidden');
    if (el.cloudConnect) el.cloudConnect.disabled = true;
    try {
      await Storage.connectFirebase(raw);
      el.cloudConnecting?.classList.add('hidden');
      if (el.cloudConnect) el.cloudConnect.disabled = false;
      toast('☁ Firebase connected!', 'success', 2500);
      refreshList();
      // Show the sign-in section without closing modal
      openCloudModal();
    } catch(e) {
      el.cloudConnecting?.classList.add('hidden');
      if (el.cloudConnect) el.cloudConnect.disabled = false;
      _showCloudError(e.message);
    }
  }

  function _showCloudError(msg) {
    if (!el.cloudError) return;
    el.cloudError.textContent = '⚠ ' + msg;
    el.cloudError.classList.remove('hidden');
  }

  async function handleCloudDisconnect() {
    await Storage.disconnectFirebase(true);
    el.cloudModal.classList.add('hidden');
    toast('Disconnected — local only', 'info');
    refreshList();
  }

  // ── Copy HTML ─────────────────────────────────────────
  function copyHTML() {
    const html = el.markdownBody.innerHTML;
    navigator.clipboard.writeText(html).then(() => {
      toast('HTML copied to clipboard');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = html; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('HTML copied to clipboard');
    });
  }

  // ── Keyboard shortcuts ────────────────────────────────
  function _initKeyboard() {
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      const inField = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);

      if (ctrl && e.key === 's') {
        e.preventDefault();
        if (S.mode === 'editor') saveEditor();
        return;
      }
      if (ctrl && e.key === 'e' && S.mode === 'preview') {
        e.preventDefault(); if (S.activeId) editFile(S.activeId); return;
      }
      if (ctrl && e.shiftKey && e.key.toUpperCase() === 'N') {
        e.preventDefault(); newFile(); return;
      }
      if (e.key === 'Escape') {
        if (FocusMode.isActive()) { FocusMode.exit(); return; }
        if (CommandPalette.isVisible()) { CommandPalette.hide(); return; }
        if (!document.getElementById('findBar')?.classList.contains('hidden')) { _closeFindBar(); return; }
        if (!el.aiSettingsModal?.classList.contains('hidden')) { el.aiSettingsModal.classList.add('hidden'); return; }
        if (!el.aiSummaryModal?.classList.contains('hidden'))  { el.aiSummaryModal.classList.add('hidden');  return; }
        if (!document.getElementById('templatesModal')?.classList.contains('hidden')) { document.getElementById('templatesModal').classList.add('hidden'); return; }
        if (!document.getElementById('importUrlModal')?.classList.contains('hidden')) { document.getElementById('importUrlModal').classList.add('hidden'); return; }
        if (!document.getElementById('helpModal')?.classList.contains('hidden')) { document.getElementById('helpModal').classList.add('hidden'); return; }
        if (!el.cloudModal.classList.contains('hidden')) { el.cloudModal.classList.add('hidden'); return; }
        if (!el.shareModal?.classList.contains('hidden')) { el.shareModal.classList.add('hidden'); return; }
        if (!el.manageLinksModal?.classList.contains('hidden')) { el.manageLinksModal.classList.add('hidden'); return; }
        if (!el.newFileOverlay.classList.contains('hidden')) { el.newFileOverlay.classList.add('hidden'); return; }
        if (!el.modalOverlay.classList.contains('hidden')) { el.modalOverlay.classList.add('hidden'); return; }
        if (!el.aiChatPanel?.classList.contains('hidden')) { el.aiChatPanel.classList.add('hidden'); return; }
        if (!el.writingToolsBar?.classList.contains('hidden')) { el.writingToolsBar.classList.add('hidden'); return; }
        if (S.splitMode) { _exitSplitMode(); return; }
        if (S.tocOpen) { toggleTOC(); return; }
        if (el.sidebar.classList.contains('open') && _isMobile()) { closeSidebar(); return; }
        if (S.mode === 'editor') { cancelEditor(); return; }
        if (!el.lightbox.classList.contains('hidden')) { Renderer.closeLightbox(); return; }
        return;
      }
      // Cmd+K — Command palette
      if (ctrl && e.key === 'k') { e.preventDefault(); _openCommandPalette(); return; }
      // Cmd+F — Find in document
      if (ctrl && e.key === 'f' && S.mode === 'preview') { e.preventDefault(); _openFindBar(); return; }
      // Cmd+/ — Writing tools (editor mode)
      if (ctrl && e.key === '/' && S.mode === 'editor') { e.preventDefault(); _showWritingTools(); return; }
      // Cmd+Shift+S — AI Summary
      if (ctrl && e.shiftKey && e.key.toUpperCase() === 'S' && S.mode === 'preview') { e.preventDefault(); _openAISummary(); return; }
      // Cmd+Shift+F — Focus mode
      if (ctrl && e.shiftKey && e.key.toUpperCase() === 'F') { e.preventDefault(); _enterFocus(); return; }
      // ? — Keyboard help (not in input fields)
      if (!inField && !ctrl && e.key === '?') { e.preventDefault(); document.getElementById('helpModal')?.classList.remove('hidden'); return; }
      // Delegate to command palette for arrow/enter
      if (CommandPalette.handleKey(e)) return;
      if (!inField && !ctrl && e.key === '/') {
        e.preventDefault(); el.searchInput.focus(); return;
      }
    });
  }

  // ── Demo file ─────────────────────────────────────────
  function _loadDemoFile() {
    const demo = `# Welcome to MarkVault ◈

> A cross-device Markdown viewer with **Firebase sync**, syntax highlighting, KaTeX math, and Mermaid diagrams — deploy on GitHub Pages for free.

## ✨ Feature Overview

| Feature | Details |
|---------|---------|
| **GFM Rendering** | Full GitHub Flavored Markdown support |
| **Syntax Highlighting** | 200+ languages via highlight.js |
| **KaTeX Math** | Inline \`$...$\` and block \`$$...$$\` |
| **Mermaid Diagrams** | Flowcharts, sequence, gantt, pie & more |
| **Firebase Sync** | Files available on every device |
| **localStorage** | Works offline, instant writes |
| **Export to HTML** | Standalone themed output |
| **Dark / Light** | Remembers your preference |

## 💻 Code Highlighting

\`\`\`python
from dataclasses import dataclass
from typing import Optional
import hashlib, time

@dataclass
class Document:
    id: str
    name: str
    content: str
    updated_at: float = time.time()

    def word_count(self) -> int:
        return len(self.content.split())

    def checksum(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()[:8]
\`\`\`

\`\`\`typescript
interface FileRecord {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
  bytes: number;
}

async function syncToCloud(
  db: Firestore,
  file: FileRecord
): Promise<void> {
  await db.collection('markvault_files')
    .doc(file.id)
    .set(file, { merge: true });
}
\`\`\`

## ∑ Math — KaTeX

Inline: $E = mc^2$ · Euler's identity: $e^{i\\pi} + 1 = 0$

Display block:

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\, dx
$$

Maxwell's first equation:

$$
\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}
$$

## 📊 Mermaid Diagrams

\`\`\`mermaid
flowchart TD
    A([User opens MarkVault]) --> B{Files exist?}
    B -- Yes --> C[Load last open file]
    B -- No  --> D[Show welcome demo]
    C & D --> E[Render Markdown]
    E --> F{Firebase configured?}
    F -- Yes --> G[Real-time sync ☁]
    F -- No  --> H[Local storage only 💾]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant B as Browser
    participant L as localStorage
    participant F as Firestore
    B->>L: save(name, content)
    L-->>B: file ID (instant)
    B->>F: _fbSave(file) async
    F-->>B: onSnapshot update
    Note over F,B: All devices receive live updates
\`\`\`

## 📋 Callouts (GitHub style)

> [!NOTE]
> Press **/** to focus search, **Ctrl+S** to save in editor mode.

> [!TIP]
> Click the ☁ cloud icon in the sidebar to set up Firebase and sync files across all your devices.

> [!WARNING]
> localStorage is browser-specific. Without Firebase, your files won't appear on other devices.

## ☑ Task Lists

- [x] Full GFM rendering
- [x] Syntax highlighting (200+ languages)
- [x] KaTeX math support
- [x] Mermaid diagrams
- [x] Firebase cross-device sync
- [x] Dark / Light theme
- [x] Mobile responsive layout
- [x] Export to HTML
- [ ] Real-time collaboration *(coming soon)*

## ⌨ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| \`Ctrl+S\` | Save (in editor) |
| \`Ctrl+E\` | Open editor |
| \`Ctrl+Shift+N\` | New file |
| \`/\` | Focus search |
| \`Esc\` | Close panels |

---

*Built with [marked.js](https://marked.js.org), [highlight.js](https://highlightjs.org), [KaTeX](https://katex.org), [Mermaid](https://mermaid.js.org), and [Firebase](https://firebase.google.com)*
`;
    const r = Storage.save('Welcome.md', demo);
    refreshList();
    openFile(r.id);
  }

  // ── Init ──────────────────────────────────────────────
  async function init() {
    // Theme
    const prefs = Storage.getPrefs();
    applyTheme((prefs.theme || 'dark') === 'dark');

    // Mode
    setMode('drop');
    refreshList();

    // Mobile bottom nav
    if (window.innerWidth <= 640) el.bottomNav.classList.remove('hidden');

    // Sidebar toggle
    el.sidebarOpen.addEventListener('click', toggleSidebar);
    el.sidebarClose.addEventListener('click', closeSidebar);
    el.sidebarBackdrop.addEventListener('click', closeSidebar);

    // Theme
    el.themeToggle.addEventListener('click', () => applyTheme(!S.isDark));

    // Search
    el.searchInput.addEventListener('input', () => {
      S.searchQ = el.searchInput.value;
      el.searchClear.classList.toggle('hidden', !S.searchQ);
      refreshList();
    });
    el.searchClear.addEventListener('click', () => {
      el.searchInput.value = ''; S.searchQ = '';
      el.searchClear.classList.add('hidden');
      refreshList(); el.searchInput.focus();
    });

    // New file
    el.newFileBtn.addEventListener('click', () => newFile());
    el.writeNewBtn.addEventListener('click', () => newFile());
    el.newFileCreate.addEventListener('click', () => {
      const name = el.newFileName.value.trim();
      el.newFileOverlay.classList.add('hidden');
      _createNewFile(name);
    });
    el.newFileCancel.addEventListener('click', () => el.newFileOverlay.classList.add('hidden'));
    el.newFileName.addEventListener('keydown', e => {
      if (e.key === 'Enter') el.newFileCreate.click();
      if (e.key === 'Escape') el.newFileCancel.click();
    });
    el.newFileOverlay.addEventListener('click', e => {
      if (e.target === el.newFileOverlay) el.newFileOverlay.classList.add('hidden');
    });

    // Import
    el.importBtn.addEventListener('click', () => el.fileInput.click());
    el.browseBtn.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', () => {
      importFiles(el.fileInput.files); el.fileInput.value = '';
    });

    // Delete all
    el.deleteAllBtn.addEventListener('click', deleteAll);

    // Editor
    el.editorSaveBtn.addEventListener('click', saveEditor);
    el.editorCancelBtn.addEventListener('click', cancelEditor);
    el.editorArea.addEventListener('input', _updateWordCount);
    el.editorArea.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveEditor(); }
      // Tab key → insert 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = el.editorArea;
        const s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
        _updateWordCount();
      }
    });

    // Topbar actions
    el.editBtn.addEventListener('click', () => { if (S.activeId) editFile(S.activeId); });
    el.copyBtn.addEventListener('click', copyHTML);
    el.exportBtn.addEventListener('click', () => {
      if (!S.activeId) return;
      const file = Storage.load(S.activeId);
      if (file) { Renderer.exportHTML(file.name, el.markdownBody.innerHTML, S.isDark); toast('Exported as HTML'); }
    });
    el.printBtn.addEventListener('click', () => window.print());
    el.tocBtn.addEventListener('click', toggleTOC);
    el.tocClose.addEventListener('click', toggleTOC);

    // Bottom nav
    el.bnFiles.addEventListener('click', () => {
      if (_isMobile()) openSidebar();
    });
    el.bnEdit.addEventListener('click', () => { if (S.activeId) editFile(S.activeId); });
    el.bnExport.addEventListener('click', () => {
      if (!S.activeId) return;
      const file = Storage.load(S.activeId);
      if (file) { Renderer.exportHTML(file.name, el.markdownBody.innerHTML, S.isDark); toast('Exported'); }
    });
    el.bnNew.addEventListener('click', () => newFile());

    // PDF actions
    if (el.pdfConvertBtn)    el.pdfConvertBtn.addEventListener('click', openConvertModal);
    if (el.pdfSaveBtn)       el.pdfSaveBtn.addEventListener('click', savePDFRendered);
    if (el.pdfZoomIn)        el.pdfZoomIn.addEventListener('click', () => pdfZoom(0.25));
    if (el.pdfZoomOut)       el.pdfZoomOut.addEventListener('click', () => pdfZoom(-0.25));
    if (el.pdfConvertStart)  el.pdfConvertStart.addEventListener('click', runPDFConvert);
    if (el.pdfConvertCancel) el.pdfConvertCancel.addEventListener('click', () => {
      el.pdfConvertModal.classList.add('hidden');
    });
    if (el.pdfConvertModal) el.pdfConvertModal.addEventListener('click', e => {
      if (e.target === el.pdfConvertModal) el.pdfConvertModal.classList.add('hidden');
    });

    // Convert mode tabs (Datalab / Gemini / Algorithm)
    document.querySelectorAll('.cmode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cmode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.mode;
        document.getElementById('cPanelDatalab')?.classList.toggle('hidden', mode !== 'datalab');
        document.getElementById('cPanelAI')?.classList.toggle('hidden',      mode !== 'ai');
        document.getElementById('cPanelAlgo')?.classList.toggle('hidden',    mode !== 'algo');
        if (el.convertError) el.convertError.classList.add('hidden');
        // Render key list when switching to datalab tab
        if (mode === 'datalab') _dlRenderKeys();
      });
    });

    // Datalab add-key button
    document.getElementById('dlAddKey')?.addEventListener('click', _dlAddKey);

    // API key show/hide toggle
    if (el.geminiKeyToggle) {
      el.geminiKeyToggle.addEventListener('click', () => {
        const inp = el.geminiKeyInput;
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    }

    // Sync now
    el.syncNowBtn.addEventListener('click', async () => {
      toast('Syncing…', 'info', 1500);
      await Storage.forcSync();
      refreshList();
    });

    // Cloud modal
    el.cloudSetupBtn.addEventListener('click', openCloudModal);
    el.syncBadge.addEventListener('click',     openCloudModal);
    el.cloudConnect.addEventListener('click',    handleCloudConnect);
    el.cloudDisconnect.addEventListener('click', handleCloudDisconnect);
    el.cloudCancel.addEventListener('click', () => el.cloudModal.classList.add('hidden'));

    // Sign-in from inside cloud modal
    document.getElementById('cloudGoogleSignIn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudGoogleSignIn');
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
        await Storage.signInWithGoogle();
        // _handleAuthChange fires → closes gate + boots app
        el.cloudModal.classList.add('hidden');
      } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in with Google'; }
        if (e.message && !e.message.includes('popup')) _showCloudError(e.message);
      }
    });

    // Sign out from cloud modal
    document.getElementById('cloudSignOutBtn')?.addEventListener('click', async () => {
      await Storage.signOut();
      el.cloudModal.classList.add('hidden');
      toast('Signed out — files still available locally', 'info', 3000);
    });
    el.cloudModal.addEventListener('click', e => {
      if (e.target === el.cloudModal) el.cloudModal.classList.add('hidden');
    });

    // Lightbox
    el.lightboxClose.addEventListener('click', Renderer.closeLightbox);
    el.lightbox.addEventListener('click', e => {
      if (e.target === el.lightbox) Renderer.closeLightbox();
    });

    // ── Share modal ────────────────────────────────────
    el.shareBtn?.addEventListener('click', _openShareModal);
    el.shareClose?.addEventListener('click', () => el.shareModal?.classList.add('hidden'));
    el.shareModal?.addEventListener('click', e => { if (e.target === el.shareModal) el.shareModal.classList.add('hidden'); });
    el.shareGoCloud?.addEventListener('click', () => { el.shareModal?.classList.add('hidden'); openCloudModal(); });
    el.shareGenerate?.addEventListener('click', _generateShareLink);
    el.shareCopyLink?.addEventListener('click', _copyShareLink);
    el.shareRevokeBtn?.addEventListener('click', _revokeShareLink);
    el.shareQRBtn?.addEventListener('click', _toggleQR);
    el.shareManageBtn?.addEventListener('click', _openManageLinks);
    el.manageLinksClose?.addEventListener('click', () => el.manageLinksModal?.classList.add('hidden'));
    document.getElementById('analyticsRefresh')?.addEventListener('click', _openManageLinks);
    el.manageLinksModal?.addEventListener('click', e => { if (e.target === el.manageLinksModal) el.manageLinksModal.classList.add('hidden'); });

    // ── Focus mode ─────────────────────────────────────
    el.focusBtn?.addEventListener('click', _enterFocus);
    el.focusExit?.addEventListener('click', () => FocusMode.exit());
    el.focusFontDec?.addEventListener('click', () => FocusMode.adjustFont(-1));
    el.focusFontInc?.addEventListener('click', () => FocusMode.adjustFont(1));
    el.focusWidthSel?.addEventListener('change', () => FocusMode.setWidth(el.focusWidthSel.value));
    el.focusTheme?.addEventListener('click', () => FocusMode.toggleTheme());
    el.focusOverlay?.addEventListener('click', e => { if (e.target === el.focusOverlay) FocusMode.exit(); });

    // ── AI Chat ───────────────────────────────────────
    el.aiChatBtn?.addEventListener('click', _toggleAIChat);
    el.aiChatClose?.addEventListener('click', () => el.aiChatPanel?.classList.add('hidden'));
    el.aiChatClear?.addEventListener('click', () => {
      if (S.activeId) AIFeatures.clearChat(S.activeId);
      if (el.aiChatMessages) el.aiChatMessages.innerHTML = `
        <div class="ai-chat-welcome">
          <div class="ai-chat-welcome-icon">◈</div>
          <p>Ask anything about this document.</p>
          <div class="ai-chat-starters" id="aiChatStarters"></div>
        </div>`;
      _renderChatStarters();
    });
    el.aiChatSend?.addEventListener('click', () => _sendChatMsg());
    el.aiChatInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendChatMsg(); }
      // Auto-resize textarea
      el.aiChatInput.style.height = 'auto';
      el.aiChatInput.style.height = Math.min(el.aiChatInput.scrollHeight, 80) + 'px';
    });

    // ── AI Summary ────────────────────────────────────
    el.aiSummaryBtn?.addEventListener('click', _openAISummary);
    el.aiSummaryClose?.addEventListener('click', () => el.aiSummaryModal?.classList.add('hidden'));
    el.aiSummaryModal?.addEventListener('click', e => { if (e.target === el.aiSummaryModal) el.aiSummaryModal.classList.add('hidden'); });
    el.aiSummarySave?.addEventListener('click', () => {
      if (!S._lastSummary || !S.activeId) return;
      const file = Storage.load(S.activeId);
      const name = (file?.name || 'doc').replace(/\.(md|txt)$/i,'') + '_summary.md';
      const result = Storage.save(name, `# Summary: ${file?.name || 'Document'}\n\n${S._lastSummary}`);
      refreshList();
      el.aiSummaryModal?.classList.add('hidden');
      toast(`Saved as "${name}"`);
      openFile(result.id);
    });

    // ── AI Settings ───────────────────────────────────
    el.aiSettingsSave?.addEventListener('click', _saveAISettings);
    el.aiSettingsClose?.addEventListener('click', () => el.aiSettingsModal?.classList.add('hidden'));
    el.aiSettingsModal?.addEventListener('click', e => { if (e.target === el.aiSettingsModal) el.aiSettingsModal.classList.add('hidden'); });

    // Add AI gear button to sidebar footer
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter) {
      const gearBtn = document.createElement('button');
      gearBtn.className = 'ai-settings-btn';
      gearBtn.title = 'AI Settings';
      gearBtn.textContent = '⚙';
      gearBtn.addEventListener('click', _openAISettings);
      sidebarFooter.insertBefore(gearBtn, sidebarFooter.querySelector('.danger-icon'));
    }

    // ── Writing Tools ──────────────────────────────────
    _initWritingTools();
    // Show writing tools bar when text is selected in editor
    el.editorArea?.addEventListener('mouseup', () => {
      if (el.editorArea.selectionStart !== el.editorArea.selectionEnd) {
        _showWritingTools();
      }
    });
    el.editorArea?.addEventListener('keyup', e => {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (el.editorArea.selectionStart !== el.editorArea.selectionEnd) _showWritingTools();
      }
    });

    // ── Command Palette ────────────────────────────────
    el.cpInput?.addEventListener('input', () => CommandPalette.handleInput(el.cpInput.value));
    el.commandPalette?.addEventListener('click', e => { if (e.target === el.commandPalette) CommandPalette.hide(); });

    // Add doc tags bar to preview wrap
    const previewWrap = document.getElementById('previewWrap');
    if (previewWrap) {
      const tagsBar = document.createElement('div');
      tagsBar.id = 'docTagsBar';
      tagsBar.className = 'doc-tags-bar hidden';
      previewWrap.insertBefore(tagsBar, previewWrap.querySelector('.preview-with-chat'));
    }

    // ── Templates ──────────────────────────────────────
    document.getElementById('templateClose')?.addEventListener('click', () => {
      document.getElementById('templatesModal')?.classList.add('hidden');
    });
    document.getElementById('templatesModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('templatesModal'))
        document.getElementById('templatesModal').classList.add('hidden');
    });
    // Replace "New file" button with template chooser + keep quick new
    el.newFileBtn.addEventListener('click', () => _openTemplates());
    el.writeNewBtn?.addEventListener('click', () => _openTemplates());

    // ── Import from URL ────────────────────────────────
    document.getElementById('importUrlBtn')?.addEventListener('click', () => {
      document.getElementById('importUrlModal')?.classList.remove('hidden');
      setTimeout(() => document.getElementById('importUrlInput')?.focus(), 50);
    });
    document.getElementById('importUrlGo')?.addEventListener('click', _importFromUrl);
    document.getElementById('importUrlCancel')?.addEventListener('click', () => {
      document.getElementById('importUrlModal')?.classList.add('hidden');
    });
    document.getElementById('importUrlInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _importFromUrl();
      if (e.key === 'Escape') document.getElementById('importUrlModal')?.classList.add('hidden');
    });
    document.getElementById('importUrlModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('importUrlModal'))
        document.getElementById('importUrlModal').classList.add('hidden');
    });

    // ── In-document search (Find bar) ──────────────────
    document.getElementById('findBtn')?.addEventListener('click', _openFindBar);
    document.getElementById('findClose')?.addEventListener('click', _closeFindBar);
    document.getElementById('findNext')?.addEventListener('click', () => _doFind(true));
    document.getElementById('findPrev')?.addEventListener('click', () => _doFind(false));
    document.getElementById('findInput')?.addEventListener('input', () => {
      _clearFindHighlights(); _findMatches = []; _findCurrent = -1;
      const count = document.getElementById('findCount');
      if (count) count.textContent = '';
      if (document.getElementById('findInput').value.trim()) _doFind(true);
    });
    document.getElementById('findInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.shiftKey) _doFind(false);
      else if (e.key === 'Enter') _doFind(true);
      else if (e.key === 'Escape') _closeFindBar();
    });
    document.getElementById('findCase')?.addEventListener('change', () => {
      _clearFindHighlights(); _findMatches = []; _findCurrent = -1;
      if (document.getElementById('findInput')?.value.trim()) _doFind(true);
    });

    // ── Split pane ─────────────────────────────────────
    document.getElementById('splitBtn')?.addEventListener('click', () => {
      if (S.splitMode) _exitSplitMode(); else _enterSplitMode();
    });
    // Split pane save
    document.getElementById('splitEditorArea')?.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); _autoSave();
        toast('Saved', 'success', 1200);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target, s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });

    // ── Auto-save dirty tracking in main editor ────────
    el.editorArea?.addEventListener('input', _markDirty);
    document.getElementById('unsavedSaveBtn')?.addEventListener('click', () => {
      saveEditor(); el.unsavedBadge?.classList.add('hidden');
    });

    // ── Help modal ─────────────────────────────────────
    document.getElementById('helpClose')?.addEventListener('click', () => {
      document.getElementById('helpModal')?.classList.add('hidden');
    });
    document.getElementById('helpModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('helpModal'))
        document.getElementById('helpModal').classList.add('hidden');
    });

    // ── Split and Find in _showPreviewButtons ──────────
    // (already handled by _showPreviewButtons patch above)

    // ── PWA ────────────────────────────────────────────
    _initPWA();
    _initAccountMenu();

    // Keyboard
    _initKeyboard();

    // Drag & drop
    _initDragDrop();

    // Resize → show/hide bottom nav
    const mqMobile = window.matchMedia('(max-width:640px)');
    mqMobile.addEventListener('change', mq => {
      el.bottomNav.classList.toggle('hidden', !mq.matches);
      if (!mq.matches) {
        // Switched to desktop: clean up mobile-specific overlay state
        el.sidebar.classList.remove('open');
        el.sidebarBackdrop.classList.remove('show');
        el.sidebarBackdrop.classList.add('hidden');
        document.body.style.overflow = '';
        // But keep sidebar visible (remove collapsed class) on desktop
        document.body.classList.remove('sidebar-collapsed');
      }
    });

    // Storage hooks
    Storage.onStatusChange(_updateSyncBadge);
    Storage.onRemoteChange(() => {
      refreshList();
      if (S.activeId && S.mode === 'preview') {
        const file = Storage.load(S.activeId);
        if (file) _renderFile(file);
      }
      toast('Files updated from cloud', 'info', 2000);
    });

    // ── Auth state hook ────────────────────────────────
    Storage.onAuthChange(_handleAuthChange);

    // ── Handle OAuth redirect result FIRST (mobile fallback) ──
    // On mobile, signInWithPopup falls back to redirect. When the page
    // reloads after the redirect, we must call handleRedirectResult()
    // before anything else so the auth state is set correctly.
    await Storage.handleRedirectResult().catch(() => {});

    // ── Auto-connect Firebase (restores saved config) ──
    const connected = await Storage.autoConnect();

    // Handle ?share=TOKEN (works without auth)
    if (SharedViewer.isSharedView()) {
      await SharedViewer.init();  // uses REST API — no SDK/auth needed
      return;
    }

    // Handle ?open=FILE_ID from "Save to vault" redirect
    const openParam = new URLSearchParams(window.location.search).get('open');
    if (openParam && Storage.load(openParam)) {
      await openFile(openParam);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // No Firebase config saved at all → show auth gate immediately
    if (!connected) {
      _showAuthGate(false);
      return;
    }

    // Firebase connected: onAuthStateChanged fires within ~300ms.
    // We wait a bit then check; if still not signed in, show the gate.
    // _handleAuthChange will close it the moment auth resolves.
    await new Promise(r => setTimeout(r, 600));
    if (!Storage.isSignedIn() && !_authGateDismissed) {
      _showAuthGate(true); // true = Firebase already connected, show sign-in directly
    }
  }

  // ── Auth gate ─────────────────────────────────────────
  let _authGateDismissed = false;

  function _showAuthGate(firebaseConnected = false) {
    const gate = document.getElementById('authGate');
    if (!gate) return;

    // If Firebase is already connected, skip the "set up Firebase" step
    // and show an informational note instead
    if (firebaseConnected) {
      const sub = gate.querySelector('.auth-gate-sub');
      if (sub) sub.textContent = 'Sign in with Google to sync files across all your devices.';
    }

    gate.classList.remove('hidden');

    // Wire the Google button — addEventListener with { once } so it
    // can't stack if _showAuthGate is called more than once
    const googleBtn = document.getElementById('authGoogleSignIn');
    if (googleBtn) {
      // Clone to remove any previously attached listeners
      const freshBtn = googleBtn.cloneNode(true);
      googleBtn.parentNode.replaceChild(freshBtn, googleBtn);

      freshBtn.addEventListener('click', async () => {
        // Guard: Firebase must be connected first
        if (!Storage.isConnected()) {
          // No Firebase config yet — guide user to set it up
          gate.classList.add('hidden');
          openCloudModal();
          toast('Set up Firebase first, then sign in with Google', 'info', 5000);
          return;
        }

        _setAuthBtnState(freshBtn, 'loading');
        try {
          await Storage.signInWithGoogle();
          // On desktop: popup resolves → onAuthChange fires → gate closes
          // On mobile: redirect → page reloads → handleRedirectResult handles it
        } catch(e) {
          _setAuthBtnState(freshBtn, 'idle');
          const msg = e.message || '';
          if (!msg.includes('popup') && !msg.includes('cancel') && !msg.includes('closed')) {
            toast('Sign-in error: ' + msg, 'error', 6000);
          }
        }
      });
    }

    const skipBtn = document.getElementById('authSkip');
    if (skipBtn) {
      const freshSkip = skipBtn.cloneNode(true);
      skipBtn.parentNode.replaceChild(freshSkip, skipBtn);
      freshSkip.addEventListener('click', () => {
        _authGateDismissed = true;
        gate.classList.add('hidden');
        _bootApp();
      });
    }
  }

  function _setAuthBtnState(btn, state) {
    if (state === 'loading') {
      btn.disabled = true;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" class="spin-icon" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg> Signing in…`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google`;
    }
  }

  async function _handleAuthChange(user) {
    // Close auth gate if open
    document.getElementById('authGate')?.classList.add('hidden');
    _authGateDismissed = true;

    if (user) {
      // Update avatar
      _updateAvatar(user);
      document.getElementById('userAvatarBtn')?.classList.remove('hidden');
      toast(`Welcome${user.displayName ? ', ' + user.displayName.split(' ')[0] : ''}! ◈`, 'success', 3000);
      // Boot the app content
      await _bootApp();
    } else {
      // Signed out
      document.getElementById('userAvatarBtn')?.classList.add('hidden');
      document.getElementById('accountMenu')?.classList.add('hidden');
    }
  }

  async function _bootApp() {
    const prefs = Storage.getPrefs();
    refreshList();
    const lastId = prefs.lastOpenId;
    if (lastId && Storage.load(lastId)) {
      await openFile(lastId);
    } else if (Storage.list().length === 0) {
      _loadDemoFile();
    } else {
      const files = Storage.list();
      if (files.length > 0) await openFile(files[0].id);
    }
  }

  function _updateAvatar(user) {
    const initEl = document.getElementById('userAvatarInitials');
    const imgEl  = document.getElementById('userAvatarImg');
    if (user.photoURL && imgEl) {
      imgEl.src = user.photoURL;
      imgEl.classList.remove('hidden');
      if (initEl) initEl.style.display = 'none';
    } else if (initEl) {
      const name = user.displayName || user.email || '?';
      initEl.textContent = name.charAt(0).toUpperCase();
      initEl.style.display = '';
    }
  }

  // ── Account menu ───────────────────────────────────────
  function _initAccountMenu() {
    const avatarBtn = document.getElementById('userAvatarBtn');
    const menu      = document.getElementById('accountMenu');
    if (!avatarBtn || !menu) return;

    avatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      const user = Storage.getCurrentUser();
      if (!user) return;

      // Populate
      const photo = document.getElementById('accountMenuPhoto');
      if (photo && user.photoURL) { photo.src = user.photoURL; photo.classList.remove('hidden'); }
      const nameEl  = document.getElementById('accountMenuName');
      const emailEl = document.getElementById('accountMenuEmail');
      if (nameEl)  nameEl.textContent  = user.displayName || 'MarkVault User';
      if (emailEl) emailEl.textContent = user.email || '';

      const statsEl = document.getElementById('accountMenuStats');
      if (statsEl) {
        const s = Storage.stats();
        statsEl.textContent = s.label;
      }

      menu.classList.toggle('hidden');
    });

    document.getElementById('accountMenuSignOut')?.addEventListener('click', async () => {
      menu.classList.add('hidden');
      await Storage.signOut();
      toast('Signed out — files still available locally', 'info', 3000);
    });

    document.getElementById('accountMenuDeleteData')?.addEventListener('click', () => {
      menu.classList.add('hidden');
      const user = Storage.getCurrentUser();
      confirm(
        `Delete ALL files for ${user?.email || 'your account'}? This removes them from every device. Cannot be undone.`,
        async () => {
          Storage.removeAll();
          S.activeId = null; S.mode = 'drop';
          setMode('drop'); _showPreviewButtons(false);
          refreshList();
          toast('All data deleted', 'info');
        }
      );
    });

    // Close menu on outside click
    document.addEventListener('click', e => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== avatarBtn) {
        menu.classList.add('hidden');
      }
    });
  }

  // ── Share modal logic ──────────────────────────────────
  let _currentShareLink = null;

  async function _openShareModal() {
    if (!S.activeId) return;
    const file = Storage.load(S.activeId);
    if (!file) return;

    if (el.shareFileName) el.shareFileName.textContent = file.name;
    el.shareQRWrap?.classList.add('hidden');
    el.shareModal?.classList.remove('hidden');

    // Check Firebase
    const db = Storage.getDB();
    if (!db) {
      el.shareRequiresCloud?.classList.remove('hidden');
      el.sharePanel?.classList.add('hidden');
      return;
    }
    el.shareRequiresCloud?.classList.add('hidden');
    el.sharePanel?.classList.remove('hidden');

    // Check for existing link
    try {
      const existing = await Sharing.getLinkForFile(db, S.activeId);
      _currentShareLink = existing;
      _renderShareLinkUI(existing);
    } catch(e) {
      _currentShareLink = null;
      _renderShareLinkUI(null);
    }
  }

  function _renderShareLinkUI(linkData) {
    if (linkData) {
      el.shareLinkWrap?.classList.remove('hidden');
      el.shareNoLink?.classList.add('hidden');
      if (el.shareLinkInput) el.shareLinkInput.value = Sharing.shareURL(linkData.token);
      if (el.shareLinkMeta) el.shareLinkMeta.textContent =
        `${Sharing.fmtExpiry(linkData)} · ${Sharing.fmtViews(linkData)}`;
    } else {
      el.shareLinkWrap?.classList.add('hidden');
      el.shareNoLink?.classList.remove('hidden');
    }
  }

  async function _generateShareLink() {
    const db = Storage.getDB();
    if (!db || !S.activeId) return;
    const file = Storage.load(S.activeId);
    if (!file) return;

    el.shareGenerate.disabled = true;
    el.shareGenerate.textContent = 'Generating…';

    try {
      const expiryDays = parseInt(el.shareExpiry?.value || '0') || 0;
      const maxViews   = parseInt(el.shareMaxViews?.value || '0') || 0;
      const link = await Sharing.createLink(db, S.activeId, file.content, file.name, expiryDays, maxViews);
      _currentShareLink = link;
      _renderShareLinkUI(link);
      toast('Share link created!', 'success');
    } catch(e) {
      toast('Failed to create link: ' + e.message, 'error');
    } finally {
      el.shareGenerate.disabled = false;
      el.shareGenerate.textContent = 'Generate Link';
    }
  }

  function _copyShareLink() {
    if (!_currentShareLink) return;
    const url = Sharing.shareURL(_currentShareLink.token);
    navigator.clipboard.writeText(url).then(() => {
      toast('Link copied to clipboard!');
      if (el.shareCopyLink) {
        el.shareCopyLink.innerHTML = '✓';
        setTimeout(() => {
          if (el.shareCopyLink) el.shareCopyLink.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        }, 1800);
      }
    }).catch(() => toast('Copy failed', 'error'));
  }

  async function _revokeShareLink() {
    const db = Storage.getDB();
    if (!db || !_currentShareLink) return;
    try {
      await Sharing.revokeLink(db, _currentShareLink.token);
      _currentShareLink = null;
      _renderShareLinkUI(null);
      el.shareQRWrap?.classList.add('hidden');
      toast('Link revoked — file is private again', 'info');
    } catch(e) {
      toast('Failed to revoke: ' + e.message, 'error');
    }
  }

  async function _toggleQR() {
    if (!_currentShareLink) return;
    const wrap = el.shareQRWrap;
    if (!wrap) return;
    if (wrap.classList.contains('hidden')) {
      wrap.classList.remove('hidden');
      const url = Sharing.shareURL(_currentShareLink.token);
      await QR.drawToCanvas(el.shareQRCanvas, url, S.isDark);
    } else {
      wrap.classList.add('hidden');
    }
  }

  async function _openManageLinks() {
    const db = Storage.getDB();
    el.shareModal?.classList.add('hidden');
    el.manageLinksModal?.classList.remove('hidden');
    const listEl = el.managedLinksList;
    if (!listEl) return;

    listEl.innerHTML = `<div class="analytics-loading">
      <div class="pdf-spinner" style="width:24px;height:24px;border-width:2px"></div>
      Loading analytics…
    </div>`;

    if (!db) {
      listEl.innerHTML = '<p style="color:var(--txt3);font-size:13px;text-align:center;padding:20px">Connect Firebase to see analytics.</p>';
      return;
    }

    try {
      const { links, totalViews, totalUnique, activeLinks, topLink } =
        await Sharing.getAnalytics(db);

      // ── Summary cards ────────────────────────────────
      const summaryHTML = `
        <div class="analytics-summary">
          <div class="analytics-card">
            <div class="analytics-card-val">${totalViews}</div>
            <div class="analytics-card-label">Total views</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-val">${totalUnique}</div>
            <div class="analytics-card-label">Unique viewers</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-val">${activeLinks}</div>
            <div class="analytics-card-label">Active links</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-val">${links.length}</div>
            <div class="analytics-card-label">Total links</div>
          </div>
        </div>
        ${topLink ? `<div class="analytics-top">
          🏆 Most viewed: <strong>${_esc(topLink.title)}</strong> — ${topLink.views || 0} views
        </div>` : ''}`;

      if (!links.length) {
        listEl.innerHTML = summaryHTML +
          '<p style="color:var(--txt3);font-size:13px;text-align:center;padding:20px">No shared links yet.</p>';
        return;
      }

      // ── Per-link rows ─────────────────────────────────
      const linksHTML = `
        <div class="analytics-links-header">
          <span>DOCUMENT</span><span>VIEWS</span><span>UNIQUE</span>
          <span>STATUS</span><span>ACTIONS</span>
        </div>` +
        links.map(l => {
          const isActive  = l.active && (!l.expiresAt || new Date(l.expiresAt) > new Date());
          const statusCls = !l.active ? 'status-revoked' : l.expiresAt && new Date(l.expiresAt) < new Date() ? 'status-expired' : 'status-active';
          const statusTxt = !l.active ? 'Revoked' : l.expiresAt && new Date(l.expiresAt) < new Date() ? 'Expired' : 'Active';
          const barPct    = l.maxViews > 0 ? Math.min(100, Math.round(((l.views||0)/l.maxViews)*100)) : -1;
          return `
          <div class="analytics-link-row ${!isActive ? 'inactive' : ''}" data-token="${_esc(l.token)}">
            <div class="al-doc">
              <span class="al-title">${_esc(l.title)}</span>
              <span class="al-meta">${Storage.formatDate(l.createdAt)} · ${Sharing.fmtExpiry(l)}</span>
              ${barPct >= 0 ? `<div class="al-bar-wrap" title="${l.views||0}/${l.maxViews} views used">
                <div class="al-bar" style="width:${barPct}%"></div>
              </div>` : ''}
            </div>
            <div class="al-stat">${l.views || 0}</div>
            <div class="al-stat">${l.uniqueViews || 0}</div>
            <div class="al-status"><span class="al-status-badge ${statusCls}">${statusTxt}</span></div>
            <div class="al-actions">
              ${isActive ? `<button class="al-btn ml-copy" data-token="${_esc(l.token)}" title="Copy link">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>` : ''}
              ${isActive ? `<button class="al-btn ml-revoke" data-token="${_esc(l.token)}" title="Revoke link">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>` : ''}
              <button class="al-btn ml-del danger" data-token="${_esc(l.token)}" title="Delete permanently">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </div>`;
        }).join('');

      listEl.innerHTML = summaryHTML + `<div class="analytics-links-table">${linksHTML}</div>`;

      // ── Bind buttons ──────────────────────────────────
      listEl.querySelectorAll('.ml-copy').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = Sharing.shareURL(btn.dataset.token);
          navigator.clipboard.writeText(url).then(() => toast('Link copied!')).catch(() => {});
        });
      });
      listEl.querySelectorAll('.ml-revoke').forEach(btn => {
        btn.addEventListener('click', async () => {
          await Sharing.revokeLink(db, btn.dataset.token).catch(() => {});
          toast('Link revoked', 'info');
          _openManageLinks(); // refresh
        });
      });
      listEl.querySelectorAll('.ml-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          await Sharing.deleteLink(db, btn.dataset.token).catch(() => {});
          toast('Link deleted', 'info');
          _openManageLinks(); // refresh
        });
      });

    } catch(e) {
      listEl.innerHTML = `<p style="color:var(--danger);font-size:13px;padding:16px">Error: ${_esc(e.message)}</p>`;
    }
  }

  // ── Focus mode ────────────────────────────────────────
  function _enterFocus() {
    if (!S.activeId) return;
    const file = Storage.load(S.activeId);
    if (!file) return;
    FocusMode.enter(file.name, el.markdownBody?.innerHTML || '', S.isDark);
  }

  // ══════════════════════════════════════════════════════
  //  AI CHAT
  // ══════════════════════════════════════════════════════
  function _toggleAIChat() {
    if (!S.activeId) { toast('Open a file first', 'info'); return; }
    if (!AIRouter.hasAnyKey()) { _openAISettings(); return; }
    const panel = el.aiChatPanel;
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    if (!isOpen) {
      _renderChatStarters();
      el.aiChatInput?.focus();
    }
  }

  function _renderChatStarters() {
    const starters = [
      'What is this document about?',
      'Summarize the key points',
      'What are the main conclusions?',
      'List all action items',
      'Explain the most complex part simply',
    ];
    if (!el.aiChatStarters) return;
    el.aiChatStarters.innerHTML = starters
      .map(s => `<button class="ai-chat-starter" data-q="${_esc(s)}">${_esc(s)}</button>`)
      .join('');
    el.aiChatStarters.querySelectorAll('.ai-chat-starter').forEach(btn => {
      btn.addEventListener('click', () => _sendChatMsg(btn.dataset.q));
    });
  }

  async function _sendChatMsg(text) {
    const msg = (text || el.aiChatInput?.value || '').trim();
    if (!msg || !S.activeId) return;
    const file = Storage.load(S.activeId);
    if (!file) return;

    if (el.aiChatInput) el.aiChatInput.value = '';
    if (el.aiChatSend)  el.aiChatSend.disabled = true;

    // Remove welcome screen on first message
    el.aiChatMessages?.querySelector('.ai-chat-welcome')?.remove();

    // Add user bubble
    _appendChatBubble('user', msg);

    // Add thinking bubble
    const thinkId = 'think-' + Date.now();
    _appendChatThinking(thinkId);

    try {
      let fullReply = '';
      const thinkEl = document.getElementById(thinkId);

      await AIFeatures.chat(S.activeId, msg, file.content, file.name, (chunk, full) => {
        fullReply = full;
        if (thinkEl) {
          thinkEl.className = 'ai-bubble ai';
          thinkEl.innerHTML = `<div class="ai-bubble-text markdown-body" style="font-size:12.5px">${_renderInlineMarkdown(full)}</div>`;
        }
        // Auto-scroll
        if (el.aiChatMessages) el.aiChatMessages.scrollTop = el.aiChatMessages.scrollHeight;
      });

      // If no streaming (Gemini simulation), render final
      if (thinkEl && !fullReply) {
        thinkEl.remove();
        _appendChatBubble('ai', fullReply || '…');
      }

      _updateChatProviderLabel();
    } catch(e) {
      document.getElementById(thinkId)?.remove();
      _appendChatBubble('ai', `⚠ ${e.message}`);
      if (e.message.includes('No AI API keys')) _openAISettings();
    } finally {
      if (el.aiChatSend) el.aiChatSend.disabled = false;
      el.aiChatInput?.focus();
    }
  }

  function _appendChatBubble(role, text) {
    if (!el.aiChatMessages) return;
    const div = document.createElement('div');
    div.className = `ai-bubble ${role}`;
    if (role === 'ai') {
      div.innerHTML = `<div class="ai-bubble-text markdown-body" style="font-size:12.5px">${_renderInlineMarkdown(text)}</div>`;
    } else {
      div.innerHTML = `<div class="ai-bubble-text">${_esc(text)}</div>`;
    }
    el.aiChatMessages.appendChild(div);
    el.aiChatMessages.scrollTop = el.aiChatMessages.scrollHeight;
  }

  function _appendChatThinking(id) {
    if (!el.aiChatMessages) return;
    const div = document.createElement('div');
    div.id = id;
    div.className = 'ai-bubble ai thinking';
    div.innerHTML = `<div class="ai-bubble-thinking"><div class="ai-thinking-dots"><span></span><span></span><span></span></div></div>`;
    el.aiChatMessages.appendChild(div);
    el.aiChatMessages.scrollTop = el.aiChatMessages.scrollHeight;
  }

  function _renderInlineMarkdown(text) {
    // Lightweight inline markdown for chat bubbles
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\n\n/g,'</p><p>')
      .replace(/\n/g,'<br>')
      .replace(/^(.+)$/s, '<p>$1</p>');
  }

  function _updateChatProviderLabel() {
    if (!el.aiChatProvider) return;
    const statuses = AIRouter.getProviderStatus();
    const active   = statuses.find(p => p.hasKey && !p.cooling);
    el.aiChatProvider.textContent = active ? `via ${active.name}` : '';
  }

  // ══════════════════════════════════════════════════════
  //  AI SUMMARY
  // ══════════════════════════════════════════════════════
  async function _openAISummary() {
    if (!S.activeId) return;
    if (!AIRouter.hasAnyKey()) { _openAISettings(); return; }
    const file = Storage.load(S.activeId);
    if (!file) return;

    el.aiSummaryModal?.classList.remove('hidden');
    el.aiSummaryTags?.classList.add('hidden');
    if (el.aiSummaryBody) {
      el.aiSummaryBody.innerHTML = `<div class="ai-thinking"><div class="ai-thinking-dots"><span></span><span></span><span></span></div>&nbsp;Analyzing document…</div>`;
    }

    try {
      // Run summary + classify in parallel
      const [, meta] = await Promise.all([
        (async () => {
          let md = '';
          await AIFeatures.summarizeDocument(file.content, file.name, (chunk, full) => {
            md = full;
            if (el.aiSummaryBody) el.aiSummaryBody.innerHTML = _renderSummaryMarkdown(full);
          });
          if (el.aiSummaryBody && md) el.aiSummaryBody.innerHTML = _renderSummaryMarkdown(md);
          S._lastSummary = md;
        })(),
        AIFeatures.classifyDocument(file.content, file.name).catch(() => null),
      ]);

      if (meta && el.aiSummaryTags) {
        el.aiSummaryTags.classList.remove('hidden');
        const tagHTML = [
          meta.category ? `<span class="ai-tag category">${_esc(meta.category)}</span>` : '',
          meta.complexity ? `<span class="ai-tag">${_esc(meta.complexity)}</span>` : '',
          ...(meta.tags || []).slice(0, 5).map(t => `<span class="ai-tag">${_esc(t)}</span>`),
        ].join('');
        el.aiSummaryTags.innerHTML = tagHTML;
        // Also persist tags on the file metadata
        _updateDocTagsBar(meta);
      }
    } catch(e) {
      if (el.aiSummaryBody) el.aiSummaryBody.innerHTML = `<p style="color:var(--danger)">⚠ ${_esc(e.message)}</p>`;
    }
  }

  function _renderSummaryMarkdown(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/^## (.+)$/gm,'<h2>$1</h2>')
      .replace(/^### (.+)$/gm,'<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/^- (.+)$/gm,'<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g,'</p><p>')
      .replace(/^(?!<[hul])/gm, '<p>').replace(/<p><\/p>/g,'');
  }

  function _updateDocTagsBar(meta) {
    const bar = document.getElementById('docTagsBar');
    if (!bar || !meta) return;
    if (!meta.tags?.length && !meta.category) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = [
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--txt3);flex-shrink:0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      meta.category ? `<span class="ai-tag category">${_esc(meta.category)}</span>` : '',
      ...(meta.tags || []).slice(0,4).map(t=>`<span class="ai-tag">${_esc(t)}</span>`),
    ].join('');
  }

  // ══════════════════════════════════════════════════════
  //  WRITING TOOLS
  // ══════════════════════════════════════════════════════
  let _wtSelectedText = '';
  let _wtSelStart = 0, _wtSelEnd = 0;
  let _wtActiveResult = '';

  function _initWritingTools() {
    if (!el.wtTools) return;
    const tools = AIFeatures.getWritingTools();
    el.wtTools.innerHTML = tools.map(t =>
      `<button class="wt-tool-btn" data-id="${t.id}">${t.label}</button>`
    ).join('');

    el.wtTools.querySelectorAll('.wt-tool-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const toolId = btn.dataset.id;
        if (toolId === 'translate') {
          el.wtTranslate?.classList.toggle('hidden');
          btn.classList.toggle('active');
          return;
        }
        await _runWritingTool(toolId, btn);
      });
    });

    el.wtTranslateGo?.addEventListener('click', async () => {
      await _runWritingTool('translate', null, el.wtLangInput?.value);
    });
    el.wtAccept?.addEventListener('click', _acceptWritingResult);
    el.wtDiscard?.addEventListener('click', () => {
      el.wtResult?.classList.add('hidden');
      if (el.wtResultText) el.wtResultText.textContent = '';
    });
    el.wtClose?.addEventListener('click', () => {
      el.writingToolsBar?.classList.add('hidden');
    });
  }

  async function _runWritingTool(toolId, btn, targetLang) {
    if (!_wtSelectedText.trim()) { toast('Select text in the editor first', 'info'); return; }
    if (!AIRouter.hasAnyKey()) { _openAISettings(); return; }

    if (btn) el.wtTools?.querySelectorAll('.wt-tool-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    el.wtResult?.classList.remove('hidden');
    el.wtTranslate?.classList.add('hidden');
    if (el.wtResultText) el.wtResultText.textContent = '…';
    if (el.wtResultLabel) el.wtResultLabel.textContent = 'Thinking…';
    if (el.wtAccept) el.wtAccept.disabled = true;

    try {
      let result = '';
      await AIFeatures.applyTool(toolId, _wtSelectedText, targetLang, (chunk, full) => {
        result = full;
        if (el.wtResultText) el.wtResultText.textContent = full;
      });
      _wtActiveResult = result || el.wtResultText?.textContent || '';
      if (el.wtResultLabel) el.wtResultLabel.textContent = 'Result — review before applying';
      if (el.wtAccept) el.wtAccept.disabled = false;
    } catch(e) {
      if (el.wtResultText) el.wtResultText.textContent = `Error: ${e.message}`;
      if (el.wtResultLabel) el.wtResultLabel.textContent = 'Error';
    } finally {
      if (btn) btn.classList.remove('active');
    }
  }

  function _acceptWritingResult() {
    if (!_wtActiveResult || !el.editorArea) return;
    const ta   = el.editorArea;
    const val  = ta.value;
    ta.value   = val.slice(0, _wtSelStart) + _wtActiveResult + val.slice(_wtSelEnd);
    ta.focus();
    ta.setSelectionRange(_wtSelStart, _wtSelStart + _wtActiveResult.length);
    el.writingToolsBar?.classList.add('hidden');
    el.wtResult?.classList.add('hidden');
    toast('Applied!');
  }

  function _showWritingTools() {
    if (!el.editorArea) return;
    const ta    = el.editorArea;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) { toast('Select some text first', 'info'); return; }
    _wtSelectedText = ta.value.slice(start, end);
    _wtSelStart = start; _wtSelEnd = end;
    el.writingToolsBar?.classList.remove('hidden');
    el.wtResult?.classList.add('hidden');
    el.wtTranslate?.classList.add('hidden');
    el.wtTools?.querySelectorAll('.wt-tool-btn').forEach(b => b.classList.remove('active'));
  }

  // ══════════════════════════════════════════════════════
  //  AI SETTINGS
  // ══════════════════════════════════════════════════════
  const PROVIDER_LINKS = {
    groq:       { label: 'Free 6k req/day', url: 'https://console.groq.com/keys' },
    cerebras:   { label: 'Free ultra-fast', url: 'https://cloud.cerebras.ai' },
    together:   { label: 'Free $5 credit',  url: 'https://api.together.ai/settings/api-keys' },
    openrouter: { label: 'Many free models',url: 'https://openrouter.ai/keys' },
    gemini:     { label: 'Free 1M tok/day', url: 'https://aistudio.google.com/app/apikey' },
  };

  function _openAISettings() {
    const statuses = AIRouter.getProviderStatus();
    if (!el.aiProvidersList) return;

    el.aiProvidersList.innerHTML = statuses.map(p => {
      const link = PROVIDER_LINKS[p.id];
      const statusCls  = p.hasKey ? (p.cooling ? 'cooling' : 'ok') : 'missing';
      const statusTxt  = p.hasKey ? (p.cooling ? 'Rate limited' : 'Active') : 'No key';
      return `
        <div class="ai-provider-row">
          <div class="ai-provider-info">
            <span class="ai-provider-name">${_esc(p.name)}</span>
            <span class="ai-provider-hint">
              <a href="${link.url}" target="_blank" rel="noopener">${link.label} →</a>
            </span>
          </div>
          <div class="ai-key-wrap">
            <input class="ai-key-inp" data-provider="${p.id}" type="password"
              placeholder="API key…" value="${_esc(AIRouter.getKey(p.id))}"
              autocomplete="off" spellcheck="false" />
            <button class="ai-key-eye" data-target="${p.id}" title="Show/hide">👁</button>
          </div>
          <span class="ai-provider-status ${statusCls}">${statusTxt}</span>
        </div>`;
    }).join('');

    // Toggle show/hide
    el.aiProvidersList.querySelectorAll('.ai-key-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = el.aiProvidersList.querySelector(`.ai-key-inp[data-provider="${btn.dataset.target}"]`);
        if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });

    el.aiSettingsModal?.classList.remove('hidden');
  }

  function _saveAISettings() {
    el.aiProvidersList?.querySelectorAll('.ai-key-inp').forEach(inp => {
      AIRouter.setKey(inp.dataset.provider, inp.value.trim());
    });
    el.aiSettingsModal?.classList.add('hidden');
    toast('AI keys saved');
  }

  // ══════════════════════════════════════════════════════
  //  COMMAND PALETTE
  // ══════════════════════════════════════════════════════
  function _openCommandPalette() {
    const files    = Storage.list();
    const tocItems = S.tocItems || [];
    CommandPalette.show(files, tocItems, _handlePaletteSelect);
  }

  function _handlePaletteSelect(item) {
    if (item.type === 'file') {
      openFile(item.id);
    } else if (item.type === 'heading') {
      const target = document.getElementById(item.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Actions
      const actions = {
        new:       () => newFile(),
        import:    () => el.fileInput?.click(),
        focus:     () => _enterFocus(),
        theme:     () => applyTheme(!S.isDark),
        share:     () => { if (S.activeId) _openShareModal(); else toast('Open a file first','info'); },
        export:    () => {
          if (!S.activeId) return;
          const f = Storage.load(S.activeId);
          if (f) { Renderer.exportHTML(f.name, el.markdownBody?.innerHTML||'', S.isDark); }
        },
        summary:   () => _openAISummary(),
        chat:      () => _toggleAIChat(),
        aikeys:    () => _openAISettings(),
        cloud:     () => openCloudModal(),
        deleteall: () => deleteAll(),
      };
      actions[item.id]?.();
    }
  }

  // ══════════════════════════════════════════════════════
  //  STARRED FILES
  // ══════════════════════════════════════════════════════
  function _getStarred() {
    try { return JSON.parse(localStorage.getItem('mv_starred') || '[]'); } catch { return []; }
  }
  function _toggleStar(id) {
    const s = _getStarred();
    const i = s.indexOf(id);
    if (i >= 0) s.splice(i, 1); else s.unshift(id);
    localStorage.setItem('mv_starred', JSON.stringify(s));
    refreshList();
  }
  function _isStarred(id) { return _getStarred().includes(id); }

  // Override refreshList to support starred section
  const _origRefreshList = refreshList;
  // Patch file item rendering to add star button
  function _patchFileItem(li, id) {
    const starred = _isStarred(id);
    const starBtn = document.createElement('button');
    starBtn.className = `file-item-star${starred ? ' starred' : ''}`;
    starBtn.textContent = starred ? '★' : '☆';
    starBtn.title = starred ? 'Unstar' : 'Star';
    starBtn.addEventListener('click', e => { e.stopPropagation(); _toggleStar(id); });
    li.insertBefore(starBtn, li.querySelector('.file-item-actions'));
  }

  // ══════════════════════════════════════════════════════
  //  AUTO-SAVE
  // ══════════════════════════════════════════════════════
  let _autoSaveTimer    = null;
  let _editorDirty      = false;
  let _autoSaveStatus   = null; // DOM element

  function _markDirty() {
    _editorDirty = true;
    el.unsavedBadge?.classList.remove('hidden');
    document.getElementById('splitUnsavedDot')?.classList.remove('hidden');
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(_autoSave, 2000); // 2s debounce
  }

  function _autoSave() {
    if (!_editorDirty) return;
    const activeArea = S.splitMode
      ? document.getElementById('splitEditorArea')
      : el.editorArea;
    if (!activeArea) return;
    const content = activeArea.value;
    const name    = el.editorFilename?.value?.trim() || 'untitled.md';
    const result  = Storage.save(name, content, S.activeId || undefined);
    S.activeId    = result.id;
    _editorDirty  = false;
    el.unsavedBadge?.classList.add('hidden');
    document.getElementById('splitUnsavedDot')?.classList.add('hidden');
    refreshList();
  }

  // ══════════════════════════════════════════════════════
  //  SPLIT PANE
  // ══════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════
  //  SPLIT PANE — full rewrite
  // ══════════════════════════════════════════════════════
  let _splitRenderTimer  = null;
  let _splitDividerBound = false;

  function _enterSplitMode() {
    if (!S.activeId) { toast('Open a file first', 'info'); return; }
    const file = Storage.load(S.activeId);
    if (!file) return;

    // Close sidebar on mobile so it never overlays split view
    closeSidebar();

    S.splitMode = true;
    S.mode      = 'split';

    // Hide all other content panels
    el.dropZone.classList.add('hidden');
    el.editorWrap?.classList.add('hidden');
    el.previewWrap?.classList.add('hidden');
    if (el.pdfWrap) el.pdfWrap.classList.add('hidden');
    el.tocPanel.classList.add('hidden');
    S.tocOpen = false;

    const splitWrap = document.getElementById('splitWrap');
    splitWrap?.classList.remove('hidden');

    // Clear any previous inline flex overrides so CSS media queries work fresh
    const edPane = splitWrap?.querySelector('.split-editor-pane');
    const pvPane = splitWrap?.querySelector('.split-preview-pane');
    if (edPane)  { edPane.style.flex  = ''; edPane.style.height  = ''; }
    if (pvPane)  { pvPane.style.flex  = ''; pvPane.style.height  = ''; }

    // Populate editor
    const splitEditor = document.getElementById('splitEditorArea');
    if (splitEditor) splitEditor.value = file.content;

    el.topbarTitle.textContent = file.name;

    // Show split button as active; hide other preview-only buttons
    _showPreviewButtons(false);
    const splitBtn = document.getElementById('splitBtn');
    if (splitBtn) { splitBtn.classList.remove('hidden'); splitBtn.classList.add('split-active'); }

    // Initial preview render
    _splitRender(file.content);

    // Remove stale listeners before adding fresh ones
    splitEditor?.removeEventListener('input', _onSplitInput);
    splitEditor?.removeEventListener('input', _markDirty);
    splitEditor?.addEventListener('input', _onSplitInput);
    splitEditor?.addEventListener('input', _markDirty);

    _initSplitDivider();
  }

  function _exitSplitMode() {
    S.splitMode = false;
    if (_splitRenderTimer) { clearTimeout(_splitRenderTimer); _splitRenderTimer = null; }

    // Save before leaving
    _autoSave();

    document.getElementById('splitWrap')?.classList.add('hidden');
    const splitBtn = document.getElementById('splitBtn');
    if (splitBtn) splitBtn.classList.remove('split-active');

    const splitEditor = document.getElementById('splitEditorArea');
    splitEditor?.removeEventListener('input', _onSplitInput);
    splitEditor?.removeEventListener('input', _markDirty);

    S.mode = 'preview';
    if (S.activeId) openFile(S.activeId);
  }

  function _onSplitInput() {
    if (_splitRenderTimer) clearTimeout(_splitRenderTimer);
    _splitRenderTimer = setTimeout(() => {
      const val = document.getElementById('splitEditorArea')?.value || '';
      _splitRender(val);
    }, 280);
  }

  async function _splitRender(content) {
    const body = document.getElementById('splitPreviewBody');
    if (!body) return;
    try { await Renderer.render(content, body, S.isDark); } catch {}
  }

  function _initSplitDivider() {
    if (_splitDividerBound) return;
    _splitDividerBound = true;

    const divider = document.getElementById('splitDivider');
    const wrap    = document.getElementById('splitWrap');
    if (!divider || !wrap) return;

    const isMobileLayout = () => window.innerWidth <= 640;

    function applyRatio(primaryPx) {
      if (isMobileLayout()) return;
      const total = wrap.offsetWidth - 4;
      const pct   = Math.max(25, Math.min(75, (primaryPx / total) * 100));
      wrap.querySelector('.split-editor-pane').style.flex  = `0 0 ${pct}%`;
      wrap.querySelector('.split-preview-pane').style.flex = `0 0 ${100 - pct}%`;
    }

    // Mouse drag
    divider.addEventListener('mousedown', e => {
      if (isMobileLayout()) return;
      e.preventDefault();
      const startX     = e.clientX;
      const startLeftW = wrap.querySelector('.split-editor-pane').offsetWidth;
      divider.classList.add('dragging');
      document.body.style.userSelect = 'none';
      const onMove = e2 => applyRatio(startLeftW + (e2.clientX - startX));
      const onUp   = ()  => {
        divider.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Touch drag
    divider.addEventListener('touchstart', e => {
      if (isMobileLayout()) return;
      const t0     = e.touches[0];
      const startX = t0.clientX;
      const startW = wrap.querySelector('.split-editor-pane').offsetWidth;
      divider.classList.add('dragging');
      const onMove = e2 => applyRatio(startW + (e2.touches[0].clientX - startX));
      const onEnd  = ()  => {
        divider.classList.remove('dragging');
        divider.removeEventListener('touchmove', onMove);
        divider.removeEventListener('touchend',  onEnd);
      };
      divider.addEventListener('touchmove', onMove, { passive: true });
      divider.addEventListener('touchend',  onEnd);
    }, { passive: true });

    // On window resize: clear inline overrides so CSS takes over
    window.addEventListener('resize', () => {
      if (!S.splitMode) return;
      if (isMobileLayout()) {
        const ep = wrap.querySelector('.split-editor-pane');
        const pp = wrap.querySelector('.split-preview-pane');
        if (ep) { ep.style.flex = ''; ep.style.height = ''; }
        if (pp) { pp.style.flex = ''; pp.style.height = ''; }
      }
    });
  }


  // ══════════════════════════════════════════════════════
  //  IN-DOCUMENT SEARCH (Find bar)
  // ══════════════════════════════════════════════════════
  let _findMatches   = [];
  let _findCurrent   = -1;
  let _findContainer = null;
  let _findOriginals = new Map(); // node → original text

  function _openFindBar() {
    if (S.mode !== 'preview') return;
    const bar = document.getElementById('findBar');
    bar?.classList.remove('hidden');
    const inp = document.getElementById('findInput');
    inp?.focus(); inp && inp.select();
    _findContainer = el.markdownBody;
  }

  function _closeFindBar() {
    document.getElementById('findBar')?.classList.add('hidden');
    _clearFindHighlights();
    _findMatches = []; _findCurrent = -1;
    const count = document.getElementById('findCount');
    if (count) count.textContent = '';
  }

  function _doFind(forward = true) {
    const query = document.getElementById('findInput')?.value || '';
    const caseSensitive = document.getElementById('findCase')?.checked || false;
    if (!query.trim() || !_findContainer) { _clearFindHighlights(); return; }

    _clearFindHighlights();
    _findMatches = [];

    const flags = caseSensitive ? 'g' : 'gi';
    const re    = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    // Walk text nodes and wrap matches
    const walker = document.createTreeWalker(_findContainer, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','CODE','PRE'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return re.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    for (const node of textNodes) {
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      const text = node.textContent;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'find-highlight';
        mark.textContent = m[0];
        frag.appendChild(mark);
        _findMatches.push(mark);
        last = re.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }

    const count = document.getElementById('findCount');
    if (!_findMatches.length) {
      if (count) count.textContent = 'No results';
      return;
    }

    // Navigate
    _findCurrent = forward
      ? (_findCurrent + 1) % _findMatches.length
      : (_findCurrent - 1 + _findMatches.length) % _findMatches.length;

    _findMatches.forEach((m, i) => m.classList.toggle('current', i === _findCurrent));
    _findMatches[_findCurrent]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (count) count.textContent = `${_findCurrent + 1} / ${_findMatches.length}`;
  }

  function _clearFindHighlights() {
    // Unwrap all mark elements
    document.querySelectorAll('.find-highlight').forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  // ══════════════════════════════════════════════════════
  //  TEMPLATES
  // ══════════════════════════════════════════════════════
  function _openTemplates() {
    const modal   = document.getElementById('templatesModal');
    const catEl   = document.getElementById('templateCategories');
    const gridEl  = document.getElementById('templateGrid');
    if (!modal) return;

    const cats = Templates.getCategories();
    let activeCat = 'All';

    const renderGrid = (cat) => {
      const items = cat === 'All' ? Templates.getAll() : Templates.getByCategory(cat);
      gridEl.innerHTML = items.map(t => `
        <div class="template-card" data-id="${t.id}">
          <div class="template-card-icon">${t.icon}</div>
          <div class="template-card-name">${_esc(t.name)}</div>
          <div class="template-card-desc">${_esc(t.description)}</div>
        </div>`).join('');
      gridEl.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
          const tpl = Templates.getById(card.dataset.id);
          if (!tpl) return;
          modal.classList.add('hidden');
          _createFromTemplate(tpl);
        });
      });
    };

    catEl.innerHTML = ['All', ...cats].map(c =>
      `<button class="template-cat-btn ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
    catEl.querySelectorAll('.template-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        catEl.querySelectorAll('.template-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid(btn.dataset.cat);
      });
    });

    renderGrid('All');
    modal.classList.remove('hidden');
  }

  function _createFromTemplate(tpl) {
    const name = tpl.id === 'blank' ? 'untitled.md' : `${tpl.name.toLowerCase().replace(/\s+/g,'-')}.md`;
    S.activeId = null; S.mode = 'editor';
    setMode('editor');
    el.editorFilename.value = name;
    el.editorArea.value     = tpl.content.replace('{title}', '');
    el.topbarTitle.textContent = `New: ${name}`;
    _showPreviewButtons(false);
    _updateBottomNav();
    _updateWordCount();
    el.editorArea.focus();
    // Place cursor at first empty placeholder position
    const pos = el.editorArea.value.indexOf('\n\n') + 2;
    el.editorArea.setSelectionRange(pos, pos);
    closeSidebar();
  }

  // ══════════════════════════════════════════════════════
  //  IMPORT FROM URL
  // ══════════════════════════════════════════════════════
  async function _importFromUrl() {
    const rawUrl = document.getElementById('importUrlInput')?.value?.trim() || '';
    const errEl  = document.getElementById('importUrlError');
    if (!rawUrl) { if (errEl) { errEl.textContent='⚠ Paste a URL first'; errEl.classList.remove('hidden'); } return; }
    if (errEl) errEl.classList.add('hidden');

    const goBtn = document.getElementById('importUrlGo');
    if (goBtn) { goBtn.disabled = true; goBtn.textContent = 'Fetching…'; }

    try {
      const fetchUrl = _resolveMarkdownUrl(rawUrl);
      const resp     = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const content  = await resp.text();
      if (!content.trim()) throw new Error('URL returned empty content');

      // Derive filename from URL
      const urlPath  = new URL(fetchUrl).pathname;
      const rawName  = urlPath.split('/').pop() || 'imported.md';
      const name     = rawName.endsWith('.md') || rawName.endsWith('.txt') ? rawName : rawName + '.md';

      const result   = Storage.save(name, content);
      refreshList();
      document.getElementById('importUrlModal')?.classList.add('hidden');
      if (document.getElementById('importUrlInput')) document.getElementById('importUrlInput').value = '';
      toast(`Imported: ${name}`);
      openFile(result.id);
    } catch(e) {
      if (errEl) { errEl.textContent = '⚠ ' + e.message; errEl.classList.remove('hidden'); }
    } finally {
      if (goBtn) { goBtn.disabled = false; goBtn.textContent = 'Import'; }
    }
  }

  function _resolveMarkdownUrl(url) {
    try {
      const u = new URL(url);
      // github.com/user/repo/blob/main/file.md → raw.githubusercontent.com
      if (u.hostname === 'github.com') {
        return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
      // gist.github.com/user/id → api.github.com/gists/id (get raw)
      if (u.hostname === 'gist.github.com') {
        const id = u.pathname.split('/').filter(Boolean).pop();
        return `https://api.github.com/gists/${id}`;
      }
      // hackmd.io/slug → hackmd.io/slug/download
      if (u.hostname === 'hackmd.io' && !url.includes('/download')) {
        return url.replace(/\?.*$/, '') + '/download';
      }
      // pastebin.com/id → pastebin.com/raw/id
      if (u.hostname === 'pastebin.com' && !url.includes('/raw/')) {
        return url.replace('pastebin.com/', 'pastebin.com/raw/');
      }
    } catch {}
    return url; // return as-is for direct URLs
  }

  // ══════════════════════════════════════════════════════
  //  PWA
  // ══════════════════════════════════════════════════════
  let _pwaPrompt = null;

  function _initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Failed:', err));
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _pwaPrompt = e;
      // Show banner if not dismissed before
      if (!localStorage.getItem('mv_pwa_dismissed')) {
        setTimeout(() => document.getElementById('pwaBanner')?.classList.remove('hidden'), 3000);
      }
    });

    window.addEventListener('appinstalled', () => {
      document.getElementById('pwaBanner')?.classList.add('hidden');
      toast('MarkVault installed! ◈', 'success', 4000);
    });

    document.getElementById('pwaInstall')?.addEventListener('click', async () => {
      if (!_pwaPrompt) return;
      _pwaPrompt.prompt();
      const { outcome } = await _pwaPrompt.userChoice;
      _pwaPrompt = null;
      document.getElementById('pwaBanner')?.classList.add('hidden');
    });

    document.getElementById('pwaDismiss')?.addEventListener('click', () => {
      localStorage.setItem('mv_pwa_dismissed', '1');
      document.getElementById('pwaBanner')?.classList.add('hidden');
    });

    // Handle ?action= shortcuts from PWA shortcut menu
    const action = new URLSearchParams(window.location.search).get('action');
    if (action === 'new')    newFile();
    if (action === 'import') el.fileInput?.click();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);