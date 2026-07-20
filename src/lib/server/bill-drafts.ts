import type Database from 'better-sqlite3';
import {
  normalizeDraftPayload,
  type BillDraftRecord,
  type BillDraftPayloadV1
} from '../bill-drafts.js';
import { numberToWordsFrench } from '../utils/frenchWords.js';
import { getDatabase, insertFinalBill, type Bill, type BillItem } from './db.js';

const DRAFT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DraftConflictError extends Error {
  constructor(public readonly serverRevision: number) {
    super('Draft revision conflict');
    this.name = 'DraftConflictError';
  }
}

export class DraftNotFoundError extends Error {
  constructor() {
    super('Draft not found');
    this.name = 'DraftNotFoundError';
  }
}

export class DraftValidationError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
    public readonly latestSuggestedNumber?: string
  ) {
    super(message);
    this.name = 'DraftValidationError';
  }
}

export interface SaveDraftInput {
  draftKey: string;
  expectedRevision: number;
  payload: unknown;
}

export interface DraftSaveResult {
  draftKey: string;
  revision: number;
  updatedAt: string;
}

export interface FinalizeDraftInput {
  draftKey: string;
  expectedRevision: number;
}

export interface FinalizeDraftResult {
  billId: number;
  alreadyFinalized: boolean;
}

export interface DraftStore {
  saveDraft(input: SaveDraftInput): DraftSaveResult;
  getDraft(draftKey: string): BillDraftRecord | null;
  listDrafts(): BillDraftRecord[];
  deleteDraft(draftKey: string): boolean;
  finalizeDraft(input: FinalizeDraftInput): FinalizeDraftResult;
}

