# Project Memory & Context

This file serves as the persistent memory and knowledge sync for this workspace.

> [!IMPORTANT]
> **Update Policy:** The agent must only modify or update this file when explicitly instructed by the user. Do not perform automatic syncs on every turn.

---

## 1. Project Overview & Scope
*   **Goal:** Build a local, offline Billing and Company Management Application to generate, print, and log three types of billing documents: Standard Invoice (*Facture*), Proforma Invoice (*Facture Proforma*), and Delivery Note (*Bon de Livraison*).
*   **Target Audience / Monetization:** Internal company tool for Cloud Pi management.
*   **Tech Stack:**
    *   **Frontend:** Svelte / SvelteKit (TypeScript)
    *   **Backend / Database:** Local SQLite database file (`billing.db`) running offline on Windows via Node.js server.
    *   **Hosting/Tools:** Executed locally (accessed via localhost browser), print-to-PDF styles for document saving.

---

## 2. Architectural Decisions & Conventions
*   **State Management:** Svelte pages and reactive page layout.
*   **Database Integration:** Local SQLite using Node backend. Fallback to pure-JS JSON-file database if C++ bindings fail to compile on Windows.
*   **Print Layouts:** Pure CSS `@media print` styling to perfectly replicate the A4 pages of the provided Excel/PDF templates.
*   **Local Issue Tracker:** Track progress using scoped markdown files under `.scratch/billing-app/issues/` and a central `PRD.md` with standard status labels (`needs-triage`, `ready-for-agent`, etc.).

---

## 3. Current Goals & Roadmap
- [ ] **Milestone 1: Project Setup & Issue Tracker**
    - [ ] Initialize local issue tracker (`.scratch/billing-app/PRD.md` and issues 01-05).
    - [ ] Create initial SvelteKit project template.
- [ ] **Milestone 2: Database Setup & Schema Integration**
    - [ ] Configure SQLite database connections and initialize tables (`settings`, `clients`, `products`, `bills`, `bill_items`).
- [ ] **Milestone 3: Seller Settings & Auto-Fill Catalogs**
    - [ ] Develop company settings UI.
    - [ ] Set up auto-saving and autocomplete suggestions for clients and products.
- [ ] **Milestone 4: Bill Editor & Calculations Engine**
    - [ ] Build interactive builder for Facture/Proforma/Livraison.
    - [ ] Implement automatic total computations and French word amount translation.
- [ ] **Milestone 5: Print Template & PDF Save**
    - [ ] Develop print stylesheet mimicking A4 pages.
- [ ] **Milestone 6: Dashboard Log & Operations**
    - [ ] Create the dashboard tables, stats, and SQLite backups.

---

## 4. Key Learnings & Debugging Notes
*   **Excel/PDF layout matches:** Delivery note (*Bon de livraison*) has no prices (only Name, Unit, Quantity), whereas Invoices (*Facture* and *Proforma*) have full pricing columns and French sums.
*   **Local Env:** Node version: v25.9.0, Python version: 3.13.2.

---

## 5. User Preferences & Things to Avoid
*   **Do's:**
    *   Maintain the local markdown issue tracker under `.scratch/billing-app/`.
    *   Maintain clean HSL Hues and glassmorphism styling for screens, and paper-white clean layout for printing.
*   **Don'ts:**
    *   Do not update `memory.md` unless explicitly requested by the user.
    *   Avoid complex external cloud databases; run strictly offline on SQLite.
