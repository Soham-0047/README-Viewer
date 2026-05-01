/**
 * MarkVault — AI Engine
 *
 * Provider priority (fastest / most generous free tier first):
 *   1. Groq        — llama-3.3-70b-versatile  (fast, 6k req/day free)
 *   2. Cerebras    — llama-3.3-70b             (ultra-fast, free)
 *   3. Together    — Llama-3.3-70B-Turbo-Free  (free tier)
 *   4. OpenRouter  — qwen3-30b:free / many more (always has free models)
 *   5. Gemini      — gemini-1.5-flash           (1M tok/day free)
 *
 * All requests go through AIRouter.complete() which:
 *   - Tries each configured provider in order
 *   - On 429 / rate-limit → marks provider cooling, tries next
 *   - On 402 / quota      → marks provider exhausted, tries next
 *   - Streams token-by-token via callback when supported
 *   - Falls back to non-streaming if provider doesn't support it
 */

const AIRouter = (() => {

  // ── Provider definitions ─────────────────────────────
  const PROVIDERS = {
    groq: {
      name: 'Groq',
      base: 'https://api.groq.com/openai/v1',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
      maxTokens: 8000,
      streaming: true,
    },
    cerebras: {
      name: 'Cerebras',
      base: 'https://api.cerebras.ai/v1',
      models: ['llama-3.3-70b', 'llama3.1-70b', 'llama3.1-8b'],
      maxTokens: 8000,
      streaming: true,
    },
    together: {
      name: 'Together',
      base: 'https://api.together.xyz/v1',
      models: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'Qwen/Qwen2.5-7B-Instruct-Turbo',
      ],
      maxTokens: 4000,
      streaming: true,
    },
    openrouter: {
      name: 'OpenRouter',
      base: 'https://openrouter.ai/api/v1',
      models: [
        'qwen/qwen3-30b-a3b:free',
        'qwen/qwen3-8b:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
      ],
      maxTokens: 4000,
      streaming: true,
      extraHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'MarkVault',
      },
    },
    gemini: {
      name: 'Gemini',
      base: null, // uses its own endpoint
      models: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash'],
      maxTokens: 8192,
      streaming: false, // handled separately
    },
  };

  // ── State ────────────────────────────────────────────
  const PREF_KEY    = 'mv_ai_keys';
  const COOL_KEY    = 'mv_ai_cool';
  const COOLDOWN_MS = 60000; // 1 min cooldown after rate-limit

  let _keys    = {};  // { groq: 'sk-...', gemini: '...', ... }
  let _cooling = {};  // { groq: timestamp, ... }

  function loadKeys() {
    try { _keys = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { _keys = {}; }
    try { _cooling = JSON.parse(localStorage.getItem(COOL_KEY) || '{}'); } catch { _cooling = {}; }
  }
  function saveKeys()    { localStorage.setItem(PREF_KEY, JSON.stringify(_keys)); }
  function saveCooling() { localStorage.setItem(COOL_KEY, JSON.stringify(_cooling)); }

  function setKey(provider, key) {
    loadKeys();
    _keys[provider] = key ? key.trim() : '';
    delete _cooling[provider]; // reset cooling when key changes
    saveKeys(); saveCooling();
  }
  function getKey(provider) { loadKeys(); return _keys[provider] || ''; }
  function getAllKeys()      { loadKeys(); return { ..._keys }; }

  function _isCooling(provider) {
    const ts = _cooling[provider];
    if (!ts) return false;
    if (Date.now() - ts < COOLDOWN_MS) return true;
    delete _cooling[provider]; saveCooling(); return false;
  }
  function _setCooling(provider) {
    _cooling[provider] = Date.now(); saveCooling();
  }

  function _isRateError(status, text) {
    return status === 429 || status === 503 ||
      /rate.limit|too.many|overload|capacity|quota/i.test(text);
  }
  function _isExhausted(status, text) {
    return status === 402 || status === 401 ||
      /credit|billing|payment|exhausted|invalid.api.key|unauthorized/i.test(text);
  }

  // ── OpenAI-compatible chat complete ──────────────────
  async function _oaiComplete(provider, messages, opts, onChunk) {
    const cfg   = PROVIDERS[provider];
    const key   = getKey(provider);
    if (!key) throw new Error(`No ${cfg.name} API key`);

    for (const model of cfg.models) {
      const streaming = cfg.streaming && !!onChunk;
      const body = {
        model, messages,
        max_tokens:  opts.maxTokens || cfg.maxTokens,
        temperature: opts.temperature ?? 0.7,
        stream: streaming,
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        ...(cfg.extraHeaders || {}),
      };

      let resp;
      try {
        resp = await fetch(`${cfg.base}/chat/completions`, {
          method: 'POST', headers, body: JSON.stringify(body),
        });
      } catch(e) {
        throw new Error(`${cfg.name} network error: ${e.message}`);
      }

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        if (_isCooling(resp.status, txt) || _isRateError(resp.status, txt)) {
          _setCooling(provider);
          throw Object.assign(new Error(`${cfg.name} rate limited`), { rateLimit: true });
        }
        if (_isExhausted(resp.status, txt)) {
          throw Object.assign(new Error(`${cfg.name} key exhausted/invalid`), { exhausted: true });
        }
        // Model not found → try next model
        if (resp.status === 404 || resp.status === 400) continue;
        throw new Error(`${cfg.name} error ${resp.status}: ${txt.slice(0, 120)}`);
      }

      // Stream
      if (streaming) {
        return await _readStream(resp, onChunk);
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '';
    }

    throw new Error(`${cfg.name}: all models failed`);
  }

  async function _readStream(resp, onChunk) {
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          const chunk = j.choices?.[0]?.delta?.content || '';
          if (chunk) { full += chunk; onChunk(chunk, full); }
        } catch {}
      }
    }
    return full;
  }

  // ── Gemini (separate endpoint) ────────────────────────
  async function _geminiComplete(messages, opts, onChunk) {
    const key = getKey('gemini');
    if (!key) throw new Error('No Gemini API key');

    const cfg    = PROVIDERS.gemini;
    let lastErr  = null;

    for (const model of cfg.models) {
      // Convert OpenAI messages → Gemini contents
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs  = messages.filter(m => m.role !== 'system');
      const contents  = userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body = {
        contents,
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        generationConfig: {
          maxOutputTokens: opts.maxTokens || cfg.maxTokens,
          temperature: opts.temperature ?? 0.7,
        },
      };

      try {
        const url  = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          if (_isRateError(resp.status, txt))  { _setCooling('gemini'); break; }
          if (_isExhausted(resp.status, txt))  throw Object.assign(new Error('Gemini key exhausted'), { exhausted: true });
          if (resp.status === 404) continue;
          lastErr = new Error(`Gemini ${resp.status}: ${txt.slice(0, 100)}`);
          continue;
        }

        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (onChunk) {
          // Simulate streaming for consistency
          const words = text.split(' ');
          let full = '';
          for (const w of words) {
            full += (full ? ' ' : '') + w;
            onChunk((full.length > w.length ? ' ' : '') + w, full);
            await new Promise(r => setTimeout(r, 8));
          }
        }
        return text;
      } catch(e) {
        if (e.exhausted || e.rateLimit) throw e;
        lastErr = e;
      }
    }

    throw lastErr || new Error('Gemini: all models failed');
  }

  // ── Main router ───────────────────────────────────────
  /**
   * complete(messages, opts, onChunk)
   *   messages: [{ role: 'system'|'user'|'assistant', content: string }]
   *   opts:     { maxTokens, temperature, preferProvider }
   *   onChunk:  (chunk, fullSoFar) => void  — for streaming UI
   *   returns:  Promise<string>
   */
  async function complete(messages, opts = {}, onChunk = null) {
    loadKeys();
    const order = ['groq', 'cerebras', 'together', 'openrouter', 'gemini'];
    const errors = [];

    // Prefer a specific provider if requested (e.g. for vision tasks)
    if (opts.preferProvider && order.includes(opts.preferProvider)) {
      order.splice(order.indexOf(opts.preferProvider), 1);
      order.unshift(opts.preferProvider);
    }

    for (const provider of order) {
      const key = getKey(provider);
      if (!key) continue;
      if (_isCooling(provider)) continue;

      try {
        if (provider === 'gemini') {
          return await _geminiComplete(messages, opts, onChunk);
        } else {
          return await _oaiComplete(provider, messages, opts, onChunk);
        }
      } catch(e) {
        errors.push(`${PROVIDERS[provider].name}: ${e.message}`);
        if (e.exhausted) continue;  // key bad → next
        if (e.rateLimit) continue;  // cooling  → next
        // Other errors (network, server) → still try next
        continue;
      }
    }

    throw new Error(
      errors.length
        ? `All AI providers failed:\n${errors.join('\n')}`
        : 'No AI API keys configured. Open Settings (⚙) to add a free key.'
    );
  }

  // ── Utility: hasAnyKey ───────────────────────────────
  function hasAnyKey() {
    loadKeys();
    return Object.values(_keys).some(k => k && k.trim().length > 5);
  }

  function getProviderStatus() {
    loadKeys();
    return Object.entries(PROVIDERS).map(([id, cfg]) => ({
      id, name: cfg.name,
      hasKey:   !!(_keys[id]?.trim()),
      cooling:  _isCooling(id),
    }));
  }

  return { complete, setKey, getKey, getAllKeys, hasAnyKey, getProviderStatus, PROVIDERS };
})();

