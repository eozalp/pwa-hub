# 🚀 PWA Hub — HTML → Installable App

> Turn any self-contained HTML file into a fully installable Progressive Web App (PWA).  
> No build tools. No backend. No dependencies. Works offline. Forever.

---

## ✨ Overview

**PWA Hub** is a single-file, client-side tool that transforms standalone HTML files into installable apps using modern browser capabilities:

- 📦 Converts `.html` → installable PWA  
- 💾 Stores apps in **IndexedDB**  
- ⚡ Uses **Service Worker** for routing & offline support  
- 📱 Supports **multi-app install (per unique scope)**  
- 🔌 Works on any static hosting (GitHub Pages, Netlify, etc.)  
- 📴 Fully offline after initial load  

---

## 🧠 Core Concept

PWA Hub acts as a **runtime + app container**:

HTML File → Injected Meta + Manifest → Stored in IndexedDB → Served via Service Worker → Installed as PWA

Each app is mapped to:

/app/{slug}/

This ensures:
- Unique scope per app  
- Independent installability  
- Isolation between apps  

---

## 🔥 Features

### 🧩 App Creation
- Drag & drop any `.html`  
- Auto-detect `<title>`  
- Configure:
  - Name / Short name  
  - Display mode  
  - Orientation  
  - Icon (emoji or generated)  

### 📲 Installable Apps
- Native install prompt (Chrome-based browsers)  
- Per-app install button injected  
- Works like real apps (standalone mode)  

### 💾 Storage Engine
- IndexedDB-based persistence  
- Fallback to in-memory (for `file://`)  
- Stores:
  - HTML payload  
  - Metadata  
  - Icons  

### ⚙️ Service Worker Engine
- Dynamic routing:
  - `/app/{slug}/` → serves app HTML  
  - `/app/{slug}/manifest.json` → generated manifest  
- Offline caching  
- Font caching  
- SPA fallback handling  

### 📦 App Management
- Installed apps list  
- Search/filter  
- Export / import:
  - `.pwahub` bundle  
  - JSON  
- Bundle all apps into a single HTML  

### 🌍 Platform Support
Built-in deployment guides for:
- GitHub Pages  
- Netlify  
- Cloudflare Pages  
- Vercel  
- Apache  
- Nginx  
- Generic static hosts  

---

## 🛠️ Setup

### 1. Minimal Setup

Upload these files to your hosting:

/index.html   (or pwa-hub.html) /sw.js

---

### 2. Required: SPA Routing

You MUST route:

/app/*

→ back to your main HTML file.

#### Examples:

##### GitHub Pages
- Add `404.html` fallback  

##### Netlify / Cloudflare

/*    /index.html   200

##### Vercel
```json
{
  "routes": [
    { "src": "/app/(.*)", "dest": "/index.html" }
  ]
}

Nginx

location /app/ {
  try_files $uri /index.html;
}


---

🚀 Usage

1. Open PWA Hub

In browser (served over HTTPS)

2. Drop HTML File

Must be self-contained

No external dependencies (recommended)


3. Configure App

Name

Icon

Display mode


4. Generate

Stored in browser

URL created:


/app/{slug}/

5. Install

Click Install App

Or browser menu → Add to Home Screen



---

🧬 Architecture

📁 Storage Model

{
  slug: string,
  name: string,
  shortName: string,
  displayMode: string,
  orientation: string,
  appUrl: string,
  icon: base64,
  html: string,
  size: number,
  created: timestamp
}


---

🔁 Routing Flow

User visits /app/my-app/

→ Service Worker intercepts
→ Loads app from IndexedDB
→ Returns HTML response


---

📄 Dynamic Manifest

Each app gets:

/app/{slug}/manifest.json

Generated on-the-fly by Service Worker.


---

⚙️ Install Mechanism

Each app injects:

beforeinstallprompt → captured → custom install button

Ensures:

Independent install per app

No hub interference



---

⚠️ Limitations

🔒 Browser Constraints

Requires HTTPS (except localhost)

No Service Worker on file://

IndexedDB limits vary per browser


📦 HTML Requirements

Best with self-contained files

External assets may break offline behavior


📱 iOS Notes

No beforeinstallprompt

Manual install via Safari → Share → Add to Home Screen



---

🧪 Tested Environments

Chrome (Android/Desktop) ✅

Edge ✅

Brave ✅

Safari ⚠️ (limited PWA support)

Firefox ⚠️ (no install prompt)



---

📤 Export / Import

Export Formats

.pwahub (recommended)

JSON


Bundle Mode

Combine all apps into a single HTML file

Fully portable



---

🧱 Design Principles

Single file

Zero dependencies

Offline-first

No build step

User-owned data

Browser-native APIs only



---

🛡️ Security Notes

Apps run in same origin

No sandboxing between apps

Only load trusted HTML



---

🧭 Roadmap Ideas

App sandboxing (iframe isolation)

External asset bundling

Cross-device sync

Compression (WASM)

Encrypted payloads



---

🤝 Contributing

1. Fork repository


2. Modify pwa-hub.html


3. Keep it single-file


4. Submit PR




---

📄 License

MIT


---

⚡ Philosophy

> The web is already an app platform.
This just removes the friction.