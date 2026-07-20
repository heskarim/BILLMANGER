# Direct PDF Download Design

**Date:** 2026-07-19
**Status:** Approved

## Goal

Add direct PDF downloads to both the dashboard and individual bill view. Users must be able to retain printable PDF copies without opening the browser print dialog.

## User-facing behavior

### Dashboard

Each bill row has two PDF actions:

1. **Download PDF** downloads the bill in its saved document type.
2. **Download Full Bundle** downloads one PDF containing an invoice, proforma, and delivery-note version of the bill.

The compact dashboard actions use distinct PDF icons and accessible titles/labels. Existing view, edit, duplicate, and delete actions remain unchanged.

### Bill details

The operations bar has two labelled actions:

1. **Download PDF** downloads the saved document type.
2. **Download Full Bundle** downloads the document types currently selected in the existing print-bundle checkboxes, preserving their canonical invoice, proforma, delivery-note order.

At least one type must remain selected. The current browser print action and XLSX export remain available.

## Endpoint

A server endpoint handles both downloads:

```text
GET /api/bills/{id}/pdf?mode=saved
GET /api/bills/{id}/pdf?mode=bundle
GET /api/bills/{id}/pdf?mode=bundle&types=facture,livraison
```

- `saved` renders only the bill's persisted type and ignores `types`.
- Dashboard `bundle` requests omit `types` and render invoice, proforma, and delivery-note copies in that order.
- Detail-page `bundle` requests include the currently selected types as a comma-separated allowlist. The server de-duplicates and restores canonical invoice, proforma, delivery-note order regardless of query order.
- A bundle with no valid selected type returns HTTP 400.
- Missing bills return HTTP 404.
- Unsupported modes return HTTP 400.
- Rendering failures return HTTP 500 with a useful server log and no invalid PDF download.

Successful responses use:

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="...pdf"
Cache-Control: no-store
```

Example filenames:

```text
Facture_2025-0009.pdf
Proforma_2025-0009.pdf
Bon-de-Livraison_2025-0009.pdf
Bundle_2025-0009.pdf
```

Filename components are sanitized before use in response headers.

## Rendering architecture

Use a server-side headless Chromium renderer. The endpoint loads a dedicated internal print route for the requested bill and mode, waits for fonts and document content, then calls Chromium's PDF export with:

- A4 page format
- print backgrounds enabled
- CSS page-size preference enabled
- zero renderer margins because the document CSS controls its own page geometry

The internal print route reuses the existing bill presentation and pagination rules rather than maintaining a separate hand-drawn PDF layout. It has no application navigation or interactive controls.

The renderer must determine the request origin safely from the incoming request rather than relying on a hard-coded localhost URL. It must close the page/browser in a `finally` block even when rendering fails.

## Document rules

- Invoice and proforma versions include unit prices, totals, tax, and amount-in-words content.
- Delivery-note versions omit financial columns and totals.
- Existing explicit A4 pagination remains the source of truth.
- Full bundles force a clean page boundary between document types.
- Long item lists must continue across A4 pages without clipped rows, overlapping totals, or blank trailing pages.

## Dependencies

Add a Chromium-capable PDF dependency suitable for the local Node/SvelteKit runtime. Prefer a package that can use an available system browser or a managed browser binary reliably. Browser availability must be checked during implementation; setup failures must produce a clear error.

## Accessibility and feedback

- Dashboard icon actions include descriptive `title` and `aria-label` text.
- Detail-page actions include visible labels.
- Links use normal browser download navigation, allowing standard browser download feedback.
- Buttons are visually distinct from XLSX export and print actions.

## Verification contract

Completion requires all of the following:

1. `npm run check` reports zero errors.
2. `npm run build` succeeds.
3. Both PDF links exist on the dashboard for every bill.
4. Both PDF links exist on the individual bill page.
5. Saved-mode endpoints return HTTP 200, `application/pdf`, an attachment filename, and a valid PDF signature.
6. Bundle-mode endpoints meet the same response checks.
7. A downloaded saved-type PDF is opened and visually inspected in a real browser or PDF renderer.
8. A downloaded bundle PDF is opened and visually inspected page by page.
9. Visual inspection confirms A4 proportions, readable text, complete headers, non-clipped rows, correct totals, and no unexpected blank pages.
10. A dashboard bundle visibly contains invoice, proforma, and delivery-note documents.
11. A detail-page bundle contains exactly the types selected in the existing checkboxes, in canonical order.
12. Delivery-note pages visibly omit price and financial-total columns.
13. At least one long bill is checked visually for pagination behavior.
14. Existing browser Print/PDF and XLSX exports still work.

Structural checks alone are not sufficient; visual PDF inspection is mandatory.

## Scope exclusions

- No bulk PDF download for all dashboard bills.
- No PDF storage in the database or filesystem.
- No email delivery.
- No changes to bill data or calculations.
- No removal of existing print or XLSX functionality.
