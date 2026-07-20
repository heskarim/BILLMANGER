# Bill Draft Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically persist meaningful changes on the new-bill form as recoverable drafts, then finalize each draft exactly once into the existing final bill model.

**Architecture:** Keep incomplete input in a dedicated `bill_drafts` table as a versioned JSON snapshot with optimistic revisions. A focused draft repository owns schema validation, atomic saves, recovery, deletion, and idempotent transactional finalization; the Svelte page owns debouncing, status, retry, navigation protection, and draft restoration. Existing `bills` queries remain final-only by construction.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript 6, better-sqlite3, Node `node:test` through `tsx`, existing vanilla CSS.

## Global Constraints

- Implement on current `main`; commit `39c0430f331a84594cadcac7aa3085d4848e8113` is a product reference, not the delivery branch.
- Create nothing when `/bills/new` opens untouched; create exactly one draft after the first meaningful bill-content change.
- Keep incomplete drafts out of `bills`, revenue, document counts, XLSX, print, PDF, duplicate, and catalog behavior.
- Do not reserve an official bill number during draft saving.
- Use a stable browser-created UUID, complete versioned snapshots, optimistic integer revisions, and atomic SQLite writes.
- Finalization must be transactional and idempotent through a unique `source_draft_key` on final bills.
- Do not auto-expire drafts; dashboard Resume/Delete is the cleanup path.
- Autosave applies only to new documents, not existing bill edit pages.
- Preserve `.pi/`, `.vibeyardignore`, and `Projectkarim/` as untracked local content.
- Direct PDF work remains governed by `docs/superpowers/specs/2026-07-19-pdf-download-design.md` and `docs/superpowers/plans/2026-07-19-pdf-download.md`; complete that plan before the final regression task if it is not already implemented.

---

## File map

### New files

- `src/lib/bill-drafts.ts` — shared payload, status, response, and validation-result types; pure payload parser and meaningful-change helpers usable by browser and server.
- `src/lib/server/bill-drafts.ts` — SQLite draft repository, revision checks, list/get/delete, and idempotent finalization transaction.
- `src/lib/server/bill-drafts.test.ts` — repository and finalization tests against a temporary SQLite database.
- `src/routes/api/bill-drafts/[draftKey]/+server.ts` — GET/PUT/DELETE draft contract.
- `src/routes/api/bill-drafts/[draftKey]/finalize/+server.ts` — strict finalization contract.
- `src/lib/components/DraftList.svelte` — dashboard-only draft rows/cards and Resume/Delete actions.
- `src/lib/components/DraftSaveStatus.svelte` — accessible new-form autosave status and Retry/Reload actions.
- `src/lib/bill-draft-autosave.ts` — browser-side serial save controller with debounce, bounded retry, conflict stop, and flush.
- `src/lib/bill-draft-autosave.test.ts` — deterministic controller tests with fake transport/timers.

### Modified files

- `src/lib/server/db.ts` — expose the existing DB safely to the draft repository, add `source_draft_key`, create `bill_drafts`, and reuse one final-bill transaction path.
- `src/routes/bills/new/+page.server.ts` — load an optional draft and route final creation through draft finalization.
- `src/routes/bills/new/+page.svelte` — restore payload, detect meaningful changes, connect autosave controller, display status, flush on navigation, and finalize the active draft.
- `src/routes/+page.server.ts` — load drafts separately and add draft deletion action.
- `src/routes/+page.svelte` — render a distinct dashboard draft section without affecting final filtering or metrics.
- `package.json` — add focused test scripts for repeatable verification.

---

### Task 1: Add shared draft contracts and payload validation

