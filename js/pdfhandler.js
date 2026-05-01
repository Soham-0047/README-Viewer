/**
 * MarkVault v2 — PDF Handler
 *
 * Conversion modes (in priority order):
 *   1. Datalab  — POST /api/v1/convert → poll until complete.
 *                 Supports multiple API keys; auto-rotates when one is
 *                 exhausted (402 / credit error). Outputs markdown or HTML.
 *   2. Gemini   — Sends raw PDF bytes to Gemini 1.5 Flash (free tier).
 *   3. Algorithm — Local text-extraction fallback (no key needed).
 *
 * Render + Save:
 *   renderToContainer() — PDF.js canvas, continuous scroll, no page breaks.
 *   saveRenderedHTML()  — Exports canvas pages as embedded JPEG in HTML.
 */

const PDFHandler = (() => {

  // ── PDF.js lazy load ──────────────────────────────────
  let _lib = null;
  const WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  const CMAP   = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/';
  const FONTS  = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/standard_fonts/';

  async function _pdfjs() {
    if (_lib) return _lib;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.textContent = `
        import * as L from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs';
        L.GlobalWorkerOptions.workerSrc = '${WORKER}';
        window.__mvPdfLib = L;
      `;
      document.head.appendChild(s);
      let n = 0;
      const t = setInterval(() => {
        if (window.__mvPdfLib) { clearInterval(t); _lib = window.__mvPdfLib; res(); }
        if (++n > 150) { clearInterval(t); rej(new Error('PDF.js failed to load')); }
      }, 80);
    });
    return _lib;
  }

  async function loadDocument(arrayBuffer) {
    const lib = await _pdfjs();
    return lib.getDocument({ data: arrayBuffer, cMapUrl: CMAP, cMapPacked: true, standardFontDataUrl: FONTS }).promise;
  }

  // ── Cancel token ─────────────────────────────────────
  let _cancel = { cancelled: false };
  function cancelRender() { _cancel.cancelled = true; }

  // ═══════════════════════════════════════════════════════
  //  RENDER — PDF.js canvas viewer
  // ═══════════════════════════════════════════════════════
  async function renderToContainer(pdfDoc, container, onProgress) {
    container.innerHTML = '';
    const total = pdfDoc.numPages;
    _cancel = { cancelled: false };

    for (let p = 1; p <= total; p++) {
      if (_cancel.cancelled) break;
      const page  = await pdfDoc.getPage(p);
      const vp    = page.getViewport({ scale: _calcScale(page) });
      const wrap  = document.createElement('div');
      wrap.className = 'pdf-page-wrap';
      const lbl   = document.createElement('div');
      lbl.className  = 'pdf-page-label';
      lbl.textContent = `Page ${p} / ${total}`;
      const canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      wrap.appendChild(lbl);
      wrap.appendChild(canvas);
      container.appendChild(wrap);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      page.cleanup();
      if (onProgress) onProgress(p, total);
    }
  }

  function _calcScale(page) {
    const vp   = page.getViewport({ scale: 1 });
    const maxW = Math.min(window.innerWidth - 48, 960);
    return Math.min(maxW / vp.width, 2.2);
  }

  // ═══════════════════════════════════════════════════════
  //  SAVE RENDERED — export canvas pages as HTML
  // ═══════════════════════════════════════════════════════
  async function saveRenderedHTML(pagesContainer, filename, isDark) {
    const canvases = pagesContainer.querySelectorAll('canvas');
    if (!canvases.length) throw new Error('No rendered pages found');

    const imgs = [];
    for (const canvas of canvases) {
      imgs.push(`<div class="page"><img src="${canvas.toDataURL('image/jpeg', 0.92)}" alt="PDF page" /></div>`);
    }

    const bg  = isDark ? '#1a1a22' : '#f3f2ee';
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(filename)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:${bg};padding:24px;font-family:system-ui,sans-serif}
.page{max-width:960px;margin:0 auto 20px;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.35)}
.page img{display:block;width:100%;height:auto}
footer{text-align:center;color:${isDark?'#555':'#aaa'};font-size:11px;margin-top:12px}</style>
</head><body>${imgs.join('\n')}
<footer>Rendered by MarkVault · ${new Date().toLocaleDateString()}</footer>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename.replace(/\.pdf$/i,'') + '_rendered.html';
    a.click(); URL.revokeObjectURL(url);
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ═══════════════════════════════════════════════════════
  //  DATALAB CONVERSION
  //
  //  API flow:
  //    POST https://www.datalab.to/api/v1/convert
  //      Header: X-Api-Key: {key}
  //      Body (multipart): file, output_format, mode, paginate=false
  //    → { request_check_url }
  //    Poll GET {request_check_url} (same header) every 2.5s
  //    → { status: 'complete'|'processing'|'failed', markdown, html, ... }
  //
  //  Multi-key fallback:
  //    On 402 / 429 / credit-exhausted → mark key as exhausted, try next.
  //    On any other error → surface to user immediately.
  // ═══════════════════════════════════════════════════════

  const DL_CONVERT_URL = 'https://www.datalab.to/api/v1/convert';
  const DL_POLL_INTERVAL = 2500;   // ms between polls
  const DL_MAX_POLLS     = 144;    // 144 × 2.5s = 6 minutes max

  // Error class that carries HTTP status for exhaustion detection
  class DatalabError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
      this.name = 'DatalabError';
    }
  }

  function _isExhausted(err) {
    if (!(err instanceof DatalabError)) return false;
    // 402 = payment required (credits gone), 429 = rate limit
    if (err.status === 402 || err.status === 429) return true;
    const msg = (err.message || '').toLowerCase();
    return msg.includes('credit') || msg.includes('quota') ||
           msg.includes('exhausted') || msg.includes('limit') ||
           msg.includes('billing') || msg.includes('payment');
  }

  /**
   * convertWithDatalab(fileBlob, fileName, apiKeys, outputFormat, mode, onProgress)
   *
   * apiKeys: Array of { id, key, label } — tried in order.
   * Returns: { content: string, outputFormat: string, usedKey: { id, label } }
   * Throws DatalabError with .exhaustedIds = [id, ...] listing which keys were exhausted.
   */
  async function convertWithDatalab(fileBlob, fileName, apiKeys, outputFormat, mode, onProgress) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No Datalab API keys configured. Add at least one key.');
    }

    const exhaustedIds = [];

    for (let i = 0; i < apiKeys.length; i++) {
      const { id, key, label } = apiKeys[i];
      if (!key || !key.trim()) { exhaustedIds.push(id); continue; }

      if (onProgress) onProgress(0, 1, `Submitting via ${label || `Key ${i + 1}`}…`);

      try {
        const content = await _datalabConvert(
          fileBlob, fileName, key.trim(), outputFormat, mode,
          (poll, maxPoll, msg) => {
            if (onProgress) onProgress(poll, maxPoll, msg);
          }
        );
        return { content, outputFormat, usedKey: { id, label } };

      } catch(err) {
        if (_isExhausted(err)) {
          exhaustedIds.push(id);
          const remaining = apiKeys.length - i - 1;
          if (onProgress) onProgress(0, 1,
            `${label || `Key ${i+1}`} exhausted.${remaining > 0 ? ` Trying next key…` : ''}`
          );
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        // Non-exhaustion error → re-throw immediately
        throw err;
      }
    }

    const e = new DatalabError(402, `All ${apiKeys.length} Datalab API key${apiKeys.length > 1 ? 's' : ''} are exhausted or invalid.`);
    e.exhaustedIds = exhaustedIds;
    throw e;
  }

  async function _datalabConvert(fileBlob, fileName, apiKey, outputFormat, mode, onProgress) {
    // ── Submit ──────────────────────────────────────────
    const form = new FormData();
    form.append('file',          fileBlob, fileName);
    form.append('output_format', outputFormat);
    form.append('mode',          mode);
    form.append('paginate',      'false');
    form.append('disable_image_extraction', 'false');

    const submitResp = await fetch(DL_CONVERT_URL, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });

    if (!submitResp.ok) {
      let detail = `HTTP ${submitResp.status}`;
      try {
        const j = await submitResp.json();
        detail = j.detail || j.message || j.error || detail;
      } catch {}
      throw new DatalabError(submitResp.status, `Datalab: ${detail}`);
    }

    const submitData = await submitResp.json();
    if (!submitData.request_check_url) {
      throw new DatalabError(0, 'Datalab: no request_check_url in response');
    }

    // ── Poll ────────────────────────────────────────────
    for (let poll = 1; poll <= DL_MAX_POLLS; poll++) {
      await new Promise(r => setTimeout(r, DL_POLL_INTERVAL));

      const elapsed = Math.round(poll * DL_POLL_INTERVAL / 1000);
      if (onProgress) onProgress(poll, DL_MAX_POLLS, `Processing… ${elapsed}s`);

      const checkResp = await fetch(submitData.request_check_url, {
        headers: { 'X-Api-Key': apiKey },
      });

      if (!checkResp.ok) {
        let detail = `HTTP ${checkResp.status}`;
        try { const j = await checkResp.json(); detail = j.detail || j.message || detail; } catch {}
        throw new DatalabError(checkResp.status, `Datalab poll: ${detail}`);
      }

      const checkData = await checkResp.json();

      if (checkData.status === 'complete') {
        if (checkData.success === false) {
          throw new DatalabError(0, checkData.error || 'Conversion failed (no details)');
        }
        // Extract the right output field
        const content =
          outputFormat === 'markdown' ? (checkData.markdown || '') :
          outputFormat === 'html'     ? (checkData.html     || '') :
          JSON.stringify(checkData.json || {}, null, 2);

        if (!content.trim()) throw new DatalabError(0, 'Datalab returned empty content');

        if (onProgress) onProgress(DL_MAX_POLLS, DL_MAX_POLLS, 'Complete!');
        return content;
      }

      if (checkData.status === 'failed') {
        throw new DatalabError(0, checkData.error || 'Conversion failed');
      }
      // status === 'processing' → keep polling
    }

    throw new DatalabError(0, 'Datalab: timed out after 6 minutes');
  }

  // ═══════════════════════════════════════════════════════
  //  GEMINI CONVERSION
  // ═══════════════════════════════════════════════════════
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  const GEMINI_PROMPT = `You are a precise document converter. Convert the provided PDF to clean, well-structured Markdown.
RULES:
1. HEADINGS: Use # ## ### from visual font hierarchy.
2. PARAGRAPHS: Join wrapped lines. De-hyphenate line-end hyphens.
3. TABLES: Proper GFM markdown tables with | separators and |---|---| header row.
4. LISTS: - for bullets, 1. for numbered. Preserve nesting with 2-space indent.
5. CODE: Fenced blocks with language hint when identifiable.
6. MATH: $...$ inline, $$...$$ block.
7. STRIP: Page numbers, repeated headers/footers, watermarks.
8. OUTPUT: Only the Markdown. No preamble, no code fences around the whole output.`;

  async function convertWithAI(pdfDoc, apiKey, onProgress) {
    const total = pdfDoc.numPages;
    const BATCH = 20;

    if (total <= BATCH) {
      if (onProgress) onProgress(0, total, 'Preparing PDF…');
      if (!pdfDoc.__rawBase64) throw new Error('Raw PDF data not available. Re-import the file.');
      if (onProgress) onProgress(Math.floor(total * 0.3), total, 'Sending to Gemini…');
      const md = await _callGeminiPDF(apiKey, pdfDoc.__rawBase64, GEMINI_PROMPT);
      if (onProgress) onProgress(total, total, 'Done');
      return _cleanAI(md);
    }

    const parts = [];
    for (let start = 1; start <= total; start += BATCH) {
      const end = Math.min(start + BATCH - 1, total);
      if (onProgress) onProgress(start, total, `Rendering pages ${start}–${end}…`);
      const jpegs = await _pagesToJpeg(pdfDoc, start, end);
      if (onProgress) onProgress(start, total, `AI: pages ${start}–${end}…`);
      const prompt = GEMINI_PROMPT + `\n\n(Pages ${start}–${end} of ${total}. Output only these pages' Markdown.)`;
      parts.push(await _callGeminiImages(apiKey, jpegs, prompt));
      if (onProgress) onProgress(end, total, `Done pages ${start}–${end}`);
    }
    return _cleanAI(parts.join('\n\n'));
  }

  async function _callGeminiPDF(apiKey, base64, prompt) {
    const resp = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'application/pdf', data: base64 } },
          { text: prompt }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      })
    });
    if (!resp.ok) { const e = await resp.json().catch(()=>{}); throw new Error(`Gemini: ${e?.error?.message || resp.status}`); }
    return (await resp.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async function _callGeminiImages(apiKey, jpegs, prompt) {
    const parts = [...jpegs.map(b64 => ({ inline_data: { mime_type: 'image/jpeg', data: b64 } })), { text: prompt }];
    const resp = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } })
    });
    if (!resp.ok) { const e = await resp.json().catch(()=>{}); throw new Error(`Gemini: ${e?.error?.message || resp.status}`); }
    return (await resp.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async function _pagesToJpeg(pdfDoc, start, end) {
    const out = [];
    for (let p = start; p <= end; p++) {
      const page = await pdfDoc.getPage(p);
      const vp   = page.getViewport({ scale: 1.5 });
      const cv   = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      out.push(cv.toDataURL('image/jpeg', 0.88).split(',')[1]);
      page.cleanup();
    }
    return out;
  }

  function _cleanAI(md) {
    return md
      .replace(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/i, '$1')
      .replace(/^```(?:markdown)?\s*\n/i, '').replace(/\n```\s*$/i, '')
      .replace(/\n{4,}/g, '\n\n\n').trim();
  }

  // ═══════════════════════════════════════════════════════
  //  ALGORITHM CONVERSION (local fallback)
  // ═══════════════════════════════════════════════════════
  async function convertWithAlgo(pdfDoc, onProgress) {
    const total     = pdfDoc.numPages;
    const pageData  = [];

    for (let p = 1; p <= total; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent({ includeMarkedContent: false });
      const vp      = page.getViewport({ scale: 1 });
      pageData.push({ items: content.items, height: vp.height, num: p });
      page.cleanup();
      if (onProgress) onProgress(p, total, `Extracting page ${p}…`);
    }

    const allLines   = pageData.map(pd => _toLines(pd.items, pd.height, pd.num));
    const repeated   = _findRepeated(allLines);
    const { body, h1, h2, h3 } = _fontStats(allLines);
    const chunks = [];

    allLines.forEach((lines, pi) => {
      const clean = lines.filter(l => !repeated.has(_ry(l.y)) && l.text.trim());
      chunks.push(_pageToMd(clean, body, h1, h2, h3, pi + 1, total));
      if (onProgress) onProgress(pi + 1, total, `Converting page ${pi + 1}…`);
    });

    return chunks.filter(Boolean).join('\n\n---\n\n')
      .replace(/\n{4,}/g,'\n\n\n').replace(/---\s*\n\s*---/g,'---').trim();
  }

  function _toLines(items, H, pageNum) {
    const lines = []; const Y = 2.8;
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const [sx,,,sy,tx,ty] = it.transform;
      const fs = Math.abs(sy)||Math.abs(sx)||10;
      const y = H - ty, x = tx;
      const fn = (it.fontName||'').toLowerCase();
      const bold = /bold|heavy|black|demi/.test(fn);
      const mono = /mono|courier|consol|code|fixed|type/.test(fn);
      const ital = /italic|oblique/.test(fn);
      let l = lines.find(l => Math.abs(l.y - y) < Y);
      if (!l) { l = { y, minX:x, items:[], fontSize:fs, bold, mono, ital, pageNum, text:'' }; lines.push(l); }
      if (fs > l.fontSize) l.fontSize = fs;
      l.minX = Math.min(l.minX, x);
      if (bold) l.bold=true; if (mono) l.mono=true; if (ital) l.ital=true;
      l.items.push({ str:it.str, x, w:it.width||0, fs });
    }
    lines.sort((a,b) => a.y-b.y);
    for (const l of lines) {
      l.items.sort((a,b)=>a.x-b.x);
      l.text = l.items.reduce((out,it,i) => {
        if (i>0) { const p=l.items[i-1], gap=it.x-(p.x+p.str.length*p.fs*0.52); if(gap>p.fs*0.55) out+=' '; }
        return out+it.str;
      }, '');
    }
    return lines.filter(l=>l.text.trim());
  }

  function _ry(y) { return Math.round(y/4)*4; }

  function _findRepeated(all) {
    if (all.length < 3) return new Set();
    const freq = {};
    for (const page of all) { const seen=new Set(); for (const l of page) { const k=_ry(l.y); if(!seen.has(k)){freq[k]=(freq[k]||0)+1; seen.add(k);} } }
    const thr = Math.max(3, all.length*0.55);
    return new Set(Object.keys(freq).filter(k=>freq[k]>=thr));
  }

  function _fontStats(all) {
    const sizes = all.flatMap(p=>p.map(l=>l.fontSize)).filter(Boolean).sort((a,b)=>a-b);
    const body  = sizes[Math.floor(sizes.length*0.5)] || 10;
    return { body, h1:body*1.75, h2:body*1.35, h3:body*1.12 };
  }

  function _pageToMd(lines, body, h1, h2, h3, pNum, total) {
    const out=[]; let prevY=null, inCode=false, listBuf=[], paraBuf=[];
    const flushPara=()=>{ if(paraBuf.length){ out.push(paraBuf.join(' ')); paraBuf=[]; } };
    const flushList=()=>{ if(listBuf.length){ flushPara(); out.push(listBuf.join('\n')); listBuf=[]; } };

    for (const l of lines) {
      const t = l.text.trim(); if (!t) continue;
      const gap = prevY!==null && (l.y-prevY) > l.fontSize*2.2;
      prevY = l.y;

      if (l.mono) {
        if (!inCode){ flushList(); flushPara(); out.push('```'); inCode=true; }
        out.push(t); continue;
      }
      if (inCode) { out.push('```'); inCode=false; }
      if (_isPageNum(t,pNum,total)) continue;

      const row = _tableRow(l);
      if (row) {
        flushList(); flushPara();
        const prev = out[out.length-1];
        out.push(row);
        if (prev?.startsWith('|') && !prev.startsWith('|---') && !out[out.length-3]?.startsWith('|---')) {
          const cols = (row.match(/\|/g)||[]).length - 1;
          out.splice(out.length-1, 0, '|'+' --- |'.repeat(cols));
        }
        continue;
      }

      const hLvl = _hLevel(l, t, h1, h2, h3);
      if (hLvl) {
        flushList(); flushPara();
        if (out.length && out[out.length-1]!=='') out.push('');
        out.push('#'.repeat(hLvl)+' '+t.replace(/\s+/g,' '));
        out.push(''); continue;
      }

      const li = _listItem(t);
      if (li) { flushPara(); if(!listBuf.length&&gap) out.push(''); listBuf.push(li); continue; }
      flushList();

      let txt = t.replace(/\s+/g,' ').replace(/[""]/g,'"').replace(/['']/g,"'");
      if (l.bold&&l.ital) txt=`**_${txt}_**`; else if(l.bold) txt=`**${txt}**`; else if(l.ital) txt=`_${txt}_`;

      if (gap) { flushPara(); if(out.length&&out[out.length-1]!=='') out.push(''); paraBuf.push(txt); }
      else if (paraBuf.length) {
        const last=paraBuf[paraBuf.length-1];
        if (last.endsWith('-')) paraBuf[paraBuf.length-1]=last.slice(0,-1)+txt; else paraBuf.push(txt);
      } else paraBuf.push(txt);
    }
    if (inCode) out.push('```'); flushList(); flushPara();
    return out.join('\n');
  }

  function _hLevel(l,t,h1,h2,h3) {
    if (t.length>110) return 0;
    const fs=l.fontSize;
    if (fs>=h1||(l.bold&&fs>=h1*0.88)) return 1;
    if (fs>=h2||(l.bold&&fs>=h2*0.88&&t.length<70)) return 2;
    if (l.bold&&fs>=h3&&t.length<85) return 3;
    if (t===t.toUpperCase()&&/[A-Z]{2,}/.test(t)&&t.length<55) return 3;
    return 0;
  }
  function _listItem(t) {
    const m1=t.match(/^([•·▪▸→✓✗◆○●\-\*])\s+(.+)/u); if(m1) return `- ${m1[2].trim()}`;
    const m2=t.match(/^(\(?(?:\d+|[a-z])[.)]\)?\s+)(.+)/); if(m2) return `${m2[1].trim()} ${m2[2].trim()}`;
    return null;
  }
  function _tableRow(l) {
    if (!l.items||l.items.length<2) return null;
    const minGap = l.fontSize*2.8;
    if (!l.items.some((_,i)=>i>0&&l.items[i].x-l.items[i-1].x>minGap)) return null;
    const cols = l.items.map(it=>it.str.trim()).filter(Boolean);
    return cols.length>=2 ? '| '+cols.join(' | ')+' |' : null;
  }
  function _isPageNum(t,pNum,total) {
    if (/^\d+$/.test(t.trim())) { const n=parseInt(t); if(n>=1&&n<=total+5) return true; }
    return /^page\s+\d+(\s+of\s+\d+)?$/i.test(t)||/^\d+\s*[/－]\s*\d+$/.test(t);
  }

  // ═══════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════
  return {
    loadDocument, renderToContainer, cancelRender, saveRenderedHTML,
    convertWithDatalab, convertWithAI, convertWithAlgo,
    DatalabError,
  };
})();

// Load PDF keeping raw base64 for AI/Datalab conversion
PDFHandler._loadFromFile = async function(file) {
  const buf    = await file.arrayBuffer();
  const pdfDoc = await PDFHandler.loadDocument(buf.slice(0));
  // Store original bytes as base64 (for Gemini inline_data)
  const bytes  = new Uint8Array(buf);
  let binary   = '';
  const chunk  = 8192;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+chunk, bytes.length)));
  pdfDoc.__rawBase64 = btoa(binary);
  pdfDoc.__fileBlob  = file;          // keep original Blob for Datalab multipart
  pdfDoc.__fileName  = file.name;
  return pdfDoc;
};
