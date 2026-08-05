import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasMeaningfulDraftChange,
  normalizeDraftPayload,
  parseBillDraftPayload,
  toDraftSummary,
  type BillDraftPayloadV1,
  type BillDraftRecord
} from './bill-drafts.js';

const baseline: BillDraftPayloadV1 = {
  version: 1,
  type: 'facture',
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

test('rejects unsupported payload versions and document types', () => {
  assert.throws(() => parseBillDraftPayload({ ...baseline, version: 2 }), /Unsupported draft version/);
  assert.throws(() => parseBillDraftPayload({ ...baseline, type: 'credit-note' }), /type/);
});

test('rejects non-finite numeric input, duplicate row keys, and invalid item counts', () => {
  assert.throws(() => parseBillDraftPayload({ ...baseline, tvaRate: Number.NaN }), /tvaRate/);
  assert.throws(() => parseBillDraftPayload({ ...baseline, items: [] }), /items/);
  assert.throws(() => parseBillDraftPayload({ ...baseline, items: [baseline.items[0], baseline.items[0]] }), /rowKey/);
});

test('does not treat the untouched baseline as meaningful', () => {
  assert.equal(hasMeaningfulDraftChange(baseline, structuredClone(baseline)), false);
});

test('treats item row additions, requested number changes, and client edits as meaningful', () => {
  assert.equal(hasMeaningfulDraftChange({ ...baseline, clientName: 'Client A' }, baseline), true);
  assert.equal(hasMeaningfulDraftChange({ ...baseline, requestedBillNumber: '2026-0002' }, baseline), true);
  assert.equal(hasMeaningfulDraftChange({ ...baseline, items: [...baseline.items, { ...baseline.items[0], rowKey: 'row-2' }] }, baseline), true);
});

test('normalization trims strings but preserves row order and stable row keys', () => {
  const normalized = normalizeDraftPayload({
    ...baseline,
    clientName: '  Client A  ',
    items: [{ ...baseline.items[0], productName: '  Item A  ', unit: '   ' }]
  });
  assert.equal(normalized.clientName, 'Client A');
  assert.equal(normalized.items[0].rowKey, 'row-1');
  assert.equal(normalized.items[0].productName, 'Item A');
  assert.equal(normalized.items[0].unit, 'UN');
});

test('draft summary uses safe fallbacks for incomplete drafts', () => {
  const record: BillDraftRecord = {
    draftKey: '00000000-0000-4000-8000-000000000001',
    payload: { ...baseline, requestedBillNumber: '  ' },
    revision: 1,
    createdAt: '2026-07-20 10:00:00',
    updatedAt: '2026-07-20 10:00:00'
  };
  const summary = toDraftSummary(record);
  assert.equal(summary.clientLabel, 'Untitled client');
  assert.equal(summary.numberLabel, 'Number assigned on creation');
  assert.equal(summary.itemCount, 1);
});