**Files:**
- Create: `src/lib/bill-drafts.ts`
- Create: `src/lib/bill-drafts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `BillDraftPayloadV1`, `BillDraftRecord`, `DraftSaveState`, `parseBillDraftPayload(value)`, `normalizeDraftPayload(value)`, `hasMeaningfulDraftChange(payload, baseline)`, and `toDraftSummary(record)`.
- Later browser and server tasks must import these exact types/functions rather than redefining the payload.

- [ ] **Step 1: Add focused Node test scripts**

Add to `package.json` scripts:

```json
"test:drafts": "tsx --test src/lib/bill-drafts.test.ts src/lib/server/bill-drafts.test.ts src/lib/bill-draft-autosave.test.ts",
"test:drafts:contracts": "tsx --test src/lib/bill-drafts.test.ts"
```

Do not create empty future test files solely to make `test:drafts` pass yet; use the focused `test:drafts:contracts` script in this task.

- [ ] **Step 2: Write failing payload tests**

Create `src/lib/bill-drafts.test.ts` with at least these cases:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasMeaningfulDraftChange,
  normalizeDraftPayload,
  parseBillDraftPayload
} from './bill-drafts.js';

const baseline = {
  version: 1 as const,
  type: 'facture' as const,
  requestedBillNumber: '2026-0001',
  date: '',
  contractNumber: '',
  contractDate: '',
  clientName: '',
  clientCode: '',
  clientAddress: '',
  hasTva: true,
  tvaRate: 19,
  notes: '',
  items: [{ rowKey: 'row-1', productName: '', unit: 'UN', quantity: 1, unitPrice: 0 }]
};

test('accepts and normalizes a version 1 draft snapshot', () => {
  const parsed = parseBillDraftPayload(baseline);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.items[0].unit, 'UN');
});

test('rejects unsupported payload versions', () => {
  assert.throws(() => parseBillDraftPayload({ ...baseline, version: 2 }), /Unsupported draft version/);
});

test('rejects non-finite numeric input', () => {
  assert.throws(() => parseBillDraftPayload({ ...baseline, tvaRate: Number.NaN }), /tvaRate/);
});

test('does not treat the untouched baseline as meaningful', () => {
  assert.equal(hasMeaningfulDraftChange(baseline, structuredClone(baseline)), false);
});

test('treats item row additions and client edits as meaningful', () => {
  assert.equal(hasMeaningfulDraftChange({ ...baseline, clientName: 'Client A' }, baseline), true);
  assert.equal(hasMeaningfulDraftChange({ ...baseline, items: [...baseline.items, { ...baseline.items[0], rowKey: 'row-2' }] }, baseline), true);
});

test('normalization trims strings but preserves row order and stable row keys', () => {
  const normalized = normalizeDraftPayload({
    ...baseline,
    clientName: '  Client A  ',
    items: [{ ...baseline.items[0], productName: '  Item A  ' }]
  });
  assert.equal(normalized.clientName, 'Client A');
  assert.equal(normalized.items[0].rowKey, 'row-1');
  assert.equal(normalized.items[0].productName, 'Item A');
});
```

- [ ] **Step 3: Run the contract test and confirm failure**

Run:

```bash
npm run test:drafts:contracts
```

Expected: FAIL because `src/lib/bill-drafts.ts` does not exist.

- [ ] **Step 4: Implement the shared contracts**

Create `src/lib/bill-drafts.ts` with these public shapes:

```ts
export type BillDocumentType = 'facture' | 'proforma' | 'livraison';

export interface BillDraftItemV1 {
  rowKey: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface BillDraftPayloadV1 {
  version: 1;
  type: BillDocumentType;
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
  items: BillDraftItemV1[];
}

export interface BillDraftRecord {
  draftKey: string;
  payload: BillDraftPayloadV1;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type DraftSaveState =
  | { kind: 'idle' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'saved'; updatedAt: string }
  | { kind: 'failed'; message: string }
  | { kind: 'conflict'; serverRevision: number };
```

Implement parser helpers with explicit checks rather than unsafe casts:

```ts
const MAX_ITEMS = 500;
const MAX_TEXT = 10_000;

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  if (value.length > MAX_TEXT) throw new Error(`${field} is too long`);
  return value;
}

function requireFinite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}
```

`parseBillDraftPayload()` must reject unknown versions/types, missing arrays, empty or excessive item arrays, duplicate/blank `rowKey` values, non-finite numbers, and strings beyond limits. `normalizeDraftPayload()` trims user strings, defaults blank item unit to `UN`, and keeps row order. `hasMeaningfulDraftChange()` compares normalized snapshots while ignoring only non-content UI state; changing the requested number from the supplied baseline is meaningful.

- [ ] **Step 5: Run tests and type checks**

Run:

```bash
npm run test:drafts:contracts
npm run check
```

Expected: contract tests pass and Svelte check reports zero errors (existing warnings may remain).

- [ ] **Step 6: Commit the contracts**

```bash
git add package.json src/lib/bill-drafts.ts src/lib/bill-drafts.test.ts
git commit -m "feat: define bill draft contracts"
```

---

### Task 2: Add idempotent draft schema and repository

