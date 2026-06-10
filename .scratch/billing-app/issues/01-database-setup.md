Status: completed

# Issue 01: SQLite Database Setup & Connection Layer

## Description
Establish a local database storage solution for the application. Set up an offline SQLite database using `better-sqlite3` (with a pure JSON-file database adapter fallback in case of native build errors on Windows) to store and manage settings, products, clients, and bill logs.

## Tasks
- [x] Initialize the SQLite database file (`billing.db`) at the project root.
- [x] Define and initialize the schema tables:
  - `settings`: Company details (Company Name, Address, Telephone, Email, RC, ART, NIF, NIS, RIB, logo URL).
  - `clients`: Customer details (code, name, address).
  - `products`: Product catalog (name, description, default unit, default price).
  - `bills`: Invoice metadata (bill number, type standard/proforma/livraison, date, contract metadata, snapshots of client info, TVA rate, totals HT/TTC, French spelling).
  - `bill_items`: Lines of products associated with bills (bill reference, product name, unit, quantity, unit price, total price, sort order).
- [x] Implement helper methods for querying, inserting, updating, and deleting records in `src/lib/server/db.ts`.
- [x] Seed initial mock data for the seller (Cloud Pi profile based on the templates) and some sample clients and products.

## Comments
- Seed data should match the billing info from "Cloud Pi 2025-0009 Tamenrasset ST chimie.xlsx" to verify continuity.
- **Verification:** Database initialization verified successfully using TypeScript execution (`test_db.ts`). Prebuilt SQLite binaries for Node.js run properly on Windows without any native compiler issues.

