import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5187';
const draftKey = crypto.randomUUID();
const unique = Date.now();
const payload = {
  version: 1,
  type: 'facture',
  requestedBillNumber: `VERIFY-${unique}`,
  date: '2026-07-20',
  contractNumber: '',
  contractDate: '',
  clientName: `Draft verifier ${unique}`,
  clientCode: '',
  clientAddress: '',
  hasTva: true,
  tvaRate: 19,
  notes: '',
  items: [{ rowKey: crypto.randomUUID(), productName: `Verification item ${unique}`, unit: 'UN', quantity: 1, unitPrice: 1 }]
};

async function request(path: string, init?: RequestInit): Promise<{ response: Response; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

async function main(): Promise<void> {
  let billId: number | null = null;
  try {
    const create = await request(`/api/bill-drafts/${draftKey}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 0, payload })
    });
    assert.equal(create.response.status, 200);
    assert.equal(create.body.revision, 1);

    const duplicate = await request(`/api/bill-drafts/${draftKey}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 0, payload })
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.serverRevision, 1);

    const changedPayload = { ...payload, clientAddress: 'Latest saved address' };
    const update = await request(`/api/bill-drafts/${draftKey}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 1, payload: changedPayload })
    });
    assert.equal(update.body.revision, 2);

    const stale = await request(`/api/bill-drafts/${draftKey}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 1, payload })
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.serverRevision, 2);

    const loaded = await request(`/api/bill-drafts/${draftKey}`);
    assert.equal(loaded.body.draft.payload.clientAddress, changedPayload.clientAddress);
    assert.equal(loaded.body.draft.revision, 2);

    const finalize = await request(`/api/bill-drafts/${draftKey}/finalize`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 2 })
    });
    assert.equal(finalize.response.status, 200);
    billId = finalize.body.billId;

    const retry = await request(`/api/bill-drafts/${draftKey}/finalize`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 2 })
    });
    assert.equal(retry.body.billId, billId);
    assert.equal(retry.body.alreadyFinalized, true);

    assert.equal((await request(`/api/bill-drafts/${draftKey}`)).response.status, 404);
    assert.equal((await fetch(`${baseUrl}/bills/${billId}`)).status, 200);
    console.log(`Draft autosave API verification passed for bill ${billId}`);
  } finally {
    if (billId !== null) {
      const form = new FormData();
      form.set('id', String(billId));
      const cleanup = await fetch(`${baseUrl}/?/deleteBill`, { method: 'POST', body: form, redirect: 'manual' });
      assert.ok(cleanup.status >= 200 && cleanup.status < 400, `cleanup failed with ${cleanup.status}`);
    } else {
      await fetch(`${baseUrl}/api/bill-drafts/${draftKey}`, { method: 'DELETE' }).catch(() => {});
    }
  }
}

await main();