**Files:**
- Modify: `src/lib/server/db.ts`
- Create: `src/lib/server/bill-drafts.ts`
- Create: `src/lib/server/bill-drafts.test.ts`

**Interfaces:**
- Consumes: shared contracts from `src/lib/bill-drafts.ts` and final bill/client/product behavior in `src/lib/server/db.ts`.
- Produces:

```ts
export interface DraftStore {
  saveDraft(input: SaveDraftInput): DraftSaveResult;
  getDraft(draftKey: string): BillDraftRecord | null;
  listDrafts(): BillDraftRecord[];
  deleteDraft(draftKey: string): boolean;
  finalizeDraft(input: FinalizeDraftInput): FinalizeDraftResult;
}

export function createDraftStore(database: Database.Database): DraftStore;
export const draftStore: DraftStore;
```

- [ ] **Step 1: Write failing repository tests with a temporary DB**

In `src/lib/server/bill-drafts.test.ts`, create a fresh in-memory or temporary-file database for each test and call an exported `initializeSchema(database)` from `db.ts`. Cover these concrete cases:

```ts
test('first save inserts revision 1 and retry with expectedRevision 0 does not duplicate');
test('matching revision updates atomically and increments once');
test('stale revision returns a typed conflict and preserves newer payload');
test('lists newest drafts first and deletes only the selected key');
test('finalization creates one bill, all items, and deletes the draft');
test('repeated finalization returns the existing bill id');
test('failed finalization leaves the draft and creates no partial bill');
test('draft saves never create clients or products');
test('finalization creates catalogs through existing final-bill behavior');
```

Use a complete payload fixture and assert actual SQL row counts and values, not only returned objects.

- [ ] **Step 2: Run the repository test and confirm failure**

Run:

```bash
npx tsx --test src/lib/server/bill-drafts.test.ts
```

Expected: FAIL because `createDraftStore()` and testable schema initialization do not exist.

- [ ] **Step 3: Make database initialization reusable and migrate safely**

Refactor `src/lib/server/db.ts` without changing existing callers:

```ts
export function initializeSchema(database: Database.Database): void {
  database.pragma('foreign_keys = ON');
  // existing CREATE TABLE statements and seeds use `database`
}

export function getDatabase(): Database.Database {
  return db;
}
```

Add guarded, idempotent migration logic:

```ts
try {
  db.exec('ALTER TABLE bills ADD COLUMN source_draft_key TEXT');
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error;
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS bills_source_draft_key_unique
  ON bills(source_draft_key)
  WHERE source_draft_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS bill_drafts (
    draft_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
```

Extend `Bill` with `source_draft_key?: string | null`. Keep old bill inserts compatible by binding `NULL` unless finalization supplies a source key.

Extract the current create-bill transaction mechanics into a database-parameterized internal helper so normal creation and draft finalization use one source of truth. Do not open a second production database connection.

- [ ] **Step 4: Implement the repository and typed errors**

Create `src/lib/server/bill-drafts.ts` with:

```ts
export class DraftConflictError extends Error {
  constructor(public readonly serverRevision: number) {
    super('Draft revision conflict');
  }
}

export class DraftNotFoundError extends Error {}
export class DraftValidationError extends Error {
  constructor(message: string, public readonly fields: Record<string, string> = {}) {
    super(message);
  }
}

export interface SaveDraftInput {
  draftKey: string;
  expectedRevision: number;
  payload: unknown;
}

export interface FinalizeDraftInput {
  draftKey: string;
  expectedRevision: number;
}

export interface FinalizeDraftResult {
  billId: number;
  alreadyFinalized: boolean;
}
```

Validate keys with `/^[0-9a-f-]{36}$/i`. `saveDraft()` must use one transaction:

- insert revision 1 only when expected revision is 0 and the key is absent;
- if the key already exists for expected revision 0, return `DraftConflictError(existingRevision)`;
- update with `WHERE draft_key = ? AND revision = ?` and increment exactly once;
- throw `DraftConflictError(currentRevision)` when no matching row updates.

`finalizeDraft()` must:

1. return the bill matching `source_draft_key` when one exists;
2. load and revision-check the draft;
3. strictly validate required client name, requested number, at least one nonblank product, positive quantities, and nonnegative financial prices;
4. recalculate totals and French amount words server-side;
5. call the shared final-bill insertion mechanics inside the same database transaction;
6. delete the draft in that transaction;
7. rely on the unique source index to make concurrent/retried finalization safe.

