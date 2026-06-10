Status: completed

# Issue 02: Seller Profile Settings Interface

## Description
Develop a user interface for editing and persisting the seller company's profile information. This configuration is used to dynamically auto-fill the header of all generated invoices and delivery notes.

## Tasks
- [x] Design the Settings UI page (`src/routes/settings/+page.svelte`) matching a premium modern layout.
- [x] Build inputs for all standard business fields:
  - Company Name (e.g. Cloud Pi)
  - Company Address
  - Telephone Number
  - Contact Email Address
  - RC (Registre du Commerce)
  - ART (Article d'imposition)
  - NIF (Numéro d'Identification Fiscale)
  - NIS (Numéro d'Identification Statistique)
  - RIB (Relevé d'identité Bancaire / bank info)
  - Logo Upload (drag-and-drop image dropzone, storing as base64 data-URL).
- [x] Connect the frontend form to SvelteKit server actions, updating the `settings` table (where ID = 1) in SQLite.
- [x] Add micro-animations (e.g. loading spinners and success checkmarks) when saving.

## Comments
- Initialize settings on first application load with defaults from the Cloud Pi spreadsheet.
- **Verification:** Implemented settings page with server-side load and actions. Tested form submission and base64 file reading. Works completely offline.

