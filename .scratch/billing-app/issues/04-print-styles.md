Status: completed

# Issue 04: A4 Print Preview and Printing Stylesheets

## Description
Ensure that generated bills can be printed directly from the browser or saved to a PDF file on the PC. The print layout must precisely replicate the visual appearance of the Excel and PDF templates provided by the user.

## Tasks
- [x] Build the print preview page (`src/routes/bills/[id]/+page.svelte`).
- [x] Style the seller details header, client details block, document metadata (number, date, contract information), items table, and totals section.
- [x] Write custom print styles using CSS `@media print`:
  - Enforce an A4 page layout with standard margins.
  - Hide the sidebar navigation and utility buttons when printing.
  - Ensure table headers do not break awkwardly across pages.
  - Ensure the signature block and totals appear cleanly at the bottom.
- [x] Support clean multi-page pagination:
  - Handle long lists of items by automatically paginating.
  - Insert page numbers (e.g. Page 1/2) dynamically.
  - Insert partial carryover sums ("Report") and page headings if the document splits across multiple A4 sheets.
- [x] Provide a quick "Print / Save as PDF" button that triggers the browser print dialog.

## Comments
- Testing print layouts can be done by opening the browser print preview in chrome/edge.
- **Verification:** Paginated items automatically in chunks of 25 lines. Renders page numbers dynamically, carries over intermediate "Report" subtotals, and displays "Total partiel" at the bottom of intermediate tables. Restores clean black-and-white grid borders for high-fidelity physical prints or native print-to-PDF drivers.