If a unique source-key race occurs, roll back and return the existing bill ID. If the requested bill number is taken, throw `DraftValidationError` with `{ requestedBillNumber: 'Document number already exists' }`; do not delete the draft.

- [ ] **Step 5: Run repository and regression checks**

Run:

```bash
npx tsx --test src/lib/server/bill-drafts.test.ts
npm run check
npm run build
```

Expected: repository tests pass, check reports zero errors, and build succeeds.

- [ ] **Step 6: Commit the repository**

```bash
git add src/lib/server/db.ts src/lib/server/bill-drafts.ts src/lib/server/bill-drafts.test.ts
git commit -m "feat: persist and finalize bill drafts"
```

---

### Task 3: Expose strict draft HTTP endpoints

**Files:**
- Create: `src/routes/api/bill-drafts/[draftKey]/+server.ts`
- Create: `src/routes/api/bill-drafts/[draftKey]/finalize/+server.ts`
- Create: `src/routes/api/bill-drafts/[draftKey]/draft-api.test.ts`

**Interfaces:**
- GET returns `{ draft: BillDraftRecord }`.
- PUT consumes `{ expectedRevision: number; payload: unknown }` and returns `{ draftKey; revision; updatedAt }`.
- DELETE consumes no body and returns HTTP 204.
- POST finalize consumes `{ expectedRevision: number }` and returns `{ billId; alreadyFinalized }`.

- [ ] **Step 1: Write failing handler-level tests**

Test exported handlers directly with `Request` objects and a temporary draft store injected through a small exported `createDraftHandlers(store)` factory. Assert:

- malformed JSON and invalid keys return 400;
- missing draft returns 404;
- stale saves/finalization return 409 with `serverRevision`;
- valid PUT returns revision and `Cache-Control: no-store`;
- GET never returns raw SQL column names;
- DELETE returns 204 and a second delete returns 404;
- duplicate finalization returns the same bill ID;
- server errors return 500 without echoing payload data.

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx tsx --test 'src/routes/api/bill-drafts/[draftKey]/draft-api.test.ts'
```

Expected: FAIL because the route modules do not exist.

- [ ] **Step 3: Implement GET/PUT/DELETE**

In `src/routes/api/bill-drafts/[draftKey]/+server.ts`, map typed repository errors explicitly:

```ts
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

function jsonBody(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}
```

Rules:

- reject bodies larger than a reasonable app limit before parsing when `Content-Length` is present (for example 1 MiB);
- require integer `expectedRevision >= 0`;
- return 409 `{ error: 'conflict', serverRevision }`;
- log only draft key, operation, and error class on 500, never `payload_json`.

- [ ] **Step 4: Implement finalization endpoint**

In `finalize/+server.ts`, require integer `expectedRevision >= 1`. Return:

- 200 `{ billId, alreadyFinalized }` on success/retry;
- 400 `{ error: 'validation', fields }` for final-data errors;
- 404 for an unknown key with no finalized bill;
- 409 for stale revision or duplicate requested bill number, preserving the draft;
- 500 with a redacted server log for unexpected failures.

- [ ] **Step 5: Run endpoint tests, check, and build**

```bash
npx tsx --test 'src/routes/api/bill-drafts/[draftKey]/draft-api.test.ts'
npm run check
npm run build
```

Expected: endpoint tests pass, no check errors, build succeeds.

- [ ] **Step 6: Commit the endpoints**

```bash
git add 'src/routes/api/bill-drafts/[draftKey]/+server.ts' 'src/routes/api/bill-drafts/[draftKey]/finalize/+server.ts' 'src/routes/api/bill-drafts/[draftKey]/draft-api.test.ts'
git commit -m "feat: add bill draft API"
```

---

### Task 4: Build the serial autosave controller

**Files:**
- Create: `src/lib/bill-draft-autosave.ts`
- Create: `src/lib/bill-draft-autosave.test.ts`

**Interfaces:**
- Consumes `() => BillDraftPayloadV1`, a transport, and status callback.
- Produces `createBillDraftAutosave(options): BillDraftAutosaveController`:

```ts
export interface BillDraftAutosaveController {
  markMeaningfulChange(): void;
  flush(): Promise<void>;
  retry(): void;
  dispose(): void;
  getDraftKey(): string | null;
  getRevision(): number;
  hasPendingChanges(): boolean;
}
```

- [ ] **Step 1: Write deterministic failing controller tests**

Use an injected scheduler instead of real sleeps:

```ts
interface DraftScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}
```

Cover:

- no request before meaningful change;
- first change creates one UUID/key and schedules one save at 1000 ms;
- multiple edits during debounce produce one latest-snapshot request;
- edit during an in-flight request waits, then performs one follow-up save;
- successful saves advance revisions and produce saved status;
- transient failures retry at 1000/2000/5000 ms then expose failed status;
- HTTP 400 and 409 do not retry;
- 409 enters conflict and blocks later automatic saves;
- `flush()` cancels debounce and waits for the latest dirty state;
- `dispose()` cancels timers and never mutates status afterward.

- [ ] **Step 2: Run and confirm failure**

```bash
npx tsx --test src/lib/bill-draft-autosave.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller as a small state machine**

