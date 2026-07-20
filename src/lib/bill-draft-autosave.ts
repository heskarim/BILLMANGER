import type { BillDraftPayloadV1, DraftSaveState } from './bill-drafts.js';

export class DraftTransportTransient extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftTransportTransient';
  }
}

export class DraftTransportPermanent extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftTransportPermanent';
  }
}

export class DraftTransportConflict extends Error {
  constructor(public readonly serverRevision: number) {
    super('Draft revision conflict');
    this.name = 'DraftTransportConflict';
  }
}

export interface DraftScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

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

export interface BillDraftAutosaveController {
  markMeaningfulChange(): void;
  flush(): Promise<void>;
  retry(): void;
  dispose(): void;
  bestEffortKeepalive(): void;
  getDraftKey(): string | null;
  getRevision(): number;
  hasPendingChanges(): boolean;
}

const RETRY_DELAYS = [1000, 2000, 5000];
const defaultScheduler: DraftScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
};

export function createBillDraftAutosave(options: BillDraftAutosaveOptions): BillDraftAutosaveController {
  const scheduler = options.scheduler ?? defaultScheduler;
  const debounceMs = options.debounceMs ?? 1000;
  const createKey = options.createKey ?? (() => crypto.randomUUID());
  let draftKey = options.initialDraftKey ?? null;
  let revision = options.initialRevision ?? 0;
  let generation = 0;
  let acknowledgedGeneration = 0;
  let retryAttempt = 0;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let disposed = false;
  let terminal: Error | null = null;
  let conflict = false;
  const waiters = new Set<{ resolve(): void; reject(error: Error): void }>();

  function emit(state: DraftSaveState): void {
    if (!disposed) options.onState(state);
  }

  function clearTimer(): void {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  }

  function settleWaiters(): void {
    if (inFlight || timer !== null || generation > acknowledgedGeneration) {
      if (!terminal) return;
    }
    for (const waiter of waiters) {
      terminal ? waiter.reject(terminal) : waiter.resolve();
    }
    waiters.clear();
  }

  function schedule(delayMs: number): void {
    if (disposed || conflict) return;
    clearTimer();
    timer = scheduler.setTimeout(() => {
      timer = null;
      void saveLatest();
    }, delayMs);
  }

  async function saveLatest(): Promise<void> {
    if (disposed || conflict || inFlight || generation <= acknowledgedGeneration) {
      settleWaiters();
      return;
    }
    if (!draftKey) throw new Error('Draft key was not created');
    const sentGeneration = generation;
    const snapshot = options.getPayload();
    emit({ kind: 'saving' });

    inFlight = options.transport.save({
      draftKey,
      expectedRevision: revision,
      payload: snapshot
    }).then((result) => {
      revision = result.revision;
      acknowledgedGeneration = Math.max(acknowledgedGeneration, sentGeneration);
      retryAttempt = 0;
      terminal = null;
      emit({ kind: 'saved', updatedAt: result.updatedAt });
    }).catch((error: unknown) => {
      const normalized = error instanceof Error ? error : new Error('Draft save failed');
      if (normalized instanceof DraftTransportConflict) {
        conflict = true;
        terminal = normalized;
        emit({ kind: 'conflict', serverRevision: normalized.serverRevision });
      } else if (normalized instanceof DraftTransportTransient && retryAttempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryAttempt++];
        emit({ kind: 'dirty' });
        schedule(delay);
      } else {
        terminal = normalized;
        emit({ kind: 'failed', message: normalized.message || 'Draft save failed' });
      }
    }).finally(() => {
      inFlight = null;
      if (!disposed && !conflict && !terminal && generation > acknowledgedGeneration && timer === null) {
        schedule(debounceMs);
      }
      settleWaiters();
    });

    await inFlight;
  }

  function markMeaningfulChange(): void {
    if (disposed || conflict) return;
    if (!draftKey) {
      draftKey = createKey();
      options.onDraftCreated(draftKey);
    }
    generation += 1;
    terminal = null;
    retryAttempt = 0;
    emit({ kind: 'dirty' });
    if (!inFlight) schedule(debounceMs);
  }

  async function flush(): Promise<void> {
    if (disposed) return;
    clearTimer();
    if (terminal) throw terminal;
    if (generation <= acknowledgedGeneration && !inFlight) return;
    if (!inFlight) void saveLatest();
    return new Promise<void>((resolve, reject) => {
      waiters.add({ resolve, reject });
      settleWaiters();
    });
  }

  return {
    markMeaningfulChange,
    flush,
    retry() {
      if (disposed || conflict || !terminal || terminal instanceof DraftTransportPermanent) return;
      terminal = null;
      retryAttempt = 0;
      emit({ kind: 'dirty' });
      schedule(debounceMs);
    },
    dispose() {
      clearTimer();
      disposed = true;
      for (const waiter of waiters) waiter.reject(new Error('Autosave controller disposed'));
      waiters.clear();
    },
    bestEffortKeepalive() {
      if (disposed || conflict || inFlight || !draftKey || generation <= acknowledgedGeneration) return;
      const sentGeneration = generation;
      inFlight = options.transport.save({
        draftKey,
        expectedRevision: revision,
        payload: options.getPayload(),
        keepalive: true
      }).then((result) => {
        revision = result.revision;
        acknowledgedGeneration = Math.max(acknowledgedGeneration, sentGeneration);
        terminal = null;
        retryAttempt = 0;
        emit({ kind: 'saved', updatedAt: result.updatedAt });
      }).catch(() => {
        // Page-hide persistence is best effort; foreground retry remains available.
      }).finally(() => {
        inFlight = null;
        settleWaiters();
      });
    },
    getDraftKey: () => draftKey,
    getRevision: () => revision,
    hasPendingChanges: () => generation > acknowledgedGeneration
  };
}
