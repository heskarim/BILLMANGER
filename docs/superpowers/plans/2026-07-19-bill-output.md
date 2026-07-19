# Bill Output Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long bill editing, single-bill XLSX exports, and browser print/PDF output match the supplied document-shaped reference.

**Architecture:** Keep bill data and server routes as the source of truth. Add a small shared export-layout module for page chunking and cell/style helpers, then use it from the single-bill XLSX endpoint. Keep the existing HTML print renderer but make its page geometry and print CSS explicit. Make the line-item header sticky without changing form state or submission format.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, `xlsx`, better-sqlite3, CSS `@media print`, Chrome browser verification.

## Global Constraints

- Preserve the existing bill types: `facture`, `proforma`, and `livraison`.
- Delivery-note exports omit price and total columns like the supplied example.
- Invoice and proforma exports include unit price, line total, TVA, totals, amount in words, and stamp area.
- Numeric spreadsheet values remain numeric; display formatting must not convert amounts into strings.
- Optional company, client, contract, and notes fields must render as empty placeholders rather than throwing.
- Do not add dependencies unless the current `xlsx` package cannot express the required workbook features.
- Do not add `.pi/`, `.vibeyardignore`, or `Projectkarim/` to the application commit.

---

### Task 1: Add sticky line-item action

**Files:**
- Modify: `src/routes/bills/new/+page.svelte` around the `.items-header` markup and component `<style>` block.
- Modify: `src/routes/bills/[id]/edit/+page.svelte` around the matching `.items-header` markup and component `<style>` block.

**Interfaces:**
- Consumes: existing `addRow()` handlers and item table markup.
- Produces: a `.items-header` that remains visible while the page is scrolled and remains accessible on narrow screens.

- [ ] **Step 1: Add the sticky class to both item headers**

Use the existing header markup and add a semantic class without changing the button handler:

```svelte
<div class="items-header items-header-sticky">
  <h3 class="section-title">Line Items</h3>
  <button type="button" class="btn btn-secondary btn-sm" onclick={addRow}>
    <Plus size={16} />
    <span>Add Row</span>
  </button>
</div>
```

Apply the same class in `src/routes/bills/[id]/edit/+page.svelte`.

- [ ] **Step 2: Add responsive sticky CSS**

Add this CSS to both component style blocks, adapting only existing local variable names if needed:

```css
.items-header-sticky {
  position: sticky;
  top: 0.75rem;
  z-index: 20;
  margin: calc(-1 * var(--space-5)) calc(-1 * var(--space-5)) var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: color-mix(in srgb, var(--bg-card) 94%, transparent);
  border-bottom: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

@media (max-width: 700px) {
  .items-header-sticky {
    top: 0.5rem;
    margin-left: calc(-1 * var(--space-3));
    margin-right: calc(-1 * var(--space-3));
    padding-left: var(--space-3);
    padding-right: var(--space-3);
  }

  .items-header-sticky .btn {
    min-height: 2.5rem;
  }
}
```

- [ ] **Step 3: Check the sticky behavior in Chrome**

Run `npm run check`, open `/bills/new`, add enough rows to create page scrolling, scroll past the line-item table, and verify the header/button remains visible. Focus a product field and verify autocomplete remains above the table.

- [ ] **Step 4: Commit the isolated UI change**

```bash
git add src/routes/bills/new/+page.svelte 'src/routes/bills/[id]/edit/+page.svelte'
git commit -m "feat: keep add row action visible in long bill forms"
```

---

### Task 2: Create shared XLSX layout helpers

**Files:**
- Create: `src/lib/server/bill-export.ts`.
- Test manually with: `scripts/inspect-bill-export.ts`.

**Interfaces:**
- Consumes: bill/settings/item types from `src/lib/server/db.ts`.
- Produces: `partitionBillItems(items, type)` and `buildSingleBillWorkbook({ bill, items, settings })`.

- [ ] **Step 1: Define the export types and constants**

Create a module with these exported signatures:

```ts
export type BillDocumentType = 'facture' | 'proforma' | 'livraison';

export interface BillExportInput {
  bill: Bill;
  items: BillItem[];
  settings: SellerSettings;
}

export function partitionBillItems(
  items: BillItem[],
  type: BillDocumentType,
): BillItem[][];

export function buildSingleBillWorkbook(input: BillExportInput): XLSX.WorkBook;
```

