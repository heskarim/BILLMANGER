import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import type { BillDraftPayloadV1 } from '../bill-drafts.js';
import { initializeSchema } from './db.js';
import {
  createDraftStore,
  DraftConflictError,
  DraftValidationError
} from './bill-drafts.js';

const DRAFT_KEY = '00000000-0000-4000-8000-000000000001';

function payload(overrides: Partial<BillDraftPayloadV1> = {}): BillDraftPayloadV1 {
  return {
    version: 1,
    type: 'facture',
    requestedBillNumber: '2026-9001',
    date: '2026-07-20',
    contractNumber: '',
    contractDate: '',
    clientName: 'Draft Client',
    clientCode: 'DRAFT-CLIENT',
    clientAddress: 'Draft Address',
    hasTva: true,
    tvaRate: 19,
    notes: '',
    items: [
      { rowKey: 'row-1', productName: 'Draft Product', unit: 'UN', quantity: 2, unitPrice: 125 }
    ],
    ...overrides
  };
}

function setup() {
  const database = new Database(':memory:');
  initializeSchema(database, { seed: false });
  return { database, store: createDraftStore(database) };
}

test('first save inserts revision 1 and retry with expectedRevision 0 does not duplicate', () => {
  const { database, store } = setup();
  const saved = store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  assert.equal(saved.revision, 1);
  assert.throws(
    () => store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload({ clientName: 'Other' }) }),
    (error: unknown) => error instanceof DraftConflictError && error.serverRevision === 1
  );
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bill_drafts').get() as { count: number }).count, 1);
});

test('matching revision updates atomically and stale revision preserves newer payload', () => {
  const { store } = setup();
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  const updated = store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 1, payload: payload({ clientName: 'Newest' }) });
  assert.equal(updated.revision, 2);
  assert.throws(
    () => store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 1, payload: payload({ clientName: 'Stale' }) }),
    (error: unknown) => error instanceof DraftConflictError && error.serverRevision === 2
  );
  assert.equal(store.getDraft(DRAFT_KEY)?.payload.clientName, 'Newest');
  assert.equal(store.getDraft(DRAFT_KEY)?.revision, 2);
});

test('lists newest drafts first and deletes only the selected key', () => {
  const { database, store } = setup();
  const secondKey = '00000000-0000-4000-8000-000000000002';
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload({ clientName: 'First' }) });
  store.saveDraft({ draftKey: secondKey, expectedRevision: 0, payload: payload({ clientName: 'Second' }) });
  database.prepare("UPDATE bill_drafts SET updated_at = '2026-07-20 09:00:00' WHERE draft_key = ?").run(DRAFT_KEY);
  database.prepare("UPDATE bill_drafts SET updated_at = '2026-07-20 11:00:00' WHERE draft_key = ?").run(secondKey);
  assert.deepEqual(store.listDrafts().map((draft) => draft.draftKey), [secondKey, DRAFT_KEY]);
  assert.equal(store.deleteDraft(DRAFT_KEY), true);
  assert.equal(store.deleteDraft(DRAFT_KEY), false);
  assert.equal(store.getDraft(secondKey)?.payload.clientName, 'Second');
});

test('draft saves never create clients or products', () => {
  const { database, store } = setup();
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }).count, 0);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count, 0);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bills').get() as { count: number }).count, 0);
});

test('finalization creates one bill, all items and catalogs, then deletes the draft', () => {
  const { database, store } = setup();
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  const result = store.finalizeDraft({ draftKey: DRAFT_KEY, expectedRevision: 1 });
  assert.equal(result.alreadyFinalized, false);
  const bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(result.billId) as Record<string, unknown>;
  assert.equal(bill.source_draft_key, DRAFT_KEY);
  assert.equal(bill.montant_ht, 250);
  assert.equal(bill.montant_ttc, 250);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bill_items WHERE bill_id = ?').get(result.billId) as { count: number }).count, 1);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM clients WHERE code = ?').get('DRAFT-CLIENT') as { count: number }).count, 1);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM products WHERE name = ?').get('Draft Product') as { count: number }).count, 1);
  assert.equal(store.getDraft(DRAFT_KEY), null);
});

test('repeated finalization returns the existing bill id exactly once', () => {
  const { database, store } = setup();
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  const first = store.finalizeDraft({ draftKey: DRAFT_KEY, expectedRevision: 1 });
  const second = store.finalizeDraft({ draftKey: DRAFT_KEY, expectedRevision: 1 });
  assert.equal(second.billId, first.billId);
  assert.equal(second.alreadyFinalized, true);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bills WHERE source_draft_key = ?').get(DRAFT_KEY) as { count: number }).count, 1);
});

test('failed finalization leaves the draft and creates no partial bill or catalogs', () => {
  const { database, store } = setup();
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload({ clientName: '', items: [{ ...payload().items[0], productName: '' }] }) });
  assert.throws(
    () => store.finalizeDraft({ draftKey: DRAFT_KEY, expectedRevision: 1 }),
    (error: unknown) => error instanceof DraftValidationError && Boolean(error.fields.clientName)
  );
  assert.ok(store.getDraft(DRAFT_KEY));
  for (const table of ['bills', 'bill_items', 'clients', 'products']) {
    assert.equal((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count, 0);
  }
});

test('number conflicts preserve the draft and provide a current suggestion', () => {
  const { database, store } = setup();
  database.prepare(`INSERT INTO bills (
    bill_number, type, date, client_name_snapshot, client_address_snapshot, client_code_snapshot,
    tva_rate, montant_ht, montant_ttc, amount_in_words, source_draft_key
  ) VALUES (?, 'facture', '', 'Existing', '', '', 0, 0, 0, '', NULL)`).run('2026-9001');
  store.saveDraft({ draftKey: DRAFT_KEY, expectedRevision: 0, payload: payload() });
  assert.throws(
    () => store.finalizeDraft({ draftKey: DRAFT_KEY, expectedRevision: 1 }),
    (error: unknown) => error instanceof DraftValidationError && Boolean(error.fields.requestedBillNumber) && Boolean(error.latestSuggestedNumber)
  );
  assert.ok(store.getDraft(DRAFT_KEY));
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bills').get() as { count: number }).count, 1);
});
