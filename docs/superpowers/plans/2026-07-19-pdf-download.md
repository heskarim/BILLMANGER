# Direct PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct saved-type and full-bundle PDF downloads to every dashboard bill row and the individual bill page.

**Architecture:** Create a dedicated, control-free internal PDF rendering route that reuses the existing A4 bill document rules, then expose a server endpoint that opens that route in headless Chromium and returns its print output as an attachment. Both requested UI locations link to the same endpoint with explicit `saved` or `bundle` modes.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Playwright Chromium, existing SQLite bill repository and A4 print CSS.

## Global Constraints

- Preserve the existing browser Print/PDF action and XLSX exports.
- Saved mode renders only the persisted bill type.
- Bundle mode renders invoice, proforma, and delivery-note copies in that order.
- Delivery notes omit price and financial-total columns.
- Responses must use `application/pdf`, attachment disposition, and `Cache-Control: no-store`.
- Structural validation alone is insufficient; visually inspect downloaded saved-type and bundle PDFs.
- Keep `.pi/`, `.vibeyardignore`, and `Projectkarim/` out of Git.

---

### Task 1: Extract a reusable printable bill component

**Files:**
- Create: `src/lib/components/BillPrintDocument.svelte`
- Modify: `src/routes/bills/[id]/+page.svelte`

**Interfaces:**
- Consumes: `bill`, `items`, `settings`, and `documentTypes: ('facture' | 'proforma' | 'livraison')[]`.
- Produces: a reusable `<BillPrintDocument>` rendering explicit A4 pages with the existing pagination, carryover, totals, and delivery-note rules.

- [ ] **Step 1: Move the printable wrapper and its document-only helper functions into the component**

Define typed props and retain the current page partitioning logic:

```svelte
<script lang="ts">
  type DocumentType = 'facture' | 'proforma' | 'livraison';

  let {
    bill,
    items,
    settings,
    documentTypes
  }: {
    bill: Record<string, any>;
    items: Array<Record<string, any>>;
    settings: Record<string, any> | null;
    documentTypes: DocumentType[];
  } = $props();

  function partitionItems(itemsList: typeof items, isLivraison: boolean) {
    const firstPageCapacity = isLivraison ? 16 : 11;
    const continuationCapacity = isLivraison ? 23 : 18;
    if (itemsList.length <= firstPageCapacity) return [itemsList];
    const pages = [itemsList.slice(0, firstPageCapacity)];
    for (let index = firstPageCapacity; index < itemsList.length; index += continuationCapacity) {
      pages.push(itemsList.slice(index, index + continuationCapacity));
    }
    return pages;
  }
</script>
```

Move the complete existing `.print-container` markup and print-specific styles without changing calculations or labels.

- [ ] **Step 2: Replace inline print markup on the bill page**

Import and render:

```svelte
<BillPrintDocument
  {bill}
  {items}
  {settings}
  documentTypes={printBundle}
/>
```

Keep the screen action bar, selection state, delete/duplicate forms, and `window.print()` behavior on the page.

- [ ] **Step 3: Verify the refactor did not change browser printing**

Run:

```bash
npm run check
npm run build
```

Expected: check reports zero errors; build succeeds. Open `/bills/1`, use print preview, and confirm the saved-type document still has the same A4 layout.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/BillPrintDocument.svelte 'src/routes/bills/[id]/+page.svelte'
git commit -m "refactor: share printable bill document"
```

---

### Task 2: Add the internal PDF rendering page

**Files:**
- Create: `src/routes/bills/[id]/pdf/+page.server.ts`
- Create: `src/routes/bills/[id]/pdf/+page.svelte`

**Interfaces:**
- Consumes: route parameter `id`, query mode `saved | bundle`, and optional comma-separated bundle `types`.
- Produces: a control-free HTML page with `documentTypes` ready for Chromium PDF rendering.

- [ ] **Step 1: Add server-side bill loading, mode validation, and selected-type parsing**

Use the same database functions as the existing detail loader and canonicalize selected types:

```ts
import { getBillById, getSettings } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ALL_TYPES = ['facture', 'proforma', 'livraison'] as const;
type DocumentType = (typeof ALL_TYPES)[number];

