/**
 * MarkVault v2 — Renderer
 * 
 * Pipeline:
 *   raw markdown
 *     → pre-process (extract math, handle special syntax)
 *     → marked.js (GFM + custom renderer)
 *     → post-process (restore math, inject KaTeX, Mermaid)
 *     → DOMPurify sanitize
 *     → inject into DOM
 *     → highlight.js code blocks
 *     → render Mermaid diagrams
 *     → render KaTeX math
 *     → TOC + scroll-spy
 */

const Renderer = (() => {

  let _isDark         = true;
  let _observer       = null;  // IntersectionObserver for scroll-spy
  let _mathStore      = [];    // extracted math blocks
  // Keyed by element id → raw mermaid source string.
  // Avoids reading back from the DOM (where HTML-escaping and re-render
  // artefacts corrupt the source text and cause "Syntax error in text").
  const _mermaidSources = new Map();

  // ── Mermaid init ──────────────────────────────────────
  function _initMermaid(dark) {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 14,
      themeVariables: dark ? {
        primaryColor:      '#252840',
        primaryTextColor:  '#E6E7F0',
        primaryBorderColor:'#F5A623',
        lineColor:         '#8A8FA8',
        secondaryColor:    '#1A1D2A',
        tertiaryColor:     '#13161F',
        edgeLabelBackground:'#181A22',
        clusterBkg:        '#1A1D2A',
        titleColor:        '#E6E7F0',
        attributeBackgroundColorEven:'#1D1F29',
        attributeBackgroundColorOdd: '#232639',
      } : {
        primaryColor:      '#F3F2EE',
        primaryTextColor:  '#1A1917',
        primaryBorderColor:'#C8860E',
        lineColor:         '#58564F',
        secondaryColor:    '#ECEAE3',
        tertiaryColor:     '#FDFCFA',
      },
    });
  }

  // ── Heading slug ──────────────────────────────────────
  function _slug(text) {
    return text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')           // strip HTML tags
      .replace(/[^\w\s\u00C0-\u017F-]/g,'') // keep unicode letters
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ── Math extraction (protect from Markdown parser) ───
  function _extractMath(src) {
    _mathStore = [];
    let i = 0;

    // Fenced display math: $$ ... $$ (multi-line)
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      _mathStore.push({ type: 'display', expr: expr.trim() });
      return `@@MATH${i++}@@`;
    });

    // Inline math: $...$ — careful not to match $$
    src = src.replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
      _mathStore.push({ type: 'inline', expr: expr.trim() });
      return `@@MATH${i++}@@`;
    });

    return src;
  }

  function _restoreMath(html) {
    if (typeof katex === 'undefined') return html;
    return html.replace(/@@MATH(\d+)@@/g, (_, idx) => {
      const m = _mathStore[parseInt(idx)];
      if (!m) return '';
      try {
        return katex.renderToString(m.expr, {
          displayMode: m.type === 'display',
          throwOnError: false,
          strict: false,
          trust: false,
          output: 'htmlAndMathml',
        });
      } catch(e) {
        return `<span class="katex-error" title="${_esc(e.message)}">⚠ Math error</span>`;
      }
    });
  }

  // ── HTML escape ───────────────────────────────────────
  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Custom Marked renderer ────────────────────────────
  function _buildRenderer() {
    const r = new marked.Renderer();

    // ── Code blocks ────────────────────────────────────
    r.code = function(token) {
      // marked v12 passes {text, lang, escaped}
      const code = typeof token === 'object' ? token.text  : token;
      const lang = typeof token === 'object' ? (token.lang || '') : (arguments[1] || '');
      const langLower = lang.toLowerCase().trim();

      // Mermaid — store raw source in Map; render an EMPTY placeholder div.
      // NEVER put the source as innerHTML: HTML-escaping corrupts arrow syntax
      // (e.g. --> becomes --&gt;) and textContent extraction breaks on re-render
      // because the div already contains the rendered SVG by that point.
      if (langLower === 'mermaid') {
        const id = 'mv-mmd-' + Math.random().toString(36).slice(2, 10);
        _mermaidSources.set(id, code);  // store raw, unescaped source
        return `<div class="mermaid-outer"><div class="mermaid" id="${id}"></div></div>`;
      }

      // Syntax highlight
      let highlighted = '';
      let detectedLang = langLower;
      if (langLower && hljs.getLanguage(langLower)) {
        try { highlighted = hljs.highlight(code, { language:langLower, ignoreIllegals:true }).value; }
        catch { highlighted = _esc(code); }
      } else if (!langLower) {
        // Auto-detect
        try {
          const result = hljs.highlightAuto(code, [
            'javascript','typescript','python','java','cpp','csharp','go',
            'rust','ruby','php','swift','kotlin','bash','sql','json','yaml','xml','css','html'
          ]);
          highlighted  = result.value;
          detectedLang = result.language || '';
        } catch { highlighted = _esc(code); }
      } else {
        highlighted = _esc(code);
      }

      const langLabel = detectedLang
        ? `<span class="code-lang-label">${_esc(detectedLang)}</span>`
        : '';
      const copyBtn = `<button class="code-copy-btn" onclick="Renderer.copyCode(this)" title="Copy code">copy</button>`;
      return `<pre>${langLabel}<code class="hljs${detectedLang ? ` language-${_esc(detectedLang)}` : ''}">${highlighted}</code>${copyBtn}</pre>`;
    };

    // ── Headings with anchor links ──────────────────────
    r.heading = function(token) {
      const text  = typeof token === 'object' ? (token.text || token.raw || '') : token;
      const depth = typeof token === 'object' ? token.depth : (arguments[1] || 1);
      const plain = text.replace(/<[^>]+>/g, ''); // strip inner HTML for id
      const id    = _slug(plain);
      return `<h${depth} id="${id}">${text}<a class="anchor-link" href="#${id}" aria-hidden="true">#</a></h${depth}>\n`;
    };

    // ── Tables with overflow wrapper ────────────────────
    r.table = function(token) {
      if (typeof token === 'object' && token.header !== undefined) {
        // v12 format — render manually
        const hCells = token.header.map(cell => {
          const align = cell.align ? ` style="text-align:${cell.align}"` : '';
          return `<th${align}>${cell.tokens ? marked.parseInline(cell.tokens.map(t => t.raw||'').join('')) : cell.text}</th>`;
        }).join('');
        const rows = token.rows.map(row => {
          const cells = row.map((cell, i) => {
            const align = token.header[i]?.align ? ` style="text-align:${token.header[i].align}"` : '';
            return `<td${align}>${cell.tokens ? marked.parseInline(cell.tokens.map(t=>t.raw||'').join('')) : cell.text}</td>`;
          }).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<div class="table-wrap"><table><thead><tr>${hCells}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      // Fallback for older format
      const header = arguments[0]; const body = arguments[1];
      return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    };

    // ── Images with lightbox support ────────────────────
    r.image = function(token) {
      const href  = typeof token === 'object' ? token.href  : token;
      const title = typeof token === 'object' ? (token.title||'') : (arguments[1]||'');
      const text  = typeof token === 'object' ? token.text  : (arguments[2]||'');
      if (!href) return '';
      const isExternal = /^https?:\/\//.test(href) || href.startsWith('data:');
      const titleAttr  = title ? ` title="${_esc(title)}"` : '';
      // Don't lightbox inline emoji / tiny images
      return `<img src="${_esc(href)}" alt="${_esc(text)}"${titleAttr} loading="lazy" onclick="Renderer.openLightbox(this)" />`;
    };

    // ── Links — open external in new tab ───────────────
    r.link = function(token) {
      const href  = typeof token === 'object' ? token.href  : token;
      const title = typeof token === 'object' ? (token.title||'') : (arguments[1]||'');
      const text  = typeof token === 'object'
        ? (token.tokens ? marked.parseInline(token.tokens.map(t=>t.raw||'').join('')) : (token.text||''))
        : (arguments[2]||'');
      if (!href) return text;
      const isExternal = /^https?:/.test(href);
      const ext   = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      const ext_icon = isExternal ? ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;vertical-align:middle"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' : '';
      const t = title ? ` title="${_esc(title)}"` : '';
      return `<a href="${_esc(href)}"${t}${ext}>${text}${ext_icon}</a>`;
    };

    // ── Task list items ─────────────────────────────────
    r.listitem = function(token) {
      if (typeof token === 'object' && token.task) {
        const checked = token.checked ? ' checked' : '';
        const body    = token.tokens ? marked.parse(token.tokens.map(t=>t.raw||'').join('')) : (token.text||'');
        return `<li class="task-list-item"><input type="checkbox"${checked} disabled> ${body.replace(/^<p>|<\/p>\n?$/g,'')}</li>\n`;
      }
      const text = typeof token === 'object'
        ? (token.tokens ? marked.parse(token.tokens.map(t=>t.raw||'').join('')) : (token.text||''))
        : token;
      const loose = typeof token === 'object' ? token.loose : false;
      return `<li>${text}</li>\n`;
    };

    // ── Blockquote with callout types ───────────────────
    r.blockquote = function(token) {
      const body = typeof token === 'object'
        ? (token.tokens ? marked.parse(token.tokens.map(t=>t.raw||'').join('')) : (token.text||''))
        : token;
      // GitHub-style callouts: > [!NOTE], > [!WARNING], > [!TIP], > [!CAUTION], > [!IMPORTANT]
      const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]/i);
      if (calloutMatch) {
        const type  = calloutMatch[1].toLowerCase();
        const icons = { note:'ℹ', tip:'💡', warning:'⚠', caution:'⛔', important:'❗' };
        const icon  = icons[type] || 'ℹ';
        const inner = body.replace(/^<p>\[!(?:NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\n?/i, '<p>');
        return `<blockquote class="callout callout-${type}"><span class="callout-icon">${icon}</span><div class="callout-body">${inner}</div></blockquote>`;
      }
      return `<blockquote>${body}</blockquote>`;
    };

    // ── Horizontal rule ─────────────────────────────────
    r.hr = function() { return '<hr />\n'; };

    return r;
  }

  // ── Configure marked ─────────────────────────────────
  function _setupMarked() {
    marked.use({
      renderer: _buildRenderer(),
      gfm:      true,
      breaks:   false,
      pedantic: false,
      // Smart quotes & dashes extension via hooks
    });
  }

  // ── Smart typography post-process ────────────────────
  function _smartTypo(html) {
    // Only in text nodes, not inside HTML tags or code
    return html
      .replace(/(?<=>|^)([^<]*?)(?=<|$)/g, (_, txt) => {
        return txt
          .replace(/--/g, '—')         // em dash
          .replace(/\.\.\./g, '…');     // ellipsis
      });
  }

  // ── Main render ───────────────────────────────────────
  async function render(markdown, container, isDark = true) {
    _isDark = isDark;
    _initMermaid(isDark);
    _setupMarked();
    _mermaidSources.clear();  // reset for this render pass

    // 1. Pre-process: extract math blocks
    let src = _extractMath(markdown);

    // 2. Parse Markdown → HTML
    let html = marked.parse(src, { async: false });

    // 3. Restore math (render with KaTeX)
    html = _restoreMath(html);

    // 4. Smart typography
    html = _smartTypo(html);

    // 5. Sanitize with DOMPurify
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ADD_TAGS: [
          'math','mrow','mi','mo','mn','ms','mtext','mspace','mover','munder',
          'msup','msub','msubsup','mfrac','msqrt','mroot','mtable','mtr','mtd',
          'mlabeledtr','maligngroup','malignmark','semantics','annotation',
          'annotation-xml','mstyle','merror','mpadded','mphantom','mfenced',
          'menclose','mglyph',
        ],
        ADD_ATTR: [
          'class','id','style','aria-hidden','aria-label','loading',
          'onclick','target','rel','data-mermaid-id',
          'encoding','xmlns','mathvariant','mathsize','mathcolor',
          'displaystyle','scriptlevel','checked','disabled',
        ],
        FORCE_BODY: false,
        ALLOW_DATA_ATTR: true,
      });
    }

    // 6. Insert into DOM
    container.innerHTML = html;

    // 7. Re-apply hljs to any code blocks that weren't caught
    container.querySelectorAll('pre code:not(.hljs)').forEach(el => {
      try { hljs.highlightElement(el); } catch {}
    });

    // 8. Render Mermaid diagrams
    await _renderMermaid(container, isDark);

    // 9. Add callout styles (CSS is in style.css via .callout-*)
    //    Ensure table-wraps are scrollable
    container.querySelectorAll('.table-wrap').forEach(tw => {
      tw.style.setProperty('-webkit-overflow-scrolling', 'touch');
    });

    // 10. Image lightbox binding (also bound via onclick attr)
    container.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => {
        img.style.opacity = '.3';
        img.title = 'Image failed to load';
      });
    });

    // 11. TOC
    const tocItems = _buildTOC(container);

    // 12. Scroll-spy
    _startScrollSpy(container);

    return tocItems;
  }

  // ── Mermaid rendering ─────────────────────────────────
  async function _renderMermaid(container, isDark) {
    if (typeof mermaid === 'undefined') return;
    const els = container.querySelectorAll('.mermaid');
    for (const el of els) {
      const id = el.id;
      if (!id) continue;

      // Pull source from our Map — NEVER from textContent.
      // textContent is broken because:
      //   a) First render: HTML entities corrupt arrow syntax (> → &gt;)
      //   b) Re-render:    div already contains the rendered SVG, not diagram source
      const source = _mermaidSources.get(id);
      if (!source || !source.trim()) continue;

      // Use a render target ID that can never collide with existing DOM nodes.
      // mermaid v10 fails if an element with the render ID already exists.
      const renderId = 'mv-render-' + id + '-' + Date.now();

      try {
        const { svg } = await mermaid.render(renderId, source.trim());
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svg;
        const svgEl = wrapper.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.removeAttribute('id');   // prevent future ID collisions
          el.innerHTML = '';
          el.appendChild(svgEl);
        }
      } catch(e) {
        // Show a friendly error with the diagram source for debugging
        const short = (e.message || '').replace(/\n[\s\S]*/,'').slice(0, 120);
        el.innerHTML = `<div class="mermaid-error">⚠ Diagram error: ${_esc(short)}</div>`;
      }
    }
  }

  // ── TOC builder ───────────────────────────────────────
  function _buildTOC(container) {
    const headings = container.querySelectorAll('h1,h2,h3,h4');
    if (headings.length < 2) return [];
    return Array.from(headings).map(h => ({
      level: parseInt(h.tagName[1]),
      text:  h.innerText.replace(/#\s*$/, '').trim(),
      id:    h.id,
    }));
  }

  function renderTOC(items, tocEl) {
    if (!tocEl) return;
    tocEl.innerHTML = '';
    if (!items || items.length === 0) {
      tocEl.innerHTML = '<p style="padding:12px 14px;font-size:12px;color:var(--txt3)">No headings found</p>';
      return;
    }
    items.forEach(item => {
      const a = document.createElement('a');
      a.className   = `toc-item h${item.level}`;
      a.textContent = item.text;
      a.href        = `#${item.id}`;
      a.dataset.id  = item.id;
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.getElementById(item.id);
        if (target) {
          target.scrollIntoView({ behavior:'smooth', block:'start' });
          // Offset for topbar
          setTimeout(() => window.scrollBy(0, -60), 350);
        }
        document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
        a.classList.add('active');
      });
      tocEl.appendChild(a);
    });
  }

  // ── Scroll spy ────────────────────────────────────────
  function _startScrollSpy(container) {
    if (_observer) _observer.disconnect();
    const headings = container.querySelectorAll('h1,h2,h3,h4');
    if (headings.length === 0) return;
    _observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.toc-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
          });
        }
      });
    }, { rootMargin:'-5% 0px -80% 0px', threshold:0 });
    headings.forEach(h => _observer.observe(h));
  }

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(imgEl) {
    const lb    = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    if (!lb || !lbImg || !imgEl.src) return;
    lbImg.src = imgEl.src;
    lbImg.alt = imgEl.alt;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Copy code ─────────────────────────────────────────
  function copyCode(btn) {
    const codeEl = btn.previousElementSibling;
    const text   = codeEl ? codeEl.textContent : '';
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ copied';
      btn.style.color = 'var(--success)';
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.style.color = '';
      }, 1800);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = 'copy', 1500);
    });
  }

  // ── Export standalone HTML ────────────────────────────
  function exportHTML(title, htmlContent, isDark) {
    const hljsTheme = isDark
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    const bgMain    = isDark ? '#0C0D12' : '#F3F2EE';
    const bgSurface = isDark ? '#111318' : '#FDFCFA';
    const bgRaised  = isDark ? '#181A22' : '#ECEAE3';
    const txtMain   = isDark ? '#E6E7F0' : '#1A1917';
    const txt2      = isDark ? '#8A8FA8' : '#58564F';
    const accent    = isDark ? '#F5A623' : '#C8860E';
    const border    = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)';

    const full = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(title)} — MarkVault Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${hljsTheme}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
