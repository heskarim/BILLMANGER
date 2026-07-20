# Bill Draft Autosave Design

**Date:** 2026-07-20
**Status:** Approved for implementation planning
**Target:** Current `main`, while preserving the historical Office Form 4.6 product behavior from commit `39c0430f331a84594cadcac7aa3085d4848e8113`

## Goal

Protect unfinished work on `/bills/new` without turning incomplete input into an official bill. After the first meaningful edit, the form automatically persists as a recoverable draft. The user can refresh, navigate away, close the app, reopen it, and resume from the dashboard before selecting **Create Document**.

## Confirmed product decisions

- Implement on current `main`; the historical commit is a product reference, not the delivery branch.
- Create a draft after the first meaningful form change, not when `/bills/new` merely opens.
- Keep drafts in a separate `bill_drafts` table.
- Show drafts on the dashboard with a clear **Draft** label and **Resume** and **Delete** actions.
- Do not reserve an official bill number while a document is a draft.
- Finalize the same draft into one bill; never create a second bill from the same finalization.
- Exclude drafts from revenue, document counts, normal exports, print output, PDF output, and catalog side effects.
- Keep abandoned drafts until the user finalizes or deletes them. Automatic expiry is deferred.

## Scope

### In scope

1. First-edit draft creation.
2. Debounced, atomic saves of the complete new-document form.
3. Recovery from a draft URL and from the dashboard.
4. Visible save, saved, retry, and conflict states.
5. Optimistic revision checks for multiple tabs and out-of-order requests.
6. Idempotent finalization into the existing `bills` and `bill_items` tables.
7. Dashboard draft presentation and deletion.
8. Tests proving drafts do not affect final-bill statistics or exports.

### Out of scope

- Autosave for existing bill edit pages.
- Cloud synchronization or recovery on another computer.
- User accounts, permissions, or remote authentication.
- Automatic expiry or cleanup of old drafts.
- Draft XLSX, print, or PDF output.
- Changing the final bill document layout or calculations as part of this feature.

## Architecture

### Separate draft persistence

Incomplete input must not be inserted into `bills`. The final-bill schema requires values such as a unique bill number, client name, amount fields, and valid line items. Loosening those constraints or adding a `draft` status to `bills` would make every statistics, export, duplicate, lookup, print, and PDF query responsible for filtering incomplete records.

A separate draft repository keeps final billing data strict and makes draft exclusion the default rather than a convention.

### Draft identity

The browser creates a random draft key with `crypto.randomUUID()` when the first meaningful change occurs. It immediately uses that stable key for all save attempts.

Using a client-created stable key prevents rapid first edits or retried creation requests from producing duplicate drafts. The draft URL becomes:

```text
/bills/new?draft=<draft-key>
```

The page replaces its current history entry with this URL without reloading. The key is local recovery state, not an authentication credential.

## Data model

### New `bill_drafts` table

