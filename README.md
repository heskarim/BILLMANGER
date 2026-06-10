# 🧾 BillManager — Billing System

A professional billing application for generating **Factures**, **Factures Proforma**, and **Bons de Livraison** — built with SvelteKit and a local SQLite database. No cloud required, works 100% offline.

---

## ✨ Features

| Feature | Details |
|---|---|
| 📄 **3 document types** | Facture, Facture Proforma, Bon de Livraison |
| 🔢 **Auto-numbering** | Sequential bill numbers per year (e.g. `2026-0001`) |
| 👤 **Client catalog** | Auto-saved from bills, searchable with autocomplete |
| 📦 **Product catalog** | Auto-saved from bills, with unit prices |
| 👁️ **Live A4 Preview** | Side-by-side paper preview while you type |
| 🖨️ **Print / PDF export** | One-click browser print to A4 PDF |
| ⚙️ **Company settings** | Logo, address, RC, NIF, NIS, RIB, etc. |
| 💾 **Local SQLite DB** | All data stored in `billing.db` at the project root |

---

## 🖥️ Requirements

Before starting, install these **once** on any PC:

| Tool | Version | Download |
|---|---|---|
| **Node.js** | v18 or newer | https://nodejs.org (choose "LTS") |
| **Git** | Any | https://git-scm.com *(optional, if cloning)* |

> **Check if already installed** — open a terminal and run:
> ```
> node --version
> npm --version
> ```
> If both print a version number, you're good to go.

---

## 🚀 How to Launch on Any PC

### Step 1 — Get the project files

**Option A — Copy the folder** (simplest):
```
Copy the entire BILLING folder to the new PC (USB, shared drive, etc.)
```

**Option B — Clone from Git** (if using version control):
```bash
git clone <your-repo-url> BILLING
```

---

### Step 2 — Open a terminal in the project folder

- **Windows**: Right-click the `BILLING` folder → *Open in Terminal* (or PowerShell)
- **Mac/Linux**: `cd /path/to/BILLING`

---

### Step 3 — Install dependencies

Run this **once** per machine (downloads all packages into `node_modules/`):

```bash
npm install
```

> ⏳ This takes 1–2 minutes the first time. You need an internet connection for this step.

---

### Step 4 — Start the app

```bash
npm run dev
```

You will see output like:

```
  VITE v6.x.x  ready in 800 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.x:5173/
```

---

### Step 5 — Open in your browser

Go to: **http://localhost:5173**

The app is running locally. No internet needed after installation.

---

## 📋 First-Time Setup

### 1. Configure your company settings

Go to **⚙️ Settings** in the sidebar and fill in:

- Company name, address, phone, email
- RC (Registre de Commerce)
- NIF, NIS, ART numbers
- RIB (bank account)
- Company logo (optional, upload image)

> These appear on every printed document.

### 2. (Optional) Load the demo bill with 25 items

Run this once to populate the database with example data:

```bash
npm run seed:demo
```

This creates:
- ✅ 1 demo client (USTHB University)
- ✅ 25 lab/tech products in the catalog
- ✅ 1 complete 25-item Facture (~6.6M DA)

Then open: **http://localhost:5173** to see it.

---

## 📁 Project Structure

```
BILLING/
├── billing.db          ← Your data (SQLite, auto-created on first run)
├── src/
│   ├── routes/
│   │   ├── +page.svelte          ← Dashboard / bills list
│   │   ├── bills/
│   │   │   ├── new/              ← Create a new bill
│   │   │   └── [id]/
│   │   │       ├── +page.svelte  ← View / print a bill
│   │   │       └── edit/         ← Edit a bill
│   │   ├── clients/              ← Client catalog management
│   │   ├── products/             ← Product catalog management
│   │   └── settings/             ← Company profile
│   └── lib/server/
│       └── db.ts                 ← All database queries (SQLite)
├── scripts/
│   └── seed-example-bill.ts      ← Demo data generator
└── package.json
```

---

## 🛠️ Available Commands

| Command | What it does |
|---|---|
| `npm install` | Install all dependencies (run once per machine) |
| `npm run dev` | Start the app in development mode |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run seed:demo` | Insert a 25-item example bill into the database |

---

## 🖨️ How to Print / Export as PDF

1. Open any bill → click **Print / Export PDF**
2. In the browser print dialog:
   - Set **Paper size** to **A4**
   - Enable **"Print backgrounds"** (so the header colours print correctly)
   - Set **Margins** to **None** or **Minimum**
   - Save as PDF

---

## 💾 Backup Your Data

Your data lives entirely in one file:

```
billing.db
```

**To back up**: copy `billing.db` anywhere (USB, cloud storage, email to yourself).

**To restore**: paste `billing.db` back into the project root and restart the app.

---

## 🔄 Moving to a New PC — Quick Summary

```
1. Copy the BILLING folder to the new PC
2. Install Node.js from https://nodejs.org  (if not installed)
3. Open terminal in the BILLING folder
4. npm install
5. npm run dev
6. Open http://localhost:5173
```

> ⚡ **Your data (`billing.db`) moves with the folder** — no migration needed.

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| `npm: command not found` | Install Node.js from https://nodejs.org |
| Port 5173 already in use | Run `npm run dev -- --port 3000` to use a different port |
| Blank page / errors | Delete `.svelte-kit/` folder and run `npm run dev` again |
| Lost all data | Restore your `billing.db` backup |
| App is slow | Normal on first load — subsequent loads are fast |

---

## 📞 Tech Stack

- **Frontend**: SvelteKit 5 + Svelte 5 (runes)
- **Database**: SQLite via `better-sqlite3` (local file, zero config)
- **Icons**: Lucide Svelte
- **Styling**: Vanilla CSS with CSS custom properties

---

*Built for offline use — no accounts, no subscriptions, no cloud.*