Use these options:

```ts
export interface DraftTransport {
  save(input: {
    draftKey: string;
    expectedRevision: number;
    payload: BillDraftPayloadV1;
    keepalive?: boolean;
  }): Promise<{ revision: number; updatedAt: string }>;
}

export interface BillDraftAutosaveOptions {
  initialDraftKey?: string;
  initialRevision?: number;
  getPayload(): BillDraftPayloadV1;
  transport: DraftTransport;
  onState(state: DraftSaveState): void;
  onDraftCreated(draftKey: string): void;
  scheduler?: DraftScheduler;
  createKey?: () => string;
  debounceMs?: number;
}
```

Rules:

- only one normal request may be in flight;
- dirty state is a boolean/generation counter, never replaced by a response payload;
- a successful response acknowledges only the snapshot generation it sent;
- conflict permanently pauses saves until page reload;
- retry attempts are bounded per dirty generation;
- `flush()` resolves only when no in-flight/dirty work remains or rejects after a terminal failure/conflict;
- expose a separate `bestEffortKeepalive()` method if needed for `pagehide`, but do not allow it to alter the foreground revision asynchronously.

- [ ] **Step 4: Run controller and complete draft test suite**

```bash
npx tsx --test src/lib/bill-draft-autosave.test.ts
npm run test:drafts
```

Expected: controller tests and all draft tests pass.

- [ ] **Step 5: Commit the controller**

```bash
git add src/lib/bill-draft-autosave.ts src/lib/bill-draft-autosave.test.ts
git commit -m "feat: add resilient bill draft autosave controller"
```

---

### Task 5: Restore, autosave, and finalize drafts on the new-bill page

**Files:**
- Modify: `src/routes/bills/new/+page.server.ts`
- Modify: `src/routes/bills/new/+page.svelte`
- Create: `src/lib/components/DraftSaveStatus.svelte`

**Interfaces:**
- Page load returns `{ settings, defaultNumber, draft: BillDraftRecord | null }`.
- Form uses the controller from Task 4.
- Draft status component consumes `{ state: DraftSaveState; onRetry(): void; onReload(): void }`.

- [ ] **Step 1: Add optional server-side draft loading**

Update load:

```ts
export const load: PageServerLoad = async ({ url }) => {
  const draftKey = url.searchParams.get('draft');
  const draft = draftKey ? draftStore.getDraft(draftKey) : null;
  if (draftKey && !draft) throw error(404, 'Draft not found');

  return {
    settings: getSettings(),
    defaultNumber: getNextBillNumber('facture'),
    draft
  };
};
```

Do not create a draft from the loader.

Replace the old standalone `createBill` action with a compatibility path that creates a draft snapshot then calls the same finalization service, or remove the action only after the enhanced client finalization is fully wired and no non-JavaScript submission route is required. One source of final validation/insertion must remain.

- [ ] **Step 2: Add explicit payload conversion functions to the page**

At the top of `+page.svelte`, define one mapping in each direction:

```ts
function payloadFromForm(): BillDraftPayloadV1 {
  return {
    version: 1,
    type,
    requestedBillNumber: billNumber,
    date,
    contractNumber,
    contractDate,
    clientName,
    clientCode,
    clientAddress,
    hasTva,
    tvaRate: Number(tvaRate),
    notes,
    items: items.map((item) => ({
      rowKey: item.id,
      productName: item.product_name,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price)
    }))
  };
}

function applyDraft(payload: BillDraftPayloadV1): void {
  type = payload.type;
  billNumber = payload.requestedBillNumber;
  // assign every remaining field explicitly
  items = payload.items.map((item) => ({
    id: item.rowKey,
    product_name: item.productName,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: Number((item.quantity * item.unitPrice).toFixed(2))
  }));
}
```