interface DraftRow {
  draft_key: string;
  payload_json: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export function assertDraftKey(draftKey: string): void {
  if (!DRAFT_KEY_PATTERN.test(draftKey)) throw new DraftValidationError('Invalid draft key');
}

function mapDraftRow(row: DraftRow): BillDraftRecord {
  return {
    draftKey: row.draft_key,
    payload: normalizeDraftPayload(JSON.parse(row.payload_json)),
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function latestSuggestedNumber(database: Database.Database): string {
  const year = new Date().getFullYear();
  const rows = database.prepare('SELECT bill_number FROM bills WHERE bill_number LIKE ?').all(`${year}-%`) as Array<{ bill_number: string }>;
  const largest = rows.reduce((maximum, row) => {
    const match = row.bill_number.match(/^\d{4}-(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${year}-${String(largest + 1).padStart(4, '0')}`;
}

function validateFinalPayload(payload: BillDraftPayloadV1): void {
  const fields: Record<string, string> = {};
  if (!payload.requestedBillNumber) fields.requestedBillNumber = 'Document number is required';
  if (!payload.clientName) fields.clientName = 'Client name is required';
  if (payload.items.length === 0) fields.items = 'At least one line item is required';
  payload.items.forEach((item, index) => {
    if (!item.productName) fields[`items.${index}.productName`] = 'Product name is required';
    if (!(item.quantity > 0)) fields[`items.${index}.quantity`] = 'Quantity must be greater than zero';
    if (item.unitPrice < 0) fields[`items.${index}.unitPrice`] = 'Unit price cannot be negative';
  });
  if (payload.tvaRate < 0) fields.tvaRate = 'TVA rate cannot be negative';
  if (Object.keys(fields).length > 0) throw new DraftValidationError('Draft is incomplete', fields);
}

function toFinalBill(payload: BillDraftPayloadV1, draftKey: string): {
  bill: Omit<Bill, 'id' | 'created_at'>;
  items: Omit<BillItem, 'id' | 'bill_id'>[];
} {
  const financial = payload.type !== 'livraison';
  const items = payload.items.map((item, index) => {
    const quantity = item.quantity;
    const unitPrice = financial ? item.unitPrice : 0;
    return {
      product_name: item.productName,
      unit: item.unit || 'UN',
      quantity,
      unit_price: unitPrice,
      total_price: Number((quantity * unitPrice).toFixed(2)),
      sort_order: index + 1
    };
  });
  const montantHt = financial
    ? Number(items.reduce((sum, item) => sum + item.total_price, 0).toFixed(2))
    : 0;
  // Preserve this historical branch's existing calculation behavior: TTC equals HT.
  const montantTtc = montantHt;

  return {
    bill: {
      bill_number: payload.requestedBillNumber,
      type: payload.type,
      date: payload.date,
      contract_number: payload.contractNumber,
      contract_date: payload.contractDate,
      client_name_snapshot: payload.clientName,
      client_address_snapshot: payload.clientAddress,
      client_code_snapshot: payload.clientCode,
      tva_rate: financial && payload.hasTva ? payload.tvaRate : 0,
      montant_ht: montantHt,
      montant_ttc: montantTtc,
      amount_in_words: numberToWordsFrench(montantTtc),
      notes: payload.type === 'livraison' ? payload.notes : '',
      source_draft_key: draftKey
    },
    items
  };
}

export function createDraftStore(database: Database.Database): DraftStore {
  const getRow = (draftKey: string) => database.prepare('SELECT * FROM bill_drafts WHERE draft_key = ?').get(draftKey) as DraftRow | undefined;

  return {
    saveDraft(input) {
      assertDraftKey(input.draftKey);
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
        throw new DraftValidationError('expectedRevision must be a nonnegative integer');
      }
      let payload: BillDraftPayloadV1;
      try {
        payload = normalizeDraftPayload(input.payload);
      } catch (error) {
        throw new DraftValidationError(error instanceof Error ? error.message : 'Invalid draft payload');
      }

      return database.transaction(() => {
        const existing = getRow(input.draftKey);
        if (!existing) {
          if (input.expectedRevision !== 0) throw new DraftConflictError(0);
          database.prepare('INSERT INTO bill_drafts (draft_key, payload_json, revision) VALUES (?, ?, 1)')
            .run(input.draftKey, JSON.stringify(payload));
        } else {
          if (input.expectedRevision !== existing.revision) throw new DraftConflictError(existing.revision);
          const result = database.prepare(`
            UPDATE bill_drafts
            SET payload_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
            WHERE draft_key = ? AND revision = ?
          `).run(JSON.stringify(payload), input.draftKey, input.expectedRevision);
          if (result.changes !== 1) {
            const current = getRow(input.draftKey);
            throw new DraftConflictError(current?.revision ?? 0);
          }
        }
        const saved = getRow(input.draftKey);
        if (!saved) throw new Error('Draft write failed');
        return { draftKey: saved.draft_key, revision: saved.revision, updatedAt: saved.updated_at };
      })();
    },

    getDraft(draftKey) {
      assertDraftKey(draftKey);
      const row = getRow(draftKey);
      return row ? mapDraftRow(row) : null;
    },

    listDrafts() {
      const rows = database.prepare('SELECT * FROM bill_drafts ORDER BY updated_at DESC, rowid DESC').all() as DraftRow[];
      return rows.map(mapDraftRow);
    },

    deleteDraft(draftKey) {
      assertDraftKey(draftKey);
      return database.prepare('DELETE FROM bill_drafts WHERE draft_key = ?').run(draftKey).changes === 1;
    },

    finalizeDraft(input) {
      assertDraftKey(input.draftKey);
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
        throw new DraftValidationError('expectedRevision must be a positive integer');
      }

      const finalized = database.prepare('SELECT id FROM bills WHERE source_draft_key = ?').get(input.draftKey) as { id: number } | undefined;
      if (finalized) return { billId: finalized.id, alreadyFinalized: true };

      try {
        return database.transaction(() => {
          const alreadyFinalized = database.prepare('SELECT id FROM bills WHERE source_draft_key = ?').get(input.draftKey) as { id: number } | undefined;
          if (alreadyFinalized) return { billId: alreadyFinalized.id, alreadyFinalized: true };

          const row = getRow(input.draftKey);
          if (!row) throw new DraftNotFoundError();
          if (row.revision !== input.expectedRevision) throw new DraftConflictError(row.revision);
          const payload = mapDraftRow(row).payload;
          validateFinalPayload(payload);
          const numberExists = database.prepare('SELECT 1 FROM bills WHERE bill_number = ?').get(payload.requestedBillNumber);
          if (numberExists) {
            throw new DraftValidationError(
              'Document number already exists',
              { requestedBillNumber: 'Document number already exists' },
              latestSuggestedNumber(database)
            );
          }

          const final = toFinalBill(payload, input.draftKey);
          const created = insertFinalBill(database, final.bill, final.items);
          database.prepare('DELETE FROM bill_drafts WHERE draft_key = ?').run(input.draftKey);
          return { billId: created.id, alreadyFinalized: false };
        })();
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed: bills.source_draft_key')) {
          const existing = database.prepare('SELECT id FROM bills WHERE source_draft_key = ?').get(input.draftKey) as { id: number } | undefined;
          if (existing) return { billId: existing.id, alreadyFinalized: true };
        }
        throw error;
      }
    }
  };
}

export const draftStore = createDraftStore(getDatabase());