<style>
:root{--bg:${bgMain};--sf:${bgSurface};--ra:${bgRaised};--tx:${txtMain};--t2:${txt2};--ac:${accent};--bd:${border};}
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:15px}
body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--tx);padding:clamp(20px,5vw,64px) clamp(16px,4vw,48px);min-height:100vh;-webkit-font-smoothing:antialiased}
article{max-width:800px;margin:0 auto;font-size:15.5px;line-height:1.82;word-break:break-word}
h1,h2,h3,h4,h5,h6{font-family:'Syne',sans-serif;font-weight:700;letter-spacing:-.3px;margin-top:2em;margin-bottom:.55em;line-height:1.3}
h1{font-size:2em;border-bottom:2px solid var(--ac);padding-bottom:8px}
h2{font-size:1.55em;border-bottom:1px solid var(--bd);padding-bottom:5px}
h3{font-size:1.25em}h4{font-size:1.05em}
h1:first-child,h2:first-child{margin-top:0}
p{margin-bottom:1em}
a{color:var(--ac)}
strong{font-weight:600}
blockquote{border-left:3px solid var(--ac);margin:1.2em 0;padding:10px 18px;background:rgba(200,134,14,.08);border-radius:0 6px 6px 0;color:var(--t2)}
blockquote>p{margin:0}
code:not(pre code){font-family:'JetBrains Mono',monospace;font-size:.855em;background:var(--ra);color:var(--ac);padding:1px 5px;border-radius:4px;border:1px solid var(--bd)}
pre{margin:1.2em 0;border-radius:10px;border:1px solid var(--bd);overflow:auto}
pre code.hljs{padding:16px 18px;font-size:13px}
.table-wrap{overflow-x:auto;margin:1.2em 0;border-radius:10px;border:1px solid var(--bd)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{background:var(--ra);font-family:'Syne',sans-serif;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:2px solid var(--ac)}
td{padding:9px 14px;border-bottom:1px solid var(--bd)}
tr:last-child td{border-bottom:none}
img{max-width:100%;border-radius:10px;display:block;margin:1em 0}
hr{border:none;border-top:1px solid var(--bd);margin:2em 0}
ul,ol{padding-left:1.6em;margin-bottom:1em}li{margin-bottom:.3em}
.task-list-item{list-style:none;margin-left:-1.1em}
input[type=checkbox]{accent-color:var(--ac);margin-right:6px;pointer-events:none}
.mermaid-outer{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:24px;margin:1.2em 0;overflow-x:auto;text-align:center}
.mermaid-outer svg{max-width:100%}
.callout{border-left:3px solid var(--ac);margin:1.2em 0;padding:10px 18px;background:rgba(200,134,14,.08);border-radius:0 6px 6px 0;display:flex;gap:10px}
.callout-body{flex:1}
.anchor-link{display:none}
footer{margin-top:64px;padding-top:20px;border-top:1px solid var(--bd);font-size:11px;color:var(--t2);text-align:center}
</style>
</head>
<body>
<article>${htmlContent}</article>
<footer>Exported from MarkVault · ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</footer>
</body>
</html>`;

    const blob = new Blob([full], { type:'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = title.replace(/[^\w\s.-]/g,'').trim().replace(/\s+/g,'-').replace(/\.md$/i,'') + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Re-render on theme change ─────────────────────────
  async function rerender(container) {
    // Re-initialize mermaid with the new theme, then re-render all diagrams.
    // _mermaidSources still holds every diagram's raw source from the last
    // render() call, so we can safely re-draw without touching textContent.
    _initMermaid(_isDark);
    await _renderMermaid(container, _isDark);
  }

  return {
    render, renderTOC, rerender,
    openLightbox, closeLightbox, copyCode, exportHTML,
  };
})();

// Expose globals for inline handlers
window.Renderer = Renderer;
