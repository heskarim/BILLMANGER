# Product Requirements Document (PRD) - Billing Application

## 1. Objective
Build a local, offline desktop-first billing system for company management (specifically tailored for Cloud Pi). The application will generate, log, and print standard invoices, proforma invoices, and delivery notes using a fast, modern SvelteKit frontend and an offline SQLite backend on Windows.

---

## 2. Key Features

### A. Document Templates (Three Types)
1. **Facture (Standard Invoice):** Includes unit prices, quantity, row totals, Subtotal HT, optional TVA (19% or custom), Montant TTC, and spelled-out amount in French words.
2. **Facture Proforma (Proforma Invoice / Quote):** Same calculations and table structure as the Standard Invoice, but prominently titled as "Proforma" for client quotes.
3. **Bon de Livraison (Delivery Note):** Only contains product descriptions, units, and quantities. Unit prices and totals are hidden. Used for shipment packaging.

### B. Company Settings (Cloud Pi Profile)
- Configure seller details in a persistent profile: Company Name, Address, Phone, Email, RC (Registre du Commerce), ART (Article d'imposition), NIF (Numéro d'Identification Fiscale), NIS (Numéro d'Identification Statistique), and RIB (Bank Account / BNA details).
- Save logo to display on bills.

### C. Client & Product Autocomplete Suggestions
- **Client Search:** Automatically suggestions clients based on name. Fills address and code.
- **Product Autocomplete:** In bill items, typing suggestions pulls names, default units, and prices from the catalog database.
- **Auto-Save Catalog:** When saving a bill, any newly entered product or client is automatically saved to the database.

### D. Real-Time Calculations & Spelled-Out French Totals
- Row totals (Price * Quantity) and subtotals compute instantly.
- The `Montant TTC` is converted to formal French words in real-time (*"Facture arrêtée à la somme de..."*) for compliance with Algerian invoicing standards.

### E. History Log & Stats Dashboard
- Searchable, filterable list of all generated bills.
- Quick stats: Total invoice count, total revenue, counts by document type.
- Actions: View/Print, Edit, Delete, Duplicate.

### F. A4 Printing & Local Backups
- Browser-based print stylesheets optimized for A4 paper.
- Automatic page numbering, clean pagination, and carryover partial sums ("Report") if invoices span multiple pages.
- Database backup (export/import) to local files.

---

## 3. Technology Stack
- **Frontend:** SvelteKit (TypeScript)
- **Database:** SQLite (Node.js backend adapter)
- **Styling:** Vanilla CSS (Outfit/Inter typography, dark mode UI, light A4 print layouts)

---

## 4. User Experience & Aesthetics
- Sleek, modern dark mode interface with glassmorphism panels, harmonious HSL colors, and smooth micro-animations.
- Desktop-first responsive layout (optimized for PC, scaling cleanly).
- Zero loading latency.
