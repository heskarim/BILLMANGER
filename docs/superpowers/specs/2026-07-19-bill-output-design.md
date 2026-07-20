# Bill Output Design

## Goal
Make the BillManager v2 bill editor and document outputs usable for long bills and faithful to the supplied reference workbook/PDF.

## Scope
1. Keep the Line Items `Add Row` action available while the user scrolls through a long form.
2. Replace the plain XLSX data dump with a document-shaped workbook matching `Cloud_Pi 2025-0009 Tamenrasset ST chimie.xlsx`.
3. Make browser print/PDF output fit the same A4 document model without clipped or overflowing content.

## Design

### Sticky Add Row
The line-items card header becomes sticky within the page scroll context. It gets an opaque theme-aware background, border, and stacking order. The button remains in normal form markup and continues to call the existing `addRow` handler. On narrow screens it remains full-width/visible without covering the table.

### XLSX
The single-bill export uses one worksheet named after the document number and follows the reference structure:

- company name, address, contact, and legal identifiers
- document title and number
- date, contract number/date, client code/name/address
- page indicator for each printed page
- line-item table
- delivery notes/signature area for delivery notes; amount-in-words, totals, and stamp area for invoices/proformas

The layout is conditional by document type. Delivery notes omit unit-price and total columns like the reference; invoices and proformas include them. Long descriptions wrap and row heights are estimated from wrapped text. Cells are merged where the reference uses a visual block, styled with borders/alignment/fills, and configured with print area, landscape/portrait A4 settings, margins, repeated rows where supported, and page breaks. Numeric values remain numeric with number formats; dates use an explicit display format.

The all-bills export remains a filter-friendly data workbook, but receives stable date/number formatting, autofilters, freeze panes, and better widths rather than being confused with the document-shaped single-bill export.

### Print/PDF
The existing HTML document remains the source of truth for browser printing. Pagination is based on explicit document-type capacities and the actual presence of a footer, without using screen-only gaps/shadows. Print CSS forces A4 dimensions, zero external page margins, hidden controls, no flex shrink, no accidental extra page from the wrapper, and explicit page breaks between generated pages/documents. Page item numbering remains global across chunks.

## Error handling
- Invalid or missing bill IDs continue to return JSON 400/404 responses.
- XLSX generation must still return a valid workbook even when optional company/client fields are empty.
- Print with no selected bundle is disabled.
- Long text wraps rather than widening the document beyond A4.

## Verification
- `npm run check`
- `npm run build`
- Download a delivery-note XLSX and inspect sheet values, merges, styles, dimensions, and print settings with `xlsx`.
- Download an invoice/proforma XLSX and verify price/total columns and totals.
- Open new/edit bill screens in Chrome, scroll a long item list, and confirm Add Row remains reachable.
- Open a bill print page, inspect print media styles, and verify generated A4 pages do not overflow or add unexplained blank pages.
