# MarkVault ◈

> A production-ready, cross-device Markdown workspace with AI assistance, real-time cloud sync, PDF conversion, private sharing, and offline support — deployable free on GitHub Pages.

---

## Table of Contents

- [What is MarkVault?](#what-is-markvault)
- [Quick Start](#quick-start)
- [First-Time Setup](#first-time-setup)
- [Cross-Device Sync & Authentication](#cross-device-sync--authentication)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [AI Features](#ai-features)
- [PDF Support](#pdf-support)
- [File Sharing](#file-sharing)
- [Privacy & Security](#privacy--security)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Firestore Security Rules](#firestore-security-rules)

---

## What is MarkVault?

MarkVault is a **private Markdown file manager** that runs entirely in your browser. Think of it as a personal Notion/Obsidian — but free, self-hosted on GitHub Pages, and with AI built in.

**Key philosophy:**
- Your files stay in **your** browser (localStorage) — no server, no vendor lock-in
- Optional Firebase sync makes files available on **every device** you sign into
- All AI API keys belong to **you** — no one else pays for or sees your usage
- Share links are **cryptographically private** — only people with the exact URL can view

---

## Quick Start

### Option 1 — Open locally (no setup)
```bash
# Just open index.html in any browser
open index.html     # macOS
start index.html    # Windows
```

### Option 2 — GitHub Pages (recommended, free)
1. Fork or upload this repo to GitHub
2. Go to **Settings → Pages → Source → main branch / root**
3. Your app is live at `https://yourusername.github.io/repo-name/`

### Option 3 — Local dev server
```bash
npx serve .
# or
python -m http.server 8080
# visit http://localhost:8080
```

---

## First-Time Setup

When you open MarkVault for the first time you will see the **auth gate**:

```
┌─────────────────────────────────┐
│           ◈ MarkVault           │
│                                 │
│   [Continue with Google]        │
│                                 │
│   ─────────── or ───────────    │
│                                 │
│   Use without account           │
│   Files stay on this device     │
└─────────────────────────────────┘
```

**Option A — Use without account:** Click "Use without account". Your files are saved in your browser's localStorage. They're available until you clear your browser data, but **won't sync to other devices**.

**Option B — Sign in with Google:** See [Cross-Device Sync](#cross-device-sync--authentication) below. Requires ~5 minutes of Firebase setup once.

---

## Cross-Device Sync & Authentication

MarkVault uses **Firebase Firestore + Google Authentication** for cross-device sync. Your files are stored at `users/{your-uid}/files/` — completely private and inaccessible to anyone else.

### How to set up (one time, ~5 minutes)

**Step 1 — Create a Firebase project**
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `markvault`) → Create project

**Step 2 — Add a Web app**
1. Click the **`</>`** (Web) icon on the project overview page
2. Register the app (any name) → copy the `firebaseConfig` block that appears

**Step 3 — Enable Firestore**
1. In the left sidebar: **Build → Firestore Database**
2. Click **Create database** → choose a region near you → **Start in test mode** → Enable

**Step 4 — Enable Google Authentication**
1. **Build → Authentication → Get started**
2. Under **Sign-in method** → click **Google** → Enable → Save

**Step 5 — Add your domain (important for GitHub Pages)**
1. **Authentication → Settings → Authorized domains**
2. Click **Add domain** → enter `yourusername.github.io`
3. Also add `localhost` if you run it locally

**Step 6 — Connect in MarkVault**
1. In MarkVault: click the **☁ cloud icon** in the sidebar header
2. Paste your `firebaseConfig` JSON
3. Click **Connect**
4. The modal will show a **Sign in with Google** button
5. Click it → approve in the popup → you're signed in on this device

**Step 7 — Sign in on other devices**
On any other phone, tablet, or computer:
1. Open your GitHub Pages URL
2. The auth gate appears → click **Continue with Google**
3. Sign in with the **same Google account**
4. Your files appear automatically — real-time sync active

### How identity works

```
Your Google Account
       ↓
  uid = "abc123xyz"  (permanent, never changes)
       ↓
Firestore path: users/abc123xyz/files/
       ↓
Same path on every device → same files everywhere
```

Sign out reverts to local-only mode. Your files remain in localStorage on that device.

---

## Features

### 📝 Markdown Rendering
- Full **GitHub Flavored Markdown** (tables, task lists, strikethrough, autolinks)
- Syntax highlighting for **200+ languages** (Python, JS, Rust, Go, SQL, YAML, etc.)
- **KaTeX math** — inline `$...$` and display `$$...$$`
- **Mermaid diagrams** — flowcharts, sequence, gantt, pie charts
- GitHub-style **callouts** — `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`
- Image **lightbox** zoom on click
- External links open in new tab with icon indicator
- Heading **anchor links** for deep-linking

### 📁 File Management
- **Drag & drop** import (`.md`, `.markdown`, `.txt`, `.pdf`)
- **Import from URL** — paste any GitHub raw, HackMD, Gist, or Pastebin link
- **File templates** — Meeting Notes, Blog Post, README, API Docs, Weekly Review, Research Notes, Decision Doc, Changelog, and more
- **Star/pin files** — starred files appear in a pinned section at the top of the sidebar
- **Drag to reorder** — grab the `⠿` handle to rearrange files in the sidebar
- File metadata: size, line count, word count, last updated
- Full-text **search across all files**

### ✏️ Editor
- Clean **plain-text editor** with monospace font
- **Auto-save** — saves 2 seconds after you stop typing; amber indicator shows unsaved state
- **Split pane mode** — editor and live preview side by side (drag to resize the divider)
- Tab key inserts 2 spaces
- Word count shown in editor toolbar
- `Cmd+S` saves instantly

### 🔍 Navigation
- **Command palette** (`Cmd+K`) — fuzzy search files, headings, and all app actions in one place
- **In-document Find** (`Cmd+F`) — search within the rendered preview with match highlighting and navigation
- **Table of Contents** — auto-generated from headings, with scroll-spy active-heading tracking
- **Reading progress bar** — thin line under topbar shows scroll position
- **Resume reading** — scroll position saved per file, restored on reopen

### 🎨 UI/UX
- **Dark / Light theme** — remembers your preference
- **Focus / Zen mode** — distraction-free full-screen reader; adjustable font size (12–26px) and line width (narrow/normal/wide/full); independent theme toggle
- **Collapsible sidebar** — hamburger toggles it on any screen size; glows amber when collapsed
- Mobile **bottom navigation bar** for thumb-friendly access
- Fully **responsive** — works on phones, tablets, and desktops
- **Installable PWA** — Chrome/Edge show an install prompt; works offline after first load

### ☁ Sync & Storage
- **localStorage** — always-on, instant, works offline
- **Firebase Firestore** — real-time cross-device sync; latest-timestamp wins on conflict
- Files stored at `users/{uid}/files/{id}` — completely private per user
- **Force sync** button to push all local files to cloud manually

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette |
| `Cmd+F` | Find in document |
| `Cmd+S` | Save file |
| `Cmd+E` | Edit current file |
| `Cmd+Shift+N` | New file |
| `Cmd+Shift+S` | AI summarize |
| `Cmd+Shift+F` | Focus mode |
| `Cmd+/` | AI writing tools (editor) |
| `/` | Focus search bar |
| `?` | Keyboard shortcuts help |
| `Tab` | Indent 2 spaces (editor) |
| `Esc` | Close any panel / cancel |

---

## AI Features

AI features require at least one free API key. Open **⚙ Settings** (gear icon in sidebar footer) to add keys. The app tries each provider in order and falls back automatically if one is rate-limited.

### Provider priority (fastest/most generous first)

| Provider | Free tier | Get key |
|----------|-----------|---------|
| **Groq** | 6,000 req/day, very fast | [console.groq.com/keys](https://console.groq.com/keys) |
| **Cerebras** | Free, ultra-fast | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Together** | Free $5 credit | [api.together.ai](https://api.together.ai/settings/api-keys) |
| **OpenRouter** | Many free models | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Gemini** | 1M tokens/day free | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

### AI Document Chat (`Ask AI` button)
Chat with your document in a side panel. Asks are grounded in the file content — the AI can only answer from what's actually in the document. Conversation history builds per-file session. Five quick starter prompts appear on first open.

### AI Summarize (`Summarize` button or `Cmd+Shift+S`)
Generates a structured summary in seconds:
- **TL;DR** — 2-3 sentence overview
- **Key Points** — 5-8 bullet takeaways
- **Key Terms** — definitions of important terms

Runs classification in parallel to tag the file with category (Technical/Business/etc.), complexity level, and sentiment. Tags appear in the file metadata bar. Summary can be saved as a separate `.md` file.

### AI Writing Tools (`Cmd+/` in editor)
Select any text in the editor → a floating toolbar appears:

| Tool | What it does |
|------|-------------|
| ✨ Improve writing | Better flow and clarity, same meaning |
| 📖 Simplify | 7th-grade reading level, clearer structure |
| 📝 Expand | Add detail and examples (2-3x longer) |
| ✂️ Shorten | Remove redundancy, keep all key points |
| 🔤 Fix grammar | Spelling, grammar, punctuation |
| 👔 Make formal | Business/academic tone |
| 😊 Make casual | Friendly conversational tone |
| • Convert to bullets | Structured bullet list |
| 📊 Convert to table | GFM markdown table |
| 📋 Summarize | 2-4 sentence summary |
| 🌐 Translate… | Any language (type the target) |

Results preview before applying. `✓ Replace selection` swaps selected text; `✕ Discard` throws it away.

---

## PDF Support

Drop any `.pdf` file into MarkVault. Choose what to do:

### Render mode (default)
PDF.js renders every page to canvas — one continuous scroll with no abrupt page breaks. Zoom in/out with the `＋` / `－` buttons. **Save PDF** exports all canvas pages as embedded JPEG in a self-contained HTML file (fully offline-viewable).

### Convert to Markdown (`To Markdown` button)
Three conversion modes — choose in the modal:

**1. Datalab (recommended)** — [datalab.to](https://www.datalab.to) — purpose-built PDF-to-Markdown engine. Handles complex tables, multi-column layouts, math, and scanned pages with near-perfect accuracy. Uses your own API key (free $5 credit on sign-up). Supports **multiple API keys** — if one account's credits run out, the next key is tried automatically. Output can be Markdown or HTML.

**2. Gemini AI** — Sends raw PDF bytes to Gemini 1.5 Flash. Excellent for text, tables, and math. Free tier (requires Gemini API key).

**3. Algorithm (offline)** — Local text extraction using PDF.js. No API key needed, works offline. Best for simple text-heavy PDFs; complex tables may need manual cleanup.

---

## File Sharing

Share any file with anyone — no account required for recipients.

**Requirements:** Firebase must be connected (sharing uses Firestore to store the token).

### How to share
1. Open a file → click **Share** in the topbar
2. Set expiry (never / 24h / 7 days / 30 days) and view limit (unlimited / 1 / 10 / 100)
3. Click **Generate Link** → copy the URL
4. Optionally click the QR icon to show a scannable QR code

### What the recipient sees
A clean read-only reader with:
- Your rendered Markdown (with syntax highlighting, math, diagrams)
- **Save to my Vault** button — one click copies the file into their own MarkVault
- **Focus mode** button
- A footer linking to MarkVault so they can create their own vault

### Revoking access
Click **Revoke link** in the Share modal — the link stops working immediately (Firestore document marked inactive).

### Manage all links
Click **Manage all links** to see every share you've created with view counts and delete buttons.

---

## Privacy & Security

| What | How it's protected |
|------|-------------------|
| Your files | Stored in `users/{uid}/files/` in Firestore — server-side rules reject any read/write where `uid` doesn't match the signed-in user |
| Share tokens | 36-character cryptographically random hex string — computationally infeasible to guess |
| AI API keys | Stored only in your browser's localStorage — never sent to any server except the AI provider directly |
| Firebase config | Stored in localStorage — safe to expose (it only identifies the project, not grants access) |
| GitHub repo | Contains zero secrets — safe to be public |

---

## Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [marked.js](https://marked.js.org/) | 12.x | GFM Markdown parsing |
| [highlight.js](https://highlightjs.org/) | 11.9 | Syntax highlighting |
| [KaTeX](https://katex.org/) | 0.16 | Math rendering |
| [Mermaid](https://mermaid.js.org/) | 10.9 | Diagram rendering |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.x | XSS sanitization |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 4.4 | PDF rendering & text extraction |
| [Firebase](https://firebase.google.com/) | 10.x | Auth + Firestore real-time DB |
| [QRCode.js](https://github.com/soldair/node-qrcode) | 1.5 | QR code generation |

All loaded via CDN — **no npm, no build step, no Node.js required**.

---

## Project Structure

```
markdown-viewer/
├── index.html          # Single-page app shell
├── manifest.json       # PWA manifest (installable)
├── sw.js               # Service worker (offline support)
├── README.md           # This file
├── css/
│   └── style.css       # Complete design system (dark/light/responsive)
└── js/
    ├── storage.js      # localStorage + Firebase Auth + Firestore
    ├── renderer.js     # Markdown pipeline (marked, hljs, KaTeX, Mermaid)
    ├── sharing.js      # Private share links, Focus mode, Reading progress
    ├── ai.js           # Multi-provider AI router + chat, summarize, writing tools
    ├── templates.js    # File templates (Meeting notes, README, etc.)
    ├── pdfhandler.js   # PDF render + Datalab/Gemini/algorithm conversion
    └── app.js          # Application controller (all UI, events, state)
```

---

## Firestore Security Rules

After Firebase test mode expires (30 days), paste these rules in **Firestore → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Each user can only read/write their own files
    match /users/{uid}/files/{fileId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }

    // Share links: anyone can read (recipients don't need accounts)
    // Only authenticated users can create/revoke
    match /mv_shared_links/{token} {
      allow read:  if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Cost

Everything runs on free tiers:

| Service | Free limit | Cost after |
|---------|-----------|------------|
| GitHub Pages | Unlimited | Always free |
| Firebase Auth | 10k sign-ins/month | Free for personal use |
| Firestore | 1 GB, 50k reads/day, 20k writes/day | ~$0.18/GB after |
| AI APIs | See provider table above | Pay-as-you-go |
| Datalab PDF | $5 free credit | ~$0.01-0.03/page |

**Typical personal use: $0/month indefinitely.**

---

*Fonts: Syne + DM Sans + JetBrains Mono via Google Fonts*