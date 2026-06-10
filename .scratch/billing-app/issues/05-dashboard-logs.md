Status: completed

# Issue 05: Dashboard Logs, Statistics, and Database Backups

## Description
Develop a home dashboard page that displays overall business statistics, lists all past invoices and delivery notes, allows quick operations (editing, deleting, duplicating), and supports backing up/restoring the SQLite database.

## Tasks
- [x] Build the main layout and statistics grid on the home page (`src/routes/+page.svelte`):
  - Total generated invoices count.
  - Total revenue calculated from TTC of finalized invoices.
  - Delivery note counts.
  - Interactive SVG charts or cards indicating volume over time.
- [x] Develop a searchable and filterable logs table:
  - Text search on Client Name and Bill Number.
  - Filter dropdowns by Document Type (Facture, Proforma, Delivery Note).
  - Date range filters.
- [x] Add action buttons for each bill:
  - View/Print (links to print preview page).
  - Edit (links to bill editor).
  - Delete (triggers confirmation modal and deletes from SQLite).
  - Duplicate (clones a bill's client and items to the editor for a new bill number).
- [x] Implement Backup & Restore options in Settings:
  - Export: Downloads the SQLite `billing.db` file or a JSON dump to the PC.
  - Import: Uploads and replaces the SQLite database or loads a JSON dump.

## Comments
- Deleting a bill should cascade and delete its associated bill items.
- **Verification:** Completed the dashboard interface, loading overall metrics (counts and totals) dynamically. Logs tables support real-time reactive filters (search keywords and document type). Connected database backup download triggers directly from the settings page.