Apply `data.draft.payload` once during initialization before constructing the baseline/controller. Use `crypto.randomUUID()` for new row keys instead of `Math.random()`.

- [ ] **Step 3: Connect meaningful changes without autosaving UI-only state**

Use one `markMeaningfulChange()` call from all content mutations:

- input handlers for metadata/client/notes/item controls;
- type selection after `handleTypeChange()` updates the preview number;
- add/remove row;
- client/product suggestion selection;
- TVA checkbox/rate changes.

Do not trigger it for preview visibility, autocomplete focus/indexes, or save-status changes.

On first draft creation:

```ts
history.replaceState(history.state, '', `/bills/new?draft=${encodeURIComponent(draftKey)}`);
```

- [ ] **Step 4: Implement fetch transport and accessible status component**

The transport must classify responses:

```ts
if (response.status === 409) {
  const body = await response.json();
  throw new DraftTransportConflict(body.serverRevision);
}
if (response.status >= 500 || response.status === 429) {
  throw new DraftTransportTransient('Draft save failed');
}
if (!response.ok) {
  throw new DraftTransportPermanent('Draft data is invalid');
}
```

`DraftSaveStatus.svelte` renders an `aria-live="polite"` region with exact visible states:

- `dirty`: Unsaved changes
- `saving`: Saving…
- `saved`: Draft saved
- `failed`: Save failed — Retry button
- `conflict`: Draft changed in another tab — Reload to continue button

Do not use color alone.

- [ ] **Step 5: Add navigation and page-hide protection**

Use SvelteKit `beforeNavigate` for same-app navigation:

- when no pending changes, allow navigation;
- on the first dirty attempt, cancel, await `controller.flush()`, then call `goto(destination.url.pathname + destination.url.search)`;
- guard the resumed navigation to prevent an infinite cancel loop;
- on flush failure, remain on the page with the visible failed/conflict status.

Add `pagehide`/`visibilitychange` best-effort keepalive save and `beforeunload` only while dirty. Remove listeners in `onDestroy`.

- [ ] **Step 6: Finalize through the active draft**

On **Create Document**:

1. call `markMeaningfulChange()` when the form has meaningful content but no key yet;
2. `await controller.flush()`;
3. POST `{ expectedRevision: controller.getRevision() }` to `/api/bill-drafts/{key}/finalize`;
4. disable repeated submission while pending;
5. map returned validation fields to focused/visible errors;
6. on success call `goto('/bills/' + billId)`;
7. if navigation throws after success, show `Document created` with a direct bill link.

The submitted requested number may conflict because drafts do not reserve numbers. Display the server-provided latest suggestion without silently changing the user's input.

- [ ] **Step 7: Verify new-form behavior in a real browser**

At desktop and approximately 784px width:

1. open `/bills/new`, wait, navigate away, and confirm no dashboard draft exists;
2. edit client name, wait for **Draft saved**, and confirm URL gains `?draft=`;
3. add/edit multiple rows, refresh, and compare every restored value;
4. navigate away after editing and resume from dashboard URL manually until Task 6 adds the UI;
5. block the endpoint in DevTools, edit, and confirm failure/retry without input loss;
6. open the same draft in two tabs, save A then B, and confirm B shows conflict;
7. double-click Create Document and confirm one final bill.

Also verify sticky/floating Add Row still remains visible and functional on long forms.

- [ ] **Step 8: Run automated checks and commit**

```bash
npm run test:drafts
npm run check
npm run build
git diff --check
```

Expected: all draft tests pass, zero check errors, build succeeds, diff check is clean.

```bash
git add src/routes/bills/new/+page.server.ts src/routes/bills/new/+page.svelte src/lib/components/DraftSaveStatus.svelte
git commit -m "feat: autosave new bills as drafts"
```

---

### Task 6: Add dashboard draft recovery and deletion