function parseDocumentTypes(
  mode: 'saved' | 'bundle',
  value: string | null,
  savedType: DocumentType
): DocumentType[] {
  if (mode === 'saved') return [savedType];
  if (value === null) return [...ALL_TYPES];
  const selected = new Set(value.split(','));
  const ordered = ALL_TYPES.filter((type) => selected.has(type));
  if (ordered.length === 0) error(400, 'Select at least one document type');
  return ordered;
}

export const load: PageServerLoad = async ({ params, url }) => {
  const mode = url.searchParams.get('mode');
  if (mode !== 'saved' && mode !== 'bundle') error(400, 'Unsupported PDF mode');

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Invalid bill ID');
  const result = getBillById(id);
  if (!result) error(404, 'Bill not found');

  return {
    bill: result.bill,
    items: result.items,
    settings: getSettings(),
    documentTypes: parseDocumentTypes(mode, url.searchParams.get('types'), result.bill.type)
  };
};
```

Move `parseDocumentTypes` to `src/lib/server/pdf-renderer.ts` in Task 3 so the internal route and endpoint share it. Do not introduce a second database connection.

- [ ] **Step 2: Render only the printable component**

```svelte
<script lang="ts">
  import BillPrintDocument from '$lib/components/BillPrintDocument.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>PDF {data.bill.bill_number}</title>
</svelte:head>

<BillPrintDocument
  bill={data.bill}
  items={data.items}
  settings={data.settings}
  documentTypes={data.documentTypes}
/>
```

Add route-level CSS that removes application chrome and ensures each generated page uses the existing A4 geometry.

- [ ] **Step 3: Verify saved and bundle HTML modes**

Run the dev server and check:

```bash
curl -I 'http://127.0.0.1:5173/bills/1/pdf?mode=saved'
curl -I 'http://127.0.0.1:5173/bills/1/pdf?mode=bundle'
curl -I 'http://127.0.0.1:5173/bills/1/pdf?mode=bundle&types=facture,livraison'
curl -I 'http://127.0.0.1:5173/bills/1/pdf?mode=bundle&types=unknown'
curl -I 'http://127.0.0.1:5173/bills/1/pdf?mode=invalid'
```

Expected: `200`, `200`, `200`, `400`, and `400`. Visually confirm saved mode has one type, bundle without `types` has all three, and selected bundle has exactly invoice then delivery note.

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/bills/[id]/pdf/+page.server.ts' 'src/routes/bills/[id]/pdf/+page.svelte'
git commit -m "feat: add internal bill PDF view"
```

---

### Task 3: Implement server-side PDF generation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/server/pdf-renderer.ts`
- Create: `src/lib/server/pdf-renderer.test.ts`
- Create: `src/routes/api/bills/[id]/pdf/+server.ts`

**Interfaces:**
- Produces: `renderPdf(url: string): Promise<Uint8Array>` and `buildPdfFilename(type, billNumber, mode): string`.
- Endpoint: `GET /api/bills/:id/pdf?mode=saved|bundle`.

- [ ] **Step 1: Install Playwright and its Chromium browser**

```bash
npm install playwright
npx playwright install chromium
```

Expected: dependency and a usable Chromium binary are installed without errors.

- [ ] **Step 2: Write failing filename and mode tests**

Use Node's test runner through `tsx`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPdfFilename, parseDocumentTypes, parsePdfMode } from './pdf-renderer';

test('sanitizes saved PDF filenames', () => {
  assert.equal(buildPdfFilename('facture', '2025/0009', 'saved'), 'Facture_2025-0009.pdf');
});

test('uses bundle filename in bundle mode', () => {
  assert.equal(buildPdfFilename('facture', '2025/0009', 'bundle'), 'Bundle_2025-0009.pdf');
});

test('rejects unsupported modes', () => {
  assert.throws(() => parsePdfMode('other'), /Unsupported PDF mode/);
});

test('defaults dashboard bundles to all three document types', () => {
  assert.deepEqual(parseDocumentTypes('bundle', null, 'facture'), ['facture', 'proforma', 'livraison']);
});

test('canonicalizes and de-duplicates selected detail bundle types', () => {
  assert.deepEqual(parseDocumentTypes('bundle', 'livraison,facture,livraison', 'proforma'), ['facture', 'livraison']);
});

