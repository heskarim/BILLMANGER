import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { initializeSchema } from '$lib/server/db.js';
import { createDraftStore, type DraftStore } from '$lib/server/bill-drafts.js';
import { _createDraftHandlers } from './+server.js';
import { _createFinalizeHandler } from './finalize/+server.js';

const KEY = '00000000-0000-4000-8000-000000000011';
const payload = {
  version: 1,
  type: 'facture',
  requestedBillNumber: '2026-9101',
  date: '2026-07-20',
  contractNumber: '',
  contractDate: '',
  clientName: 'API Client',
  clientCode: '',
  clientAddress: '',
  hasTva: true,
  tvaRate: 19,
  notes: '',
  items: [{ rowKey: 'row-1', productName: 'API Product', unit: 'UN', quantity: 1, unitPrice: 10 }]
};

function setup() {
  const database = new Database(':memory:');
  initializeSchema(database, { seed: false });
  const store = createDraftStore(database);
  return { database, store, handlers: _createDraftHandlers(store), finalize: _createFinalizeHandler(store) };
}

function event(draftKey: string, body?: unknown) {
  return {
    params: { draftKey },
    request: new Request(`http://localhost/api/bill-drafts/${draftKey}`, body === undefined ? undefined : {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  } as never;
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

test('malformed JSON and invalid keys return 400 without writes', async () => {
  const { database, handlers } = setup();
  assert.equal((await handlers.PUT(event(KEY, '{'))).status, 400);
  assert.equal((await handlers.PUT(event('bad-key', { expectedRevision: 0, payload }))).status, 400);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bill_drafts').get() as { count: number }).count, 0);
});

test('missing draft returns 404 and successful responses disable caching', async () => {
  const { handlers } = setup();
  assert.equal((await handlers.GET(event(KEY))).status, 404);
  const saved = await handlers.PUT(event(KEY, { expectedRevision: 0, payload }));
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get('cache-control'), 'no-store');
  assert.equal((await json(saved)).revision, 1);
});

test('GET exposes contract fields rather than raw SQL names', async () => {
  const { handlers } = setup();
  await handlers.PUT(event(KEY, { expectedRevision: 0, payload }));
  const response = await handlers.GET(event(KEY));
  const body = await json(response);
  assert.equal(body.draft.draftKey, KEY);
  assert.equal(body.draft.revision, 1);
  assert.equal('draft_key' in body.draft, false);
  assert.equal('payload_json' in body.draft, false);
});

test('stale save returns 409 with the server revision', async () => {
  const { handlers } = setup();
  await handlers.PUT(event(KEY, { expectedRevision: 0, payload }));
  const response = await handlers.PUT(event(KEY, { expectedRevision: 0, payload: { ...payload, clientName: 'Stale' } }));
  assert.equal(response.status, 409);
  assert.deepEqual(await json(response), { error: 'conflict', serverRevision: 1 });
});

test('DELETE returns 204 then 404 and affects only the selected draft', async () => {
  const { handlers } = setup();
  await handlers.PUT(event(KEY, { expectedRevision: 0, payload }));
  assert.equal((await handlers.DELETE(event(KEY))).status, 204);
  assert.equal((await handlers.DELETE(event(KEY))).status, 404);
});

test('finalization reports validation and revision conflicts without deleting the draft', async () => {
  const { handlers, finalize, store } = setup();
  await handlers.PUT(event(KEY, { expectedRevision: 0, payload: { ...payload, clientName: '' } }));
  const stale = await finalize(event(KEY, { expectedRevision: 2 }));
  assert.equal(stale.status, 409);
  assert.equal((await json(stale)).serverRevision, 1);
  const invalid = await finalize(event(KEY, { expectedRevision: 1 }));
  assert.equal(invalid.status, 400);
  assert.equal((await json(invalid)).fields.clientName, 'Client name is required');
  assert.ok(store.getDraft(KEY));
});

test('duplicate finalization returns the same bill id', async () => {
  const { handlers, finalize, database } = setup();
  await handlers.PUT(event(KEY, { expectedRevision: 0, payload }));
  const first = await json(await finalize(event(KEY, { expectedRevision: 1 })));
  const secondResponse = await finalize(event(KEY, { expectedRevision: 1 }));
  const second = await json(secondResponse);
  assert.equal(secondResponse.status, 200);
  assert.equal(second.billId, first.billId);
  assert.equal(second.alreadyFinalized, true);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM bills').get() as { count: number }).count, 1);
});

test('unexpected server errors return redacted 500 responses', async () => {
  const broken = new Proxy({} as DraftStore, {
    get() { return () => { throw new Error('sensitive client payload'); }; }
  });
  const handlers = _createDraftHandlers(broken);
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handlers.GET(event(KEY));
    assert.equal(response.status, 500);
    assert.equal(JSON.stringify(await json(response)).includes('sensitive'), false);
  } finally {
    console.error = originalError;
  }
});
