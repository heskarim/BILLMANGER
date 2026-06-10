Status: completed

# Issue 03: Interactive Bill Editor with Autocomplete & French Calculations

## Description
Develop a comprehensive bill creation and editor interface. The interface must support switching between the three document types, autocompleting product and client fields, running total calculations dynamically, and translating totals into French words.

## Tasks
- [x] Build the bill builder page (`src/routes/bills/new/+page.svelte` and `src/routes/bills/[id]/edit/+page.svelte`).
- [x] Add a document type selector (Facture, Proforma, Delivery Note). Changing type dynamically hides/shows columns (prices and totals are hidden for delivery note).
- [x] Implement Client Auto-Complete: Input with list matching client table. Fills client code and address upon selection.
- [x] Implement Product Auto-Complete: Line item cells that suggest products from the catalog. Selecting a product fills the description, default unit, and default unit price.
- [x] Create a draggable/reorderable table for line items.
- [x] Calculate totals dynamically on change: Item totals, Montant HT, TVA (default 19%, customizable or toggleable to 0% for exemptions), and Montant TTC.
- [x] Integrate the French spelling translation utility (`src/lib/utils/frenchWords.ts`) to display the written total in real-time.
- [x] Connect the form submit to database actions:
  - Save bill and bill items to `bills` and `bill_items` tables.
  - Automatically save any new product or client entered to the product/client tables so they appear in future suggestions.

## Comments
- Autocomplete lookup should be case-insensitive and match on keywords.
- **Verification:** Completed the interactive billing wizard. Includes real-time client autocomplete and product catalog auto-filling. Spells numeric values out in French Dinars automatically (e.g. `2792800 -> Deux millions sept cent...`). Auto-saves new catalog items on submit.