// ═══════════════════════════════════════════════════════
//  AI FEATURES
// ═══════════════════════════════════════════════════════

const AIFeatures = (() => {

  // ── 1. DOCUMENT CHAT ──────────────────────────────────
  // Conversational Q&A grounded in the current document.
  // History is kept per-file session so context accumulates.

  const _chatHistory = {};  // fileId → [{ role, content }]

  function clearChat(fileId) { _chatHistory[fileId] = []; }

  async function chat(fileId, userMsg, docContent, docTitle, onChunk) {
    if (!_chatHistory[fileId]) _chatHistory[fileId] = [];

    const history = _chatHistory[fileId];
    const SYSTEM = `You are a helpful document assistant. The user is reading a Markdown document titled "${docTitle}".

DOCUMENT CONTENT:
---
${docContent.slice(0, 18000)}
---

Answer questions about this document concisely and accurately. If the answer isn't in the document, say so clearly. Format your responses in Markdown when helpful (use bold, lists, code blocks). Keep answers focused and under 300 words unless the user explicitly asks for more detail.`;

    const messages = [
      { role: 'system', content: SYSTEM },
      ...history.slice(-8), // last 4 turns for context
      { role: 'user', content: userMsg },
    ];

    const reply = await AIRouter.complete(messages, { maxTokens: 1024, temperature: 0.5 }, onChunk);

    // Store in history
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: reply });

    return reply;
  }

  // ── 2. WRITING TOOLS ─────────────────────────────────
  // Transform selected text in the editor.
  // Each tool has a specific system prompt engineered for clean output.

  const WRITING_TOOLS = [
    {
      id: 'improve',
      label: '✨ Improve writing',
      icon: '✨',
      prompt: 'Improve the writing quality of the following Markdown text. Fix awkward phrasing, improve flow, and enhance clarity. Keep the same meaning, tone, and Markdown formatting. Return ONLY the improved text, no explanations.',
    },
    {
      id: 'simplify',
      label: '📖 Simplify',
      icon: '📖',
      prompt: 'Simplify the following Markdown text. Use simpler words, shorter sentences, and clearer structure. Target a 7th-grade reading level. Preserve Markdown formatting. Return ONLY the simplified text.',
    },
    {
      id: 'expand',
      label: '📝 Expand',
      icon: '📝',
      prompt: 'Expand the following Markdown text with more detail, examples, and explanation. Add 2-3x more content while keeping the same structure and Markdown formatting. Return ONLY the expanded text.',
    },
    {
      id: 'shorten',
      label: '✂️ Shorten',
      icon: '✂️',
      prompt: 'Shorten the following Markdown text to its essential points. Remove redundancy and verbosity while keeping all key information. Return ONLY the shortened text.',
    },
    {
      id: 'fixgrammar',
      label: '🔤 Fix grammar',
      icon: '🔤',
      prompt: 'Fix all grammar, spelling, and punctuation errors in the following Markdown text. Do not change wording unnecessarily. Preserve Markdown formatting. Return ONLY the corrected text.',
    },
    {
      id: 'formal',
      label: '👔 Make formal',
      icon: '👔',
      prompt: 'Rewrite the following Markdown text in a formal, professional tone suitable for business or academic use. Preserve Markdown formatting. Return ONLY the rewritten text.',
    },
    {
      id: 'casual',
      label: '😊 Make casual',
      icon: '😊',
      prompt: 'Rewrite the following Markdown text in a friendly, casual, conversational tone. Preserve Markdown formatting. Return ONLY the rewritten text.',
    },
    {
      id: 'bullets',
      label: '• Convert to bullets',
      icon: '•',
      prompt: 'Convert the following text into a well-structured Markdown bullet list. Group related points. Use sub-bullets where helpful. Return ONLY the bullet list.',
    },
    {
      id: 'table',
      label: '📊 Convert to table',
      icon: '📊',
      prompt: 'Convert the following text into a Markdown table if it contains comparable items or data. If a table is not appropriate, return the text as a structured list. Return ONLY the table or list.',
    },
    {
      id: 'summarize',
      label: '📋 Summarize',
      icon: '📋',
      prompt: 'Write a concise 2-4 sentence Markdown summary of the following text. Capture the main points. Return ONLY the summary.',
    },
    {
      id: 'translate',
      label: '🌐 Translate…',
      icon: '🌐',
      prompt: null, // dynamically set
      needsTarget: true,
    },
  ];

  function getWritingTools() { return WRITING_TOOLS; }

  async function applyTool(toolId, selectedText, targetLang, onChunk) {
    const tool = WRITING_TOOLS.find(t => t.id === toolId);
    if (!tool) throw new Error(`Unknown tool: ${toolId}`);

    let prompt = tool.prompt;
    if (toolId === 'translate') {
      prompt = `Translate the following Markdown text to ${targetLang || 'Spanish'}. Preserve all Markdown formatting (bold, italic, code, headings, lists). Return ONLY the translated text.`;
    }

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: selectedText },
    ];

    return await AIRouter.complete(messages, { maxTokens: 2048, temperature: 0.3 }, onChunk);
  }

  // ── 3. SMART SUMMARY (one-shot for a full document) ──
  async function summarizeDocument(content, title, onChunk) {
    const messages = [
      {
        role: 'system',
        content: `You are a document analyst. Generate a structured Markdown summary for a document titled "${title}".
Output format:
## TL;DR
One paragraph, 2-3 sentences max.

## Key Points
- Bullet list of 5-8 main takeaways

## Key Terms
**term**: brief definition (3-5 most important terms only, skip obvious ones)

Be concise. Return ONLY the Markdown summary in this exact format.`,
      },
      { role: 'user', content: content.slice(0, 15000) },
    ];
    return await AIRouter.complete(messages, { maxTokens: 1024, temperature: 0.3 }, onChunk);
  }

  // ── 4. AUTO-TAG / CLASSIFY ───────────────────────────
  // Returns { tags: string[], category: string, readingTime: number }
  async function classifyDocument(content, title) {
    const messages = [
      {
        role: 'system',
        content: `Classify a document and return ONLY valid JSON, no markdown fences.
Return: {"tags": ["tag1","tag2","tag3"], "category": "one of: Technical|Business|Creative|Academic|Personal|Reference|Other", "sentiment": "positive|neutral|negative", "complexity": "beginner|intermediate|advanced"}`,
      },
      { role: 'user', content: `Title: ${title}\n\n${content.slice(0, 3000)}` },
    ];

    const raw = await AIRouter.complete(messages, { maxTokens: 200, temperature: 0.1 });
    try {
      const clean = raw.replace(/```json?|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return { tags: [], category: 'Other', sentiment: 'neutral', complexity: 'intermediate' };
    }
  }

  return { chat, clearChat, getWritingTools, applyTool, summarizeDocument, classifyDocument };
})();

// ═══════════════════════════════════════════════════════
//  COMMAND PALETTE
//  Cmd+K → fuzzy search files, headings, and all actions
// ═══════════════════════════════════════════════════════

const CommandPalette = (() => {
  let _visible   = false;
  let _onSelect  = null;
  let _items     = [];
  let _filtered  = [];
  let _cursor    = 0;

  // Static actions
  const STATIC_ACTIONS = [
    { type: 'action', id: 'new',        icon: '📄', label: 'New file',             shortcut: '⌘⇧N' },
    { type: 'action', id: 'import',     icon: '📥', label: 'Import file',           shortcut: '' },
    { type: 'action', id: 'focus',      icon: '🔲', label: 'Enter focus mode',      shortcut: '' },
    { type: 'action', id: 'theme',      icon: '🌙', label: 'Toggle dark/light',     shortcut: '' },
    { type: 'action', id: 'share',      icon: '🔗', label: 'Share current file',    shortcut: '' },
    { type: 'action', id: 'export',     icon: '💾', label: 'Export as HTML',        shortcut: '' },
    { type: 'action', id: 'summary',    icon: '🤖', label: 'AI: Summarize document',shortcut: '' },
    { type: 'action', id: 'chat',       icon: '💬', label: 'AI: Open document chat',shortcut: '' },
    { type: 'action', id: 'aikeys',     icon: '🔑', label: 'AI: Configure API keys',shortcut: '' },
    { type: 'action', id: 'cloud',      icon: '☁',  label: 'Cloud sync settings',   shortcut: '' },
    { type: 'action', id: 'deleteall',  icon: '🗑',  label: 'Delete all files',      shortcut: '' },
  ];

  function _fuzzyScore(query, target) {
    if (!query) return 1;
    const q = query.toLowerCase(), t = target.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 70;
    // Character-by-character fuzzy
    let qi = 0, score = 0, lastMatch = -1;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        score += lastMatch === i - 1 ? 5 : 1; // consecutive bonus
        lastMatch = i; qi++;
      }
    }
    return qi === q.length ? score : 0;
  }

  function _buildItems(files, tocItems) {
    _items = [
      ...STATIC_ACTIONS,
      ...files.map(f => ({
        type: 'file', id: f.id, icon: '◇',
        label: f.name, meta: f.sizeLabel,
      })),
      ...tocItems.map(h => ({
        type: 'heading', id: h.id, icon: '#'.repeat(Math.min(h.level, 3)),
        label: h.text, meta: `H${h.level}`,
      })),
    ];
  }

  function _render(query) {
    const listEl = document.getElementById('cpList');
    if (!listEl) return;

    _filtered = _items
      .map(item => ({ item, score: _fuzzyScore(query, item.label) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(x => x.item);

    if (!_filtered.length) {
      listEl.innerHTML = `<div class="cp-empty">No results for "${_esc(query)}"</div>`;
      return;
    }

    listEl.innerHTML = _filtered.map((item, i) => `
      <div class="cp-item ${i === _cursor ? 'selected' : ''}" data-idx="${i}">
        <span class="cp-icon">${item.icon}</span>
        <span class="cp-label">${_highlight(item.label, document.getElementById('cpInput')?.value || '')}</span>
        ${item.meta ? `<span class="cp-meta">${_esc(item.meta)}</span>` : ''}
        ${item.shortcut ? `<span class="cp-shortcut">${_esc(item.shortcut)}</span>` : ''}
        <span class="cp-type">${item.type}</span>
      </div>`).join('');

    listEl.querySelectorAll('.cp-item').forEach(el => {
      el.addEventListener('click', () => _select(parseInt(el.dataset.idx)));
      el.addEventListener('mouseenter', () => {
        _cursor = parseInt(el.dataset.idx);
        _highlight_cursor(listEl);
      });
    });
  }

  function _highlight(text, query) {
    if (!query) return _esc(text);
    const q = query.toLowerCase();
    let result = '', ti = 0, qused = new Set();
    const tl = text.toLowerCase();
    // Find matching chars
    const matches = new Set();
    let qi = 0;
    for (let i = 0; i < tl.length && qi < q.length; i++) {
      if (tl[i] === q[qi]) { matches.add(i); qi++; }
    }
    for (let i = 0; i < text.length; i++) {
      const ch = _esc(text[i]);
      result += matches.has(i) ? `<mark>${ch}</mark>` : ch;
    }
    return result;
  }

  function _highlight_cursor(listEl) {
    listEl.querySelectorAll('.cp-item').forEach((el, i) => {
      el.classList.toggle('selected', i === _cursor);
    });
  }

  function _select(idx) {
    const item = _filtered[idx];
    if (!item) return;
    hide();
    if (_onSelect) _onSelect(item);
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function show(files, tocItems, onSelect) {
    _onSelect = onSelect;
    _cursor   = 0;
    _buildItems(files, tocItems);

    const overlay = document.getElementById('commandPalette');
    const input   = document.getElementById('cpInput');
    if (!overlay || !input) return;

    input.value = '';
    _render('');
    overlay.classList.remove('hidden');
    _visible = true;
    setTimeout(() => input.focus(), 30);
  }

  function hide() {
    document.getElementById('commandPalette')?.classList.add('hidden');
    _visible = false;
  }

  function isVisible() { return _visible; }

  function handleKey(e) {
    if (!_visible) return false;
    if (e.key === 'Escape')    { hide(); return true; }
    if (e.key === 'ArrowDown') { _cursor = Math.min(_cursor + 1, _filtered.length - 1); _highlight_cursor(document.getElementById('cpList')); e.preventDefault(); return true; }
    if (e.key === 'ArrowUp')   { _cursor = Math.max(_cursor - 1, 0);                    _highlight_cursor(document.getElementById('cpList')); e.preventDefault(); return true; }
    if (e.key === 'Enter')     { _select(_cursor); e.preventDefault(); return true; }
    return false;
  }

  function handleInput(query) { _cursor = 0; _render(query); }

  return { show, hide, isVisible, handleKey, handleInput };
})();