**Files:**
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/+page.svelte`
- Create: `src/lib/components/DraftList.svelte`

**Interfaces:**
- Dashboard load returns existing `bills`/`stats` plus `drafts: DraftSummary[]`.
- `DraftList` receives `drafts` and renders Resume/Delete only.

- [ ] **Step 1: Define and test summary mapping**

Extend `src/lib/bill-drafts.test.ts` with:

```ts
test('draft summary uses safe fallbacks for incomplete drafts', () => {
  const summary = toDraftSummary(recordWithBlankClientAndNumber);
  assert.equal(summary.clientLabel, 'Untitled client');
  assert.equal(summary.numberLabel, 'Number assigned on creation');
});
```

Expose:

```ts
export interface DraftSummary {
  draftKey: string;
  type: BillDocumentType;
  clientLabel: string;
  numberLabel: string;
  updatedAt: string;
  itemCount: number;
}
```

- [ ] **Step 2: Load and delete drafts separately**

Update `src/routes/+page.server.ts`:

```ts
const drafts = draftStore.listDrafts().map(toDraftSummary);
```

Do not merge drafts into `bills` before calculating stats. Add `deleteDraft` action that validates the key, deletes it, returns 404 when absent, and never calls `deleteBill()`.

- [ ] **Step 3: Build the distinct draft section**

`DraftList.svelte` must show:

- section heading `Saved Drafts` and count;
- Draft badge;
- type label, client fallback, number fallback, item count, and last-saved timestamp;
- Resume link `/bills/new?draft={draftKey}`;
- Delete form with confirmation;
- no view, duplicate, XLSX, print, PDF, or final delete-bill action.

Use a card/list treatment above Document History so draft rows cannot be mistaken for issued documents. Ensure action controls remain at least the existing dashboard target size and wrap cleanly at 784px.

- [ ] **Step 4: Verify statistics and exports stay final-only**

Create one saved draft containing a large invoice amount and confirm:

- revenue and final document counts do not change;
- Document History final-bill count does not change;
- `/api/bills/export` contains no draft key/client/product;
- client and product catalogs contain no draft-only entries;
- Resume restores the draft;
- Delete removes only the draft.

- [ ] **Step 5: Run checks and commit**

```bash
npm run test:drafts
npm run check
npm run build
git diff --check
```

Expected: all pass with zero errors.

```bash
git add src/lib/bill-drafts.ts src/lib/bill-drafts.test.ts src/routes/+page.server.ts src/routes/+page.svelte src/lib/components/DraftList.svelte
git commit -m "feat: resume bill drafts from dashboard"
```

---

### Task 7: Update approved PDF bundle semantics before implementation

**Files:**
- Modify: `docs/superpowers/plans/2026-07-19-pdf-download.md`
- Verify: `docs/superpowers/specs/2026-07-19-pdf-download-design.md`

**Interfaces:**
- Dashboard bundle: `/api/bills/{id}/pdf?mode=bundle`, all three types.
- Detail bundle: `/api/bills/{id}/pdf?mode=bundle&types=<comma-separated-selected-types>`.
- Saved mode remains `/api/bills/{id}/pdf?mode=saved`.

- [ ] **Step 1: Amend the PDF plan to match the confirmed user decision**

Update the plan's internal render route and endpoint tasks so they parse `types` only in bundle mode:

```ts
const CANONICAL_TYPES = ['facture', 'proforma', 'livraison'] as const;

export function parseDocumentTypes(mode: PdfMode, value: string | null, savedType: DocumentType) {
  if (mode === 'saved') return [savedType];
  if (value === null) return [...CANONICAL_TYPES];
  const selected = new Set(value.split(','));
  const ordered = CANONICAL_TYPES.filter((type) => selected.has(type));
  if (ordered.length === 0) throw new Error('Select at least one document type');
  return ordered;
}
```

Add tests for omitted types, selected subset, duplicate values, canonical ordering, and no valid selection.

- [ ] **Step 2: Amend the detail-page link instructions**

Replace the static detail link with a reactive URL derived from `printBundle`:

```svelte
<a
  href={`/api/bills/${bill.id}/pdf?mode=bundle&types=${encodeURIComponent(printBundle.join(','))}`}
  class="btn btn-secondary"
  aria-disabled={printBundle.length === 0}
>
  <Files size={16} />
  <span>Download Full Bundle</span>