```sql
CREATE TABLE IF NOT EXISTS bill_drafts (
  draft_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`payload_json` contains one versioned snapshot of the complete editable form:

```ts
interface BillDraftPayloadV1 {
  version: 1;
  type: 'facture' | 'proforma' | 'livraison';
  requestedBillNumber: string;
  date: string;
  contractNumber: string;
  contractDate: string;
  clientName: string;
  clientCode: string;
  clientAddress: string;
  hasTva: boolean;
  tvaRate: number;
  notes: string;
  items: Array<{
    rowKey: string;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
}
```

Derived values such as line totals, HT, TVA amount, TTC, and amount in words are recalculated from the stored inputs when a draft loads and again on the server during finalization. They are not trusted as independent persisted inputs.

The server validates the payload shape, version, document type, item count, string lengths, and finite numeric values before storing it. Draft validation permits incomplete business fields; finalization applies the existing strict bill rules.

### Finalization idempotency

Add a nullable unique source key to final bills:

```sql
ALTER TABLE bills ADD COLUMN source_draft_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS bills_source_draft_key_unique
  ON bills(source_draft_key)
  WHERE source_draft_key IS NOT NULL;
```

The draft key is also the finalization idempotency key. If the finalization response is lost and the browser retries, the server finds the already-created bill by `source_draft_key` and returns its ID rather than inserting another bill.

Existing bills keep `NULL` and are unaffected.

## Meaningful-change rule

Opening or focusing the page does not create a draft. UI-only changes such as opening the live preview also do not create one.

These actions are meaningful and start autosave:

- changing document type, requested number, dates, contract fields, client fields, TVA settings, or notes;
- changing any line-item value;
- adding or deleting a line-item row;
- selecting a client or product suggestion.

The default blank form and server-provided next-number preview are the baseline. A draft begins only after the user changes bill content from that baseline.

## Save API and data flow

### Endpoints

```text
PUT    /api/bill-drafts/{draftKey}
GET    /api/bill-drafts/{draftKey}
DELETE /api/bill-drafts/{draftKey}
POST   /api/bill-drafts/{draftKey}/finalize
```

Dashboard draft loading uses the server-side draft repository directly rather than making an internal HTTP request.

### Create or update

The save request contains:

```json
{
  "expectedRevision": 0,
  "payload": { "version": 1 }
}
```

- `expectedRevision: 0` means insert this key only if it does not exist.
- Existing drafts update only when `expectedRevision` matches the stored revision.
- A successful write increments the revision and returns `draftKey`, `revision`, and `updatedAt`.
- A stale write returns HTTP 409 with the current server revision and does not modify the draft.
- Saving the payload and incrementing its revision occur in one SQLite transaction.

The client keeps at most one save request in flight. If the form changes during that request, it marks itself dirty and starts a new debounce after the response. A response may update acknowledged revision and status, but it never replaces the user's current in-memory form.

### Save cadence

- Debounce for approximately 1 second after the latest meaningful change.
- Save the complete snapshot, not individual fields.
- On same-app navigation, synchronously cancel the first navigation attempt, flush the pending draft, then continue navigation after a successful save. If saving fails, keep the user on the form and show the error.
- On page hide or browser unload, issue a best-effort `fetch` with `keepalive: true` when state is dirty. Normal debounced persistence remains the source of truth.
- If dirty state cannot be flushed during an external close/reload, use the browser unsaved-changes warning where supported.

### Retry behavior

Expected transient failures retry with bounded delays, for example 1 second, 2 seconds, and 5 seconds. The form remains editable and its in-memory state is never cleared.

After retries are exhausted, show **Save failed — Retry**. A later edit or explicit retry starts another bounded sequence. Do not retry HTTP 400 validation failures or HTTP 409 conflicts automatically.

## User interface

### New-document form

Show a compact status near the form actions:

- **Unsaved changes** — local state differs from the last acknowledged revision.
- **Saving…** — one request is in flight.
- **Draft saved** — latest meaningful state is acknowledged.
- **Save failed — Retry** — bounded retries ended; Retry is actionable.
- **Draft changed in another tab — Reload to continue** — server rejected a stale revision.

The status must be text, not color alone. The final submit button is disabled while finalization is running, but ordinary autosave does not lock the form.

The document-number field remains a requested number/preview and is not reserved by draft saving. At finalization, the server inserts that number only if it remains unique. If another bill claimed it, the draft remains intact and the user receives a focused number-conflict error plus the latest suggested number.

### Dashboard

The dashboard receives final bills and drafts as distinct collections.

Draft rows/cards show:

- **Draft** status;
- document type;
- client name or **Untitled client**;
- requested number preview or **Number assigned on creation**;
- last-saved time;
- **Resume** and **Delete** actions.

Drafts are visually distinct from final documents and do not expose view, duplicate, XLSX, print, or PDF actions.

Deleting a draft requires confirmation and removes only that draft. It does not modify clients, products, or final bills.

## Finalization

Selecting **Create Document** first flushes the latest local snapshot. The finalization request includes the acknowledged revision.

Inside one SQLite transaction, the server:

1. checks whether a bill already exists with this `source_draft_key`; if so, returns that bill ID;
2. loads the draft and verifies its revision;
3. validates all required final fields and normalized line items;
4. recalculates line totals, HT, TVA, TTC, and amount in words from stored inputs;
5. verifies and assigns the requested official bill number;
6. creates or updates catalog entries using the existing finalization behavior;
7. inserts the final bill with `source_draft_key`;
8. inserts all bill items;
9. deletes the draft;
10. commits and returns the final bill ID.

Any failure rolls back the whole transaction. The draft remains recoverable unless a final bill was already committed, in which case an idempotent retry returns that bill.

After success, the browser redirects to `/bills/{id}`. If navigation fails, it displays a success message with a direct link to the created bill.

## Multiple tabs and conflicts

Each save uses optimistic revision checking. When two tabs load revision 4:

1. Tab A saves and creates revision 5.
2. Tab B attempts to save with expected revision 4.
3. The server returns HTTP 409 and leaves revision 5 unchanged.
4. Tab B stops automatic saves and shows **Draft changed in another tab — Reload to continue**.

The first version does not merge field-level changes. Explicit reload is safer than silent last-write-wins behavior.

## Catalog, statistics, and export isolation

Draft saves never call `createClient()` or `createProduct()`. Catalog side effects happen only during successful finalization.

Existing final-bill queries remain based on `bills`, so drafts are absent by construction from:

- invoice, proforma, and delivery-note counts;
- revenue totals;
- all-bills XLSX export;
- single-bill XLSX export;
- browser print and direct PDF output;
- duplicate actions and final-bill lookup.

## Error handling

- Invalid draft key or malformed payload: HTTP 400, no write.
- Missing draft on load/delete/finalize: HTTP 404 unless an already-finalized bill exists for the same source key.
- Stale revision: HTTP 409 with current revision, no write.
- Duplicate requested bill number: HTTP 409, draft preserved, latest number suggestion returned.
- Database or disk failure: HTTP 500, transaction rolled back, server logs a redacted error, client preserves form state and shows retry.
- Unsupported payload version: HTTP 400 with an explicit upgrade/reload message.

Do not log complete draft payloads because client names, addresses, and document details may be sensitive.

## Migration and compatibility

- Create `bill_drafts` idempotently during database initialization.
- Add `source_draft_key` with the same guarded migration style used by the project.
- Create the partial unique index idempotently.
- Existing rows and existing `billing.db` files remain valid.
- No existing final bill is rewritten.
- Back up `billing.db` before destructive migration testing.

## Workflow resilience check

### Happy path

The first meaningful edit creates one keyed draft. Later edits debounce into atomic revisions. Refresh or dashboard Resume restores the latest acknowledged snapshot. Create Document finalizes the same draft once and redirects to the bill.

### Real-life situations

- **Restart / reboot — Handle now:** the draft is durable in SQLite and resumes from its URL or dashboard.
- **Crash halfway — Handle now:** completed revisions survive; an interrupted SQLite transaction rolls back. At most the changes inside the active debounce window may require the best-effort exit flush.
- **Internet / API failure — Handle now:** this local app still treats fetch/server failures as transient, reports them visibly, retries with bounded backoff, and preserves in-memory input.
- **Duplicate run — Handle now:** stable draft keys, expected revisions, and the unique final `source_draft_key` prevent duplicate drafts and bills.
- **User exit / cancel — Handle now:** normal debounce, navigation flush, keepalive flush, and an unsaved warning protect recoverability. Cancel does not silently delete a saved draft.
- **Bad input — Handle now:** permissive draft-shape validation permits incomplete work; strict final validation leaves the draft intact and reports focused errors.
- **Missing / expired credentials — Out of scope:** the application is a local offline tool without authentication.
- **Disk / port / resource conflict — Handle now:** database failures are visible and non-destructive; application startup/port operation remains part of the existing launch workflow.
- **Partial completion — Handle now:** transactions make each save and finalization all-or-nothing; a committed finalization is discoverable by source key.
- **Upgrade / config change — Handle now:** versioned payloads reject unknown formats explicitly; migrations are idempotent and preserve existing bills.
- **Automatic abandoned-draft cleanup — Defer safely:** drafts remain visible and manually deletable, so deferral causes clutter but no data loss or hidden side effects.
- **Cross-device recovery — Out of scope:** there is no cloud database or account system.

### Decisions

- **Handle now:** durable drafts, revisions, bounded retry, visible state, navigation protection, multi-tab conflict detection, transactional finalization, idempotent retries, and draft isolation.
- **Defer safely:** automatic draft expiry; persistent visible drafts can be deleted manually.
- **Out of scope:** cloud sync, user authentication, edit-page autosave, and draft document exports.

### Operation commands

This is an application feature, not a separate daemon.

- Start: `npm run dev -- --host 0.0.0.0 --port 5187 --strictPort`
- Stop: stop the Pi monitor or foreground Vite process.
- Status: verify the listener command and request the app-specific page title.
- Logs: inspect Vite/server output; draft failures log redacted errors.
- Restart: restart the Vite process with the same strict port.
- Doctor / health check: load `/`, confirm the BillManager title, then create and resume a test draft.

### Verification

- Test restart: save a draft, restart the app, resume it, and compare all fields and rows.
- Test failure: force the draft endpoint to fail, verify visible retry state and preserved inputs, restore it, and verify successful recovery.
- Test duplicate run: issue duplicate first-save and finalization requests; verify one draft and one final bill.
- Test recovery: type, wait, refresh, navigate away, resume from dashboard, and finalize without a duplicate.

## Verification contract

Completion requires all of the following:

1. `npm run check` reports zero errors.
2. `npm run build` succeeds.
3. Opening and leaving an untouched `/bills/new` creates no draft.
4. The first meaningful edit creates exactly one draft and updates the URL without a reload.
5. Rapid edits and repeated first-save requests do not create duplicate drafts.
6. After a successful save, refresh restores every editable field, TVA setting, note, line-item value, and row order.
7. Navigating away before Create Document leaves a resumable dashboard draft.
8. Save status exposes unsaved, saving, saved, failed/retry, and conflict states accessibly.
9. A simulated save failure preserves current input and succeeds after retry.
10. Out-of-order or stale saves cannot revert newer draft content.
11. Two tabs editing one draft produce an explicit conflict instead of silent overwrite.
12. Invalid final data leaves the draft intact and identifies the fields requiring correction.
13. Double-clicking or retrying finalization creates exactly one final bill.
14. Successful finalization removes the active draft and redirects or links to the created bill.
15. Drafts do not change dashboard revenue or final document counts.
16. Drafts do not appear in normal XLSX exports, print views, PDF downloads, or final bill lookup.
17. Draft saving does not create client or product catalog entries; finalization retains existing catalog behavior.
18. Existing final-bill creation, editing, duplication, deletion, sticky Add Row, document-shaped XLSX, browser A4 printing, and direct PDF downloads pass regression checks.
19. Desktop and approximately 784px browser layouts keep draft status and actions readable and usable.

Structural checks alone are insufficient. Recovery, failure, conflict, and duplicate-finalization behavior must be exercised in the running application before completion is claimed.
