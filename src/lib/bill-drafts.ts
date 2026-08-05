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

export interface DraftSummary {
  draftKey: string;
  type: BillDocumentType;
  clientLabel: string;
  numberLabel: string;
  updatedAt: string;
  itemCount: number;
}

export type DraftSaveState =
  | { kind: 'idle' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'saved'; updatedAt: string }
  | { kind: 'failed'; message: string }
  | { kind: 'conflict'; serverRevision: number };

const MAX_ITEMS = 500;
const MAX_TEXT = 10_000;
const DOCUMENT_TYPES = new Set<BillDocumentType>(['facture', 'proforma', 'livraison']);

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

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

function parseItem(value: unknown, index: number): BillDraftItemV1 {
  const row = requireRecord(value, `items[${index}]`);
  return {
    rowKey: requireString(row.rowKey, `items[${index}].rowKey`),
    productName: requireString(row.productName, `items[${index}].productName`),
    unit: requireString(row.unit, `items[${index}].unit`),
    quantity: requireFinite(row.quantity, `items[${index}].quantity`),
    unitPrice: requireFinite(row.unitPrice, `items[${index}].unitPrice`)
  };
}

export function parseBillDraftPayload(value: unknown): BillDraftPayloadV1 {
  const draft = requireRecord(value, 'payload');
  if (draft.version !== 1) throw new Error('Unsupported draft version');
  if (typeof draft.type !== 'string' || !DOCUMENT_TYPES.has(draft.type as BillDocumentType)) {
    throw new Error('type must be a supported document type');
  }
  if (typeof draft.hasTva !== 'boolean') throw new Error('hasTva must be a boolean');
  if (!Array.isArray(draft.items) || draft.items.length === 0 || draft.items.length > MAX_ITEMS) {
    throw new Error(`items must contain between 1 and ${MAX_ITEMS} rows`);
  }

  const items = draft.items.map(parseItem);
  const rowKeys = new Set<string>();
  for (const item of items) {
    if (!item.rowKey.trim() || rowKeys.has(item.rowKey)) {
      throw new Error('rowKey values must be nonblank and unique');
    }
    rowKeys.add(item.rowKey);
  }

  return {
    version: 1,
    type: draft.type as BillDocumentType,
    requestedBillNumber: requireString(draft.requestedBillNumber, 'requestedBillNumber'),
    date: requireString(draft.date, 'date'),
    contractNumber: requireString(draft.contractNumber, 'contractNumber'),
    contractDate: requireString(draft.contractDate, 'contractDate'),
    clientName: requireString(draft.clientName, 'clientName'),
    clientCode: requireString(draft.clientCode, 'clientCode'),
    clientAddress: requireString(draft.clientAddress, 'clientAddress'),
    hasTva: draft.hasTva,
    tvaRate: requireFinite(draft.tvaRate, 'tvaRate'),
    notes: requireString(draft.notes, 'notes'),
    items
  };
}

export function normalizeDraftPayload(value: unknown): BillDraftPayloadV1 {
  const payload = parseBillDraftPayload(value);
  return {
    ...payload,
    requestedBillNumber: payload.requestedBillNumber.trim(),
    date: payload.date.trim(),
    contractNumber: payload.contractNumber.trim(),
    contractDate: payload.contractDate.trim(),
    clientName: payload.clientName.trim(),
    clientCode: payload.clientCode.trim(),
    clientAddress: payload.clientAddress.trim(),
    notes: payload.notes.trim(),
    items: payload.items.map((item) => ({
      ...item,
      rowKey: item.rowKey.trim(),
      productName: item.productName.trim(),
      unit: item.unit.trim() || 'UN'
    }))
  };
}

export function hasMeaningfulDraftChange(payload: unknown, baseline: unknown): boolean {
  return JSON.stringify(normalizeDraftPayload(payload)) !== JSON.stringify(normalizeDraftPayload(baseline));
}

export function toDraftSummary(record: BillDraftRecord): DraftSummary {
  return {
    draftKey: record.draftKey,
    type: record.payload.type,
    clientLabel: record.payload.clientName.trim() || 'Untitled client',
    numberLabel: record.payload.requestedBillNumber.trim() || 'Number assigned on creation',
    updatedAt: record.updatedAt,
    itemCount: record.payload.items.length
  };
}