</a>
```

Prevent navigation when no type is selected. Keep the dashboard link without `types` so it downloads all three.

- [ ] **Step 3: Expand visual verification instructions**

Require:

- dashboard bundle contains all three;
- detail page with invoice + delivery selected contains exactly those two;
- selection order does not alter canonical document order;
- detail page with no selection cannot start a download;
- delivery pages remain non-financial.

- [ ] **Step 4: Validate and commit the corrected PDF docs**

```bash
rg -n "all three|types=|selected|Full Bundle" docs/superpowers/specs/2026-07-19-pdf-download-design.md docs/superpowers/plans/2026-07-19-pdf-download.md
git diff --check
git add docs/superpowers/specs/2026-07-19-pdf-download-design.md docs/superpowers/plans/2026-07-19-pdf-download.md
git commit -m "docs: align PDF bundle with selected types"
```

Expected: dashboard all-three and detail selected-subset behavior are explicit and non-contradictory.

---

### Task 8: Full resilience, output, and regression verification

**Files:**
- Create: `scripts/verify-draft-autosave.ts`
- Modify app files only when a concrete verification failure requires a focused fix.

**Interfaces:**
- Verifies draft contracts, database isolation, API headers/status, browser recovery, direct PDFs, XLSX, and final build.

- [ ] **Step 1: Add a repeatable API verification script**

Create `scripts/verify-draft-autosave.ts` that accepts `BASE_URL` and performs, with a unique UUID:

1. PUT revision 0 and assert revision 1;
2. retry PUT revision 0 and assert 409/no duplicate;
3. PUT revision 1 and assert revision 2;
4. stale PUT revision 1 and assert 409;
5. GET and compare latest payload;
6. POST finalize revision 2 twice and assert the same bill ID;
7. GET deleted draft and assert 404;
8. query final bill through its page/API path and assert it exists once.

The script must clean up its final test bill or use an isolated copied `billing.db`; never leave production-like verification data silently.

- [ ] **Step 2: Run static and automated verification**

```bash
npm run test:drafts
npm run check
npm run build
git diff --check
```

Expected: all tests pass, zero check errors, successful build, clean diff.

- [ ] **Step 3: Start and identify the correct app**

Use Pi `MonitorCreate`, not shell backgrounding:

```bash
npm run dev -- --host 0.0.0.0 --port 5187 --strictPort
```

Confirm the listener command belongs to this checkout, `/` returns `TECH IP - Billing Management`, and `/bills/new` returns 200. HTTP 200 alone is not sufficient.

- [ ] **Step 4: Run API resilience checks**

```bash
BASE_URL=http://127.0.0.1:5187 npx tsx scripts/verify-draft-autosave.ts
```

Expected: every revision/idempotency assertion passes and temporary data is removed.

- [ ] **Step 5: Run real-browser draft verification**

Use Chrome at desktop and approximately 784px width. Capture evidence for:

- untouched page creates no draft;
- first edit produces one saved draft and URL key;
- refresh restores all fields/rows;
- navigate away and dashboard Resume works;
- failure/retry is visible and preserves text;
- two-tab conflict stops stale writes;
- double finalization creates one bill;
- draft deletion is isolated;
- dashboard stats remain unchanged by a high-value draft;
- sticky/floating Add Row remains visible and increments rows on new and edit pages.

- [ ] **Step 6: Verify XLSX and browser print outputs**

Download a final invoice/proforma and delivery-note XLSX. Check MIME, filename, ZIP/XLSX signature, workbook styles/merges/widths/print geometry, and non-financial delivery columns. Open browser print/PDF preview for a long bill and inspect every A4 page for blank pages, clipping, totals, signatures, and delivery-note rules.

- [ ] **Step 7: Complete the direct PDF plan and visually verify it**

If direct PDF endpoints/buttons are not yet implemented, execute `docs/superpowers/plans/2026-07-19-pdf-download.md` now using its required execution skill. Then:

- click saved and bundle downloads from dashboard and detail page;
- check `application/pdf`, attachment filename, `Cache-Control: no-store`, and `%PDF` signature;
- open each in Chrome PDF viewer;
- inspect a long saved PDF and every bundle page;
- verify dashboard bundle has all three;
- verify selected detail bundle has exactly selected types in canonical order;
- verify delivery pages omit financial columns/totals.

Capture screenshots/evidence before completion.

- [ ] **Step 8: Inspect final repository state and commit verification tooling**

```bash
git status --short --branch
git log --oneline -12
git diff --check
git add scripts/verify-draft-autosave.ts
git commit -m "test: verify bill draft recovery"
```

Confirm `.pi/`, `.vibeyardignore`, and `Projectkarim/` remain untracked and unstaged.

- [ ] **Step 9: Use the branch-finishing workflow**

Invoke `finishing-a-development-branch`. Do not push or rewrite history until the user chooses the integration action. Report exact commits, commands, browser/PDF/XLSX evidence, residual risks, and the workflow resilience check outcomes.
