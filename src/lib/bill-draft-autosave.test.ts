import assert from 'node:assert/strict';
import test from 'node:test';
import type { BillDraftPayloadV1 } from './bill-drafts.js';
import {
  createBillDraftAutosave,
  DraftTransportConflict,
  DraftTransportPermanent,
  DraftTransportTransient,
  type DraftScheduler,
  type DraftTransport
} from './bill-draft-autosave.js';

const KEY = '00000000-0000-4000-8000-000000000021';

function payload(clientName = ''): BillDraftPayloadV1 {
  return {
    version: 1,
    type: 'facture',
    requestedBillNumber: '2026-9201',
    date: '',
    contractNumber: '',
    contractDate: '',
    clientName,
    clientCode: '',
    clientAddress: '',
    hasTva: true,
    tvaRate: 19,
    notes: '',
    items: [{ rowKey: 'row-1', productName: '', unit: 'UN', quantity: 1, unitPrice: 0 }]
  };
}

class FakeScheduler implements DraftScheduler {
  now = 0;
  #id = 0;
  #jobs = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = ++this.#id;
    this.#jobs.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.#jobs.delete(handle as number);
  }

  async advance(delayMs: number): Promise<void> {
    const end = this.now + delayMs;
    while (true) {
      const next = [...this.#jobs.entries()]
        .filter(([, job]) => job.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.#jobs.delete(next[0]);
      this.now = next[1].at;
      next[1].callback();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    }
    this.now = end;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(transport: DraftTransport) {
  const scheduler = new FakeScheduler();
  let current = payload();
  const states: string[] = [];
  const created: string[] = [];
  const controller = createBillDraftAutosave({
    getPayload: () => structuredClone(current),
    transport,
    onState: (state) => states.push(state.kind),
    onDraftCreated: (key) => created.push(key),
    scheduler,
    createKey: () => KEY,
    debounceMs: 1000
  });
  return { scheduler, states, created, controller, setPayload: (value: BillDraftPayloadV1) => { current = value; } };
}

test('does not request or create a key before the first meaningful change', async () => {
  let calls = 0;
  const context = setup({ save: async () => { calls += 1; return { revision: 1, updatedAt: 'now' }; } });
  await context.scheduler.advance(5000);
  assert.equal(calls, 0);
  assert.equal(context.controller.getDraftKey(), null);
});

test('first change creates one key and debounces the latest snapshot', async () => {
  const names: string[] = [];
  const context = setup({ save: async ({ payload }) => { names.push(payload.clientName); return { revision: 1, updatedAt: 'now' }; } });
  context.setPayload(payload('First'));
  context.controller.markMeaningfulChange();
  context.setPayload(payload('Latest'));
  context.controller.markMeaningfulChange();
  assert.deepEqual(context.created, [KEY]);
  await context.scheduler.advance(999);
  assert.equal(names.length, 0);
  await context.scheduler.advance(1);
  assert.deepEqual(names, ['Latest']);
  assert.equal(context.controller.getRevision(), 1);
  assert.equal(context.states.at(-1), 'saved');
});

test('an edit during an in-flight save produces one serial follow-up with the next revision', async () => {
  const first = deferred<{ revision: number; updatedAt: string }>();
  const inputs: Array<{ name: string; revision: number }> = [];
  const context = setup({
    save: ({ payload, expectedRevision }) => {
      inputs.push({ name: payload.clientName, revision: expectedRevision });
      return inputs.length === 1 ? first.promise : Promise.resolve({ revision: 2, updatedAt: 'later' });
    }
  });
  context.setPayload(payload('First'));
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  context.setPayload(payload('Second'));
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(2000);
  assert.equal(inputs.length, 1);
  first.resolve({ revision: 1, updatedAt: 'first' });
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await context.scheduler.advance(1000);
  assert.deepEqual(inputs, [{ name: 'First', revision: 0 }, { name: 'Second', revision: 1 }]);
  assert.equal(context.controller.getRevision(), 2);
});

test('transient failures retry at 1s, 2s, and 5s before exposing failure', async () => {
  let calls = 0;
  const context = setup({ save: async () => { calls += 1; throw new DraftTransportTransient('offline'); } });
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  assert.equal(calls, 1);
  await context.scheduler.advance(1000);
  assert.equal(calls, 2);
  await context.scheduler.advance(1999);
  assert.equal(calls, 2);
  await context.scheduler.advance(1);
  assert.equal(calls, 3);
  await context.scheduler.advance(4999);
  assert.equal(calls, 3);
  await context.scheduler.advance(1);
  assert.equal(calls, 4);
  assert.equal(context.states.at(-1), 'failed');
  assert.equal(context.controller.hasPendingChanges(), true);
});

test('a permanent response does not retry automatically but a later edit can save', async () => {
  let calls = 0;
  const context = setup({ save: async () => {
    calls += 1;
    if (calls === 1) throw new DraftTransportPermanent('bad data');
    return { revision: 1, updatedAt: 'now' };
  } });
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  await context.scheduler.advance(10_000);
  assert.equal(calls, 1);
  assert.equal(context.states.at(-1), 'failed');
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  assert.equal(calls, 2);
  assert.equal(context.states.at(-1), 'saved');
});

test('a conflict does not retry and blocks later automatic saves', async () => {
  let calls = 0;
  const context = setup({ save: async () => { calls += 1; throw new DraftTransportConflict(7); } });
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  await context.scheduler.advance(10_000);
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(10_000);
  assert.equal(calls, 1);
  assert.equal(context.states.at(-1), 'conflict');
});

test('flush cancels debounce and waits for latest dirty state', async () => {
  const inputs: string[] = [];
  const context = setup({ save: async ({ payload }) => { inputs.push(payload.clientName); return { revision: inputs.length, updatedAt: 'now' }; } });
  context.setPayload(payload('Immediate'));
  context.controller.markMeaningfulChange();
  await context.controller.flush();
  assert.deepEqual(inputs, ['Immediate']);
  assert.equal(context.controller.hasPendingChanges(), false);
});

test('a new edit resets the bounded transient retry sequence', async () => {
  let calls = 0;
  const context = setup({ save: async () => {
    calls += 1;
    if (calls <= 4) throw new DraftTransportTransient('offline');
    return { revision: 1, updatedAt: 'now' };
  } });
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(9000);
  assert.equal(context.states.at(-1), 'failed');
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(1000);
  assert.equal(calls, 5);
  assert.equal(context.states.at(-1), 'saved');
});

test('retry restarts a failed dirty generation and dispose cancels mutations', async () => {
  let calls = 0;
  const context = setup({ save: async () => {
    calls += 1;
    if (calls <= 4) throw new DraftTransportTransient('offline');
    return { revision: 1, updatedAt: 'now' };
  } });
  context.controller.markMeaningfulChange();
  await context.scheduler.advance(9000);
  assert.equal(context.states.at(-1), 'failed');
  context.controller.retry();
  await context.scheduler.advance(1000);
  assert.equal(context.states.at(-1), 'saved');
  const stateCount = context.states.length;
  context.controller.markMeaningfulChange();
  context.controller.dispose();
  await context.scheduler.advance(5000);
  assert.equal(context.states.length, stateCount + 1);
  assert.equal(calls, 5);
});