Use the existing print chunk capacities as the starting point, but make delivery-note and financial-document columns explicit. Preserve global item numbering across chunks.

- [ ] **Step 2: Add value and cell-style helpers**

Implement helpers for:

```ts
function formatDate(value: string | null | undefined): string;
function setCell(ws: XLSX.WorkSheet, address: string, value: string | number): void;
function merge(ws: XLSX.WorkSheet, start: string, end: string): void;
function applyBorder(ws: XLSX.WorkSheet, range: string): void;
function applyRowStyle(ws: XLSX.WorkSheet, row: number, lastColumn: number): void;
```

Use numeric cell values for quantities and amounts. Use `z`/`numFmt` style metadata where supported by the installed `xlsx` version, with `#,##0.00` for financial amounts and `0.####` for quantities.

- [ ] **Step 3: Build the delivery-note workbook layout**

For each page chunk, write a document-shaped block matching the reference:

```text
B1:F1 company name
B2:F2 address
B3:F3 phone/email
B4:C4 RC + ART
B5:C5 NIF + NIS
B6:F6 RIB
A7:F7 document title + number
A8:F8 date + contract number/date
A9:F11 client code/name/address
A13:F13 page indicator
A14:E14 item headings (delivery note: N°, Produit, Unité, Qté.)
A15:E<n> item rows
```

Merge header blocks, wrap long descriptions, set row heights based on description length, set column widths matching the example, and add borders to metadata/table regions.

- [ ] **Step 4: Build invoice/proforma workbook layout**

Use the same metadata/header block, but use the financial table columns:

```text
N° | Désignation / Produit | Unité | P.U. | Qté. | Total
```

After the final page, add amount-in-words, Montant HT, TVA when applicable, Montant TTC, and stamp/signature space. Keep the values numeric in amount cells.

- [ ] **Step 5: Configure worksheet print settings**

For every generated page block, configure column widths, freeze the item heading row when meaningful, `!printHeader`, `!margins`, `!pageSetup` for A4 portrait, and explicit row breaks/page breaks if supported by the library. Do not rely on Excel’s automatic scaling for long descriptions.

- [ ] **Step 6: Add a manual workbook inspector**

Create `scripts/inspect-bill-export.ts` that loads an exported workbook and prints sheet names, `!ref`, merges, key row values, `!cols`, and page setup. This is a verification script only and must not alter production data.

- [ ] **Step 7: Commit the helper module and inspector**

```bash
git add src/lib/server/bill-export.ts scripts/inspect-bill-export.ts
git commit -m "feat: add document-shaped bill workbook layout"
```

---

### Task 3: Wire the single-bill XLSX route to the reference layout

**Files:**
- Modify: `src/routes/api/bills/[id]/export/+server.ts`.
- Modify: `src/routes/api/bills/export/+server.ts` only for formatting/filter/freeze improvements.

**Interfaces:**
- Consumes: `buildSingleBillWorkbook()` from `src/lib/server/bill-export.ts`.
- Produces: valid `.xlsx` downloads with the existing response content type and filenames.

- [ ] **Step 1: Replace the raw single-bill AOA builder**

Keep ID validation, 404 handling, `getBillById()`, `getSettings()`, and response headers. Replace the current `aoa`/`aoa_to_sheet` block with:

```ts
const workbook = buildSingleBillWorkbook({ bill, items, settings });
const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
```

Remove unused `TYPE_LABEL`, `fmtDate`, and `fmtNumber` functions from that route after the replacement.

- [ ] **Step 2: Improve the all-bills workbook without changing its purpose**

Keep `Lignes` and `Résumé` as filter-friendly sheets. Add `!autofilter` to each header range, apply number formats to quantity/amount columns, normalize `created_at` into a readable date/time value, and preserve freeze panes. Do not turn this route into the document-shaped single-bill layout.

- [ ] **Step 3: Verify generated files against the provided example**

Run the dev server and download a delivery-note export and a financial-document export. Run:

```bash
node scripts/inspect-bill-export.ts /tmp/delivery.xlsx
node scripts/inspect-bill-export.ts /tmp/invoice.xlsx
file /tmp/delivery.xlsx /tmp/invoice.xlsx
```

Expected: both files identify as Microsoft Excel 2007+, delivery sheets contain the reference metadata/table structure without financial columns, and invoice sheets contain numeric financial columns/totals.

- [ ] **Step 4: Commit the route wiring**

```bash
git add 'src/routes/api/bills/[id]/export/+server.ts' 'src/routes/api/bills/export/+server.ts'
git commit -m "fix: export bills as formatted document workbooks"
```

---

### Task 4: Fix A4 print geometry and pagination

**Files:**
- Modify: `src/routes/bills/[id]/+page.svelte`.

**Interfaces:**
- Consumes: current `printBundle`, `partitionItems`, bill data, and rendered document blocks.
- Produces: stable A4 pages for all three document types and bundles.

- [ ] **Step 1: Make pagination capacities type-specific and conservative**

Replace the current mixed capacity logic with one function that reserves the final footer/signature area on the last page. Keep the page-size decisions in one place, and ensure a chunk never depends on the screen viewport. Use a conservative initial capacity, then validate visually in Chrome; do not increase capacity merely to fit more rows if it causes overflow.

- [ ] **Step 2: Fix global item numbering and carryovers**

Compute a `startIndex` for each page from previous chunk lengths and use it for the item number. Carryover/partial rows must use a correct `colspan` for both delivery and financial tables. Verify the final page contains totals/signatures only once per selected document type.

- [ ] **Step 3: Remove screen-only print hazards**

Update print CSS so:

```css
@media print {
  @page { size: A4 portrait; margin: 0; }
  :global(html), :global(body) { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .print-container { display: block !important; max-width: none !important; margin: 0 !important; }
  .a4-page { width: 210mm !important; height: 297mm !important; min-height: 297mm !important; margin: 0 !important; padding: 18mm 20mm !important; overflow: hidden !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; break-inside: avoid !important; }
  .page-break { display: none !important; }
  .no-print, .actions-bar { display: none !important; }
  table, tr, img { break-inside: avoid !important; }
}
```

Keep screen styling separate from print geometry. Avoid a `gap` on the printed wrapper creating extra page height.

- [ ] **Step 4: Verify print output in Chrome**

Open a bill with enough rows for multiple pages, inspect the page in print media, and invoke the browser print preview. Verify:

- one printed A4 sheet per generated `.a4-page`
- no blank page between generated pages
- no controls in the print output
- no clipped footer, totals, notes, or signatures
- bundle selection creates one sequence per selected document

- [ ] **Step 5: Commit the print fix**

```bash
git add 'src/routes/bills/[id]/+page.svelte'
git commit -m "fix: stabilize A4 bill printing and pagination"
```

---

### Task 5: Full verification and publish

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-bill-output-design.md` only if verification discovers a design correction.
- Modify: no app files unless a verification failure requires a focused fix.

- [ ] **Step 1: Run static checks**

```bash
npm run check
npm run build
```

Expected: build succeeds and `svelte-check` reports no errors.

- [ ] **Step 2: Verify export response contracts**

For a known bill ID:

```bash
curl -f -D /tmp/bill-export.headers -o /tmp/bill-export.xlsx http://127.0.0.1:5173/api/bills/1/export
file /tmp/bill-export.xlsx
```

Expected: HTTP 200, XLSX content type, attachment filename, and Microsoft Excel 2007+ file type.

- [ ] **Step 3: Verify the app in Chrome**

Check `/bills/new`, `/bills/<id>/edit`, `/bills/<id>`, and `/`. Confirm sticky Add Row, export links, print controls, and no console errors.

- [ ] **Step 4: Commit docs and final changes**

```bash
git add docs/superpowers/specs/2026-07-19-bill-output-design.md docs/superpowers/plans/2026-07-19-bill-output.md
git commit -m "docs: specify bill output improvements"
```

- [ ] **Step 5: Push main**

```bash
git push github main
```

Expected: `main` is up to date on `https://github.com/heskarim/BILLMANGER`.