test('saved mode ignores selected types', () => {
  assert.deepEqual(parseDocumentTypes('saved', 'livraison', 'proforma'), ['proforma']);
});

test('rejects a bundle with no valid selected type', () => {
  assert.throws(() => parseDocumentTypes('bundle', 'unknown', 'facture'), /Select at least one/);
});
```

- [ ] **Step 3: Run tests and confirm failure**

```bash
npx tsx --test src/lib/server/pdf-renderer.test.ts
```

Expected: FAIL because `pdf-renderer.ts` does not exist.

- [ ] **Step 4: Implement parsing, filenames, and rendering**

```ts
import { chromium } from 'playwright';

export type PdfMode = 'saved' | 'bundle';

export function parsePdfMode(value: string | null): PdfMode {
  if (value === 'saved' || value === 'bundle') return value;
  throw new Error('Unsupported PDF mode');
}

const DOCUMENT_TYPES = ['facture', 'proforma', 'livraison'] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function parseDocumentTypes(
  mode: PdfMode,
  value: string | null,
  savedType: DocumentType
): DocumentType[] {
  if (mode === 'saved') return [savedType];
  if (value === null) return [...DOCUMENT_TYPES];
  const selected = new Set(value.split(','));
  const ordered = DOCUMENT_TYPES.filter((type) => selected.has(type));
  if (ordered.length === 0) throw new Error('Select at least one document type');
  return ordered;
}

export function buildPdfFilename(
  type: 'facture' | 'proforma' | 'livraison',
  billNumber: string,
  mode: PdfMode
): string {
  const safeNumber = billNumber.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const prefix = mode === 'bundle'
    ? 'Bundle'
    : type === 'facture'
      ? 'Facture'
      : type === 'proforma'
        ? 'Proforma'
        : 'Bon-de-Livraison';
  return `${prefix}_${safeNumber}.pdf`;
}

export async function renderPdf(url: string): Promise<Uint8Array> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    return new Uint8Array(buffer);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 5: Make the endpoint load the bill, render, and download**

The handler validates the numeric ID and mode, parses `types` with `parseDocumentTypes`, loads the bill to obtain its type/number, derives the same-origin internal URL, and returns bytes. Preserve selected bundle types in the internal URL:

```ts
const documentTypes = parseDocumentTypes(mode, url.searchParams.get('types'), bill.type);
const renderUrl = new URL(`/bills/${bill.id}/pdf`, url.origin);
renderUrl.searchParams.set('mode', mode);
if (mode === 'bundle') renderUrl.searchParams.set('types', documentTypes.join(','));
const pdf = await renderPdf(renderUrl.toString());

return new Response(pdf, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store'
  }
});
```

Catch mode errors as 400, missing bills as 404, and rendering errors as 500 after logging the underlying exception. Never return partial PDF bytes.

- [ ] **Step 6: Run unit and endpoint checks**

```bash
npx tsx --test src/lib/server/pdf-renderer.test.ts
curl -sS -D /tmp/saved.headers -o /tmp/saved.pdf 'http://127.0.0.1:5173/api/bills/1/pdf?mode=saved'
curl -sS -D /tmp/bundle.headers -o /tmp/bundle.pdf 'http://127.0.0.1:5173/api/bills/1/pdf?mode=bundle'
file /tmp/saved.pdf /tmp/bundle.pdf
grep -iE 'HTTP/|content-type|content-disposition|cache-control' /tmp/saved.headers /tmp/bundle.headers
```

Expected: tests pass; both files are valid PDF documents; both responses are attachments with the required headers.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/server/pdf-renderer.ts src/lib/server/pdf-renderer.test.ts 'src/routes/api/bills/[id]/pdf/+server.ts'
git commit -m "feat: generate downloadable bill PDFs"
```

---

### Task 4: Add both PDF actions to both UI locations

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/bills/[id]/+page.svelte`

**Interfaces:**
- Consumes: `/api/bills/{id}/pdf?mode=saved|bundle` and detail bundle `types`.
- Produces: two accessible PDF download actions on each dashboard row and two labelled actions on bill details.

- [ ] **Step 1: Add dashboard row actions**

Import `FileDown` and `Files` from `@lucide/svelte`, then add:

```svelte
<a
  href="/api/bills/{bill.id}/pdf?mode=saved"
  class="action-btn pdf-btn"
  title="Download saved document as PDF"
  aria-label="Download {bill.bill_number} as PDF"
>
  <FileDown size={15} />
</a>
<a
  href="/api/bills/{bill.id}/pdf?mode=bundle"
  class="action-btn bundle-pdf-btn"
  title="Download full PDF bundle"
  aria-label="Download full PDF bundle for {bill.bill_number}"
>
  <Files size={15} />
</a>
```

Keep actions usable at existing responsive breakpoints; if the row becomes crowded, allow wrapping rather than shrinking click targets below the current size.

- [ ] **Step 2: Add labelled detail-page actions**

Add to the right action group before XLSX. Derive the selected URL from the existing `printBundle` state:

```svelte
<a href="/api/bills/{bill.id}/pdf?mode=saved" class="btn btn-primary">
  <FileDown size={16} />
  <span>Download PDF</span>
</a>
<a
  href={`/api/bills/${bill.id}/pdf?mode=bundle&types=${encodeURIComponent(printBundle.join(','))}`}
  class="btn btn-secondary"
  class:disabled={printBundle.length === 0}
  aria-disabled={printBundle.length === 0}
  onclick={(event) => { if (printBundle.length === 0) event.preventDefault(); }}
>
  <Files size={16} />
  <span>Download Full Bundle</span>
</a>
```

Keep the existing Print/PDF button, bundle checkboxes, and Export XLSX action unchanged. The dashboard bundle link omits `types` and therefore includes all three.

- [ ] **Step 3: Verify both screens visually**

Use the real Chrome browser at desktop and approximately 784px viewport widths. Confirm:

- all actions are visible and do not overlap;
- dashboard icons have useful tooltips/accessibility labels;
- detail labels are readable;
- existing Print, XLSX, edit, duplicate, and delete controls remain reachable.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte 'src/routes/bills/[id]/+page.svelte'
git commit -m "feat: expose PDF downloads in bill actions"
```

---

### Task 5: Perform mandatory visual PDF verification and final regression checks

**Files:**
- Modify only if verification reveals a defect: `src/lib/components/BillPrintDocument.svelte`, `src/lib/server/pdf-renderer.ts`, or relevant route files.

**Interfaces:**
- Verifies the complete user-visible and downloaded output.

- [ ] **Step 1: Download saved and bundle PDFs through the actual buttons**

Use real Chrome to click each button from both the dashboard and bill details. Confirm a `.pdf` download starts and the filenames match the mode.

- [ ] **Step 2: Open and visually inspect the saved PDF**

Open the downloaded saved PDF in Chrome's PDF viewer. Inspect every page for:

- A4 proportions;
- readable company/client/document text;
- correct item columns for the saved type;
- non-clipped rows;
- totals/signatures fully visible;
- no unexpected blank pages.

Capture a screenshot as evidence.

- [ ] **Step 3: Open and visually inspect the full bundle PDF**

Open downloaded bundles in Chrome's PDF viewer and inspect every page. Confirm a dashboard bundle includes invoice, proforma, and delivery note on clean page boundaries. On the detail page, select invoice and delivery note only; confirm exactly those two appear in canonical order. Confirm no-selection cannot download and delivery-note pages omit unit-price, line-total, tax, and grand-total content. Capture representative screenshots.

- [ ] **Step 4: Verify a long bill**

Use or create a temporary bill with enough rows to cross page boundaries. Download both modes and visually verify continuation pages, carryovers, totals, and absence of clipped/blank pages. Remove temporary data after verification if it was created only for this check.

- [ ] **Step 5: Run full regression checks**

```bash
npm run check
npm run build
curl -sS -o /tmp/existing.xlsx -w '%{http_code} %{content_type}\n' 'http://127.0.0.1:5173/api/bills/1/export'
file /tmp/existing.xlsx
```

Expected: zero check errors, successful build, and existing XLSX export remains a valid Microsoft Excel file.

- [ ] **Step 6: Inspect final diff and push**

```bash
git diff --check
git status --short
git log --oneline -6
git push github main
```

Do not stage `.pi/`, `.vibeyardignore`, or `Projectkarim/`. Report the PDF screenshots/inspection results and pushed commit IDs to the user.
