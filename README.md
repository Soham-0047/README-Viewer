# MarkVault v2 ◈ — Cross-Device Markdown Viewer

A production-ready, feature-rich Markdown viewer with **Firebase Firestore sync**, **KaTeX math**, **Mermaid diagrams**, and a fully **mobile-responsive** layout. Deploy on GitHub Pages for free — zero build step, zero server.

---

## ✨ What's New in v2

| Feature | v1 | v2 |
|---------|----|----|
| Cross-device sync | ❌ Local only | ✅ Firebase Firestore |
| Real-time updates | ❌ | ✅ Live listener |
| Mobile layout | Basic | ✅ Bottom nav, full responsive |
| Mermaid diagrams | Basic | ✅ All types + theming |
| KaTeX math | ✅ | ✅ Improved extraction |
| GitHub callouts | ❌ | ✅ `[!NOTE]` `[!TIP]` etc. |
| Image lightbox | ❌ | ✅ |
| Tab key in editor | ❌ | ✅ Inserts 2 spaces |
| External link icons | ❌ | ✅ |
| Auto-language detect | ❌ | ✅ hljs.highlightAuto |

---

## 🚀 Quick Start

### 1. Open Locally (no server needed)
```bash
open index.html   # macOS
start index.html  # Windows
xdg-open index.html  # Linux
```

### 2. Deploy to GitHub Pages (free)
1. Create a new GitHub repo
2. Upload all files (keep folder structure)
3. **Settings → Pages → Source → main branch / root**
4. Live at `https://yourusername.github.io/your-repo/`

### 3. Local dev server (optional)
```bash
npx serve .          # Node.js
python -m http.server 8080   # Python
# visit http://localhost:8080
```

---

## ☁ Cloud Sync Setup (Firebase — Free)

This takes about **3 minutes** and makes your files available on every device.

### Step-by-step

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `markvault`) → Continue
3. Disable Google Analytics if you want (optional) → **Create project**
4. Click **`</>`** (Web) → Register app → copy the `firebaseConfig` block
5. In the left sidebar: **Build → Firestore Database → Create database**
   - Choose a region close to you
   - Start in **test mode** (allows all reads/writes for 30 days)
   - Click **Enable**
6. Back in MarkVault, click the **☁ cloud icon** in the sidebar
7. Paste your config JSON and click **Connect & Sync**

### Firestore security rules (after 30 days)

After test mode expires, add these rules in **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read/write — safe for personal use
    // Add Firebase Auth for multi-user security
    match /markvault_files/{docId} {
      allow read, write: if true;
    }
  }
}
```

For a private setup, enable **Firebase Authentication** (Anonymous or Google) and scope rules to `request.auth != null`.

### How sync works

```
Write  →  localStorage (instant, offline)
           ↓ async
        Firestore (all connected devices)
           ↓ real-time
        Other browsers/devices update live
```

- **Latest-wins** strategy: whichever copy has the newer `updatedAt` timestamp is kept
- **Offline support**: all writes go to localStorage first, sync to cloud when online
- **Merge on connect**: when you first connect Firebase, all existing local files are pushed up

---

## 📁 Project Structure

```
markdown-viewer/
├── index.html          # Single-page app
├── README.md
├── css/
│   └── style.css       # Full design system (dark + light + responsive)
└── js/
    ├── storage.js      # localStorage + Firebase dual-layer
    ├── renderer.js     # Markdown pipeline (marked, hljs, KaTeX, Mermaid)
    └── app.js          # UI controller (all interactions, sync, mobile)
```

---

## 🛠 Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [marked.js](https://marked.js.org/) | 12.x | GFM Markdown parser |
| [highlight.js](https://highlightjs.org/) | 11.9 | Syntax highlighting (200+ langs) |
| [KaTeX](https://katex.org/) | 0.16 | LaTeX math rendering |
| [Mermaid](https://mermaid.js.org/) | 10.9 | Diagrams (flow, sequence, gantt…) |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.x | XSS sanitization |
| [Firebase](https://firebase.google.com/) | 10.x | Firestore real-time database |

All via CDN — **no npm, no build step**.

---

## 📱 Responsive Breakpoints

| Width | Layout |
|-------|--------|
| > 900px | Sidebar always visible |
| 640–900px | Sidebar visible, compact pills |
| ≤ 640px | Sidebar slides over content, **bottom navigation bar** |

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save (editor) |
| `Ctrl+E` | Open editor |
| `Ctrl+Shift+N` | New file |
| `/` | Focus search |
| `Tab` | Insert 2 spaces (editor) |
| `Esc` | Close panels / cancel |

---

## 💾 Storage Architecture

```
┌─────────────────────────────────┐
│          localStorage            │  ← Always, instant, offline
│  MV2_index     → file metadata  │
│  MV2_file_{id} → file content   │
│  MV2_prefs     → theme, lastId  │
│  MV2_firebase_config → config   │
└─────────────────────────────────┘
          ↕ (when connected)
┌─────────────────────────────────┐
│     Firebase Firestore           │  ← Cross-device, real-time
│  markvault_files/{id}           │
│    → all file fields + content  │
└─────────────────────────────────┘
```

---

## 📝 Markdown Features

- **GFM**: tables, task lists, strikethrough, autolinks
- **Code**: fenced blocks with language labels + copy button
- **Math**: `$inline$` and `$$display$$` (KaTeX)
- **Diagrams**: ` ```mermaid ``` ` blocks
- **Callouts**: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`
- **Images**: lazy loading + lightbox zoom
- **Links**: external links open in new tab with icon
- **Headings**: anchor links for deep linking
- **Smart typography**: `--` → em dash, `...` → ellipsis

---

## 💰 Cost

Everything in the free tier:
- **GitHub Pages**: free forever
- **Firebase Firestore**: free up to 1 GB storage, 50k reads/day, 20k writes/day
- **CDN libraries**: free
- **Total**: $0

---

*Fonts: Syne + DM Sans + JetBrains Mono via Google Fonts*
