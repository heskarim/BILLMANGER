import XLSX from 'xlsx-js-style';
import type { Bill, BillItem, SellerSettings } from './db';

export type BillDocumentType = 'facture' | 'proforma' | 'livraison';

export interface BillExportInput {
  bill: Bill;
  items: BillItem[];
  settings: SellerSettings;
}

type StyledCell = XLSX.CellObject & {
  s?: {
    font?: Record<string, unknown>;
    fill?: Record<string, unknown>;
    alignment?: Record<string, unknown>;
    border?: Record<string, unknown>;
    numFmt?: string;
  };
};

const TYPE_LABEL: Record<BillDocumentType, string> = {
  facture: 'FACTURE',
  proforma: 'FACTURE PROFORMA',
  livraison: 'BON DE LIVRAISON',
};

const DARK = '1A1A2E';
const LIGHT = 'F0F0F5';
const BORDER = '1A1A2E';
const MONEY_FORMAT = '#,##0.00';
const QUANTITY_FORMAT = '0.####';

const thinBorder = {
  top: { style: 'thin', color: { rgb: BORDER } },
  bottom: { style: 'thin', color: { rgb: BORDER } },
  left: { style: 'thin', color: { rgb: BORDER } },
  right: { style: 'thin', color: { rgb: BORDER } },
};

function address(row: number, column: number): string {
  return XLSX.utils.encode_cell({ r: row - 1, c: column - 1 });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function documentTitle(type: BillDocumentType, number: string): string {
  return `${TYPE_LABEL[type]} N° ${number}`;
}

function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  column: number,
  value: string | number,
  style?: StyledCell['s'],
): void {
  const cellAddress = address(row, column);
  const cell: StyledCell = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
  };
  if (style) cell.s = style;
  ws[cellAddress] = cell;
}

function merge(ws: XLSX.WorkSheet, startRow: number, startColumn: number, endRow: number, endColumn: number): void {
  ws['!merges'] ??= [];
  ws['!merges'].push({
    s: { r: startRow - 1, c: startColumn - 1 },
    e: { r: endRow - 1, c: endColumn - 1 },
  });
}

function styleRange(
  ws: XLSX.WorkSheet,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
  style: StyledCell['s'],
): void {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cellAddress = address(row, column);
      const cell = (ws[cellAddress] ??= { v: '', t: 's' }) as StyledCell;
      cell.s = { ...(cell.s ?? {}), ...style };
    }
  }
}

function setRowHeight(ws: XLSX.WorkSheet, row: number, height: number): void {
  ws['!rows'] ??= [];
  ws['!rows'][row - 1] = { hpt: height };
}

function wrappedDescriptionHeight(value: string): number {
  const lines = Math.max(1, Math.ceil(value.length / 62));
  return Math.min(90, Math.max(22, lines * 15));
}

function addPageBreak(ws: XLSX.WorkSheet, row: number): void {
  const breaks = (ws as XLSX.WorkSheet & { '!rowBreaks'?: Array<{ id: number }> })['!rowBreaks'] ?? [];
  breaks.push({ id: row });
  (ws as XLSX.WorkSheet & { '!rowBreaks'?: Array<{ id: number }> })['!rowBreaks'] = breaks;
}

function addMetadataBlock(
  ws: XLSX.WorkSheet,
  row: number,
  bill: Bill,
  settings: SellerSettings,
  pageIndex: number,
  pageCount: number,
  compact: boolean,
): number {
  if (!compact) {
    setCell(ws, row, 2, settings.company_name || '');
    merge(ws, row, 2, row, 6);
    setCell(ws, row + 1, 2, settings.address || '');
    merge(ws, row + 1, 2, row + 1, 6);
    setCell(ws, row + 2, 2, `Tél: ${settings.phone || ''}  -  Email: ${settings.email || ''}`);
    merge(ws, row + 2, 2, row + 2, 6);
    setCell(ws, row + 3, 2, `RC: ${settings.rc || '—'}`);
    setCell(ws, row + 3, 3, `ART: ${settings.art || '—'}`);
    merge(ws, row + 3, 3, row + 3, 4);
    setCell(ws, row + 3, 5, '');
    setCell(ws, row + 3, 6, '');
    setCell(ws, row + 4, 2, `NIF: ${settings.nif || '—'}`);
    setCell(ws, row + 4, 3, `NIS: ${settings.nis || '—'}`);
    merge(ws, row + 4, 3, row + 4, 4);
    setCell(ws, row + 5, 2, `RIB: ${settings.rib || '—'}`);
    merge(ws, row + 5, 2, row + 5, 6);
    styleRange(ws, row, 2, row + 5, 6, {
      font: { name: 'Arial', sz: 10, color: { rgb: '333333' } },
      alignment: { vertical: 'center', wrapText: true },
    });
    setRowHeight(ws, row, 24);
    setRowHeight(ws, row + 1, 22);
    setRowHeight(ws, row + 2, 20);
    setRowHeight(ws, row + 5, 24);
    row += 7;
  } else {
    setCell(ws, row, 2, `${settings.company_name || ''} — ${TYPE_LABEL[bill.type]}`);
    merge(ws, row, 2, row, 4);
    setCell(ws, row, 5, `N° ${bill.bill_number}`);
    merge(ws, row, 5, row, 6);
    styleRange(ws, row, 2, row, 6, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: DARK } },
      alignment: { vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: BORDER } } },
    });
    setRowHeight(ws, row, 22);
    row += 2;
  }

  setCell(ws, row, 1, documentTitle(bill.type, bill.bill_number));
  merge(ws, row, 1, row, 6);
  styleRange(ws, row, 1, row, 6, {
    font: { name: 'Arial', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  });
  setRowHeight(ws, row, 24);
  row += 1;

  setCell(ws, row, 1, `Date: ${formatDate(bill.date) || '—'}`);
  merge(ws, row, 1, row, 3);
  setCell(ws, row, 4, `Contrat N°: ${bill.contract_number || '—'}`);
  setCell(ws, row, 5, bill.contract_date ? `du ${formatDate(bill.contract_date)}` : '');
  merge(ws, row, 5, row, 6);
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  row += 1;

  setCell(ws, row, 1, `Code du client: ${bill.client_code_snapshot || '—'}`);
  merge(ws, row, 1, row, 6);
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  row += 1;
  setCell(ws, row, 1, `Nom: ${bill.client_name_snapshot || '—'}`);
  merge(ws, row, 1, row, 6);
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  row += 1;
  setCell(ws, row, 1, `Adresse: ${bill.client_address_snapshot || '—'}`);
  merge(ws, row, 1, row, 6);
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  setRowHeight(ws, row, 28);
  row += 2;

  setCell(ws, row, 1, `Page ${pageIndex + 1}/${pageCount} du ${TYPE_LABEL[bill.type].toLowerCase()} N°`);
  merge(ws, row, 1, row, 5);
  setCell(ws, row, 6, bill.bill_number);
  styleRange(ws, row, 1, row, 6, {
    font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '555555' } },
    alignment: { vertical: 'center' },
  });
  return row + 1;
}

function addTableHeader(ws: XLSX.WorkSheet, row: number, type: BillDocumentType): number {
  const headers = type === 'livraison'
    ? ['N°', 'Produit / Désignation', 'Unité', '', 'Qté.']
    : ['N°', 'Désignation / Produit', 'Unité', 'P.U.', 'Qté.', 'Total'];

  headers.forEach((header, index) => setCell(ws, row, index + 1, header));
  if (type === 'livraison') merge(ws, row, 2, row, 3);

  const lastColumn = type === 'livraison' ? 5 : 6;
  styleRange(ws, row, 1, row, lastColumn, {
    font: { name: 'Arial', sz: 9, bold: true, color: { rgb: DARK } },
    fill: { fgColor: { rgb: LIGHT } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  });
  setRowHeight(ws, row, 24);
  return row + 1;
}

function addItemRows(ws: XLSX.WorkSheet, row: number, items: BillItem[], startIndex: number, type: BillDocumentType): number {
  for (const [offset, item] of items.entries()) {
    const description = item.product_name || '';
    setCell(ws, row, 1, startIndex + offset + 1, { alignment: { horizontal: 'center', vertical: 'top' }, border: thinBorder });
    setCell(ws, row, 2, description, { alignment: { vertical: 'top', wrapText: true }, border: thinBorder });
    setCell(ws, row, 3, item.unit || '', { alignment: { horizontal: 'center', vertical: 'top' }, border: thinBorder });

    if (type === 'livraison') {
      setCell(ws, row, 4, '', { border: thinBorder });
      setCell(ws, row, 5, Number(item.quantity), { alignment: { horizontal: 'center', vertical: 'top' }, border: thinBorder, numFmt: QUANTITY_FORMAT });
    } else {
      setCell(ws, row, 4, Number(item.unit_price), { alignment: { horizontal: 'right', vertical: 'top' }, border: thinBorder, numFmt: MONEY_FORMAT });
      setCell(ws, row, 5, Number(item.quantity), { alignment: { horizontal: 'center', vertical: 'top' }, border: thinBorder, numFmt: QUANTITY_FORMAT });
      setCell(ws, row, 6, Number(item.total_price), { alignment: { horizontal: 'right', vertical: 'top' }, border: thinBorder, numFmt: MONEY_FORMAT });
    }
    setRowHeight(ws, row, wrappedDescriptionHeight(description));
    row += 1;
  }
  return row;
}

function addFinancialFooter(ws: XLSX.WorkSheet, row: number, bill: Bill): number {
  setCell(ws, row, 1, 'Facture arrêtée à la somme de:');
  merge(ws, row, 1, row, 4);
  setCell(ws, row, 5, 'Montant HT');
  setCell(ws, row, 6, Number(bill.montant_ht), { alignment: { horizontal: 'right' }, numFmt: MONEY_FORMAT });
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  row += 1;

  setCell(ws, row, 1, bill.amount_in_words || '');
  merge(ws, row, 1, row, 4);
  if (bill.tva_rate > 0) {
    setCell(ws, row, 5, `TVA (${bill.tva_rate}%)`);
    setCell(ws, row, 6, Number(bill.montant_ttc - bill.montant_ht), { alignment: { horizontal: 'right' }, numFmt: MONEY_FORMAT });
  }
  styleRange(ws, row, 1, row, 6, { border: thinBorder, alignment: { vertical: 'center', wrapText: true } });
  setRowHeight(ws, row, 34);
  row += 1;

  setCell(ws, row, 5, 'Montant TTC');
  setCell(ws, row, 6, Number(bill.montant_ttc), { alignment: { horizontal: 'right' }, numFmt: MONEY_FORMAT });
  styleRange(ws, row, 5, row, 6, {
    font: { bold: true, color: { rgb: DARK } },
    fill: { fgColor: { rgb: LIGHT } },
    border: thinBorder,
    alignment: { vertical: 'center' },
  });
  row += 2;
  setCell(ws, row, 5, 'Cachet & Signature');
  merge(ws, row, 5, row, 6);
  styleRange(ws, row, 5, row, 6, { font: { bold: true }, alignment: { horizontal: 'center' } });
  row += 1;
  merge(ws, row, 5, row + 3, 6);
  styleRange(ws, row, 5, row + 3, 6, { border: { ...thinBorder, bottom: { style: 'dashed', color: { rgb: '888888' } } } });
  return row + 4;
}

function addDeliveryFooter(ws: XLSX.WorkSheet, row: number, bill: Bill): number {
  if (bill.notes) {
    setCell(ws, row, 1, 'Observations / Remarques:');
    merge(ws, row, 1, row, 5);
    styleRange(ws, row, 1, row, 5, { font: { bold: true }, border: thinBorder, alignment: { wrapText: true } });
    row += 1;
    setCell(ws, row, 1, bill.notes);
    merge(ws, row, 1, row + 1, 5);
    styleRange(ws, row, 1, row + 1, 5, { border: thinBorder, alignment: { vertical: 'top', wrapText: true } });
    setRowHeight(ws, row, 30);
    row += 3;
  }
  setCell(ws, row, 1, 'Accusé de réception (Client)');
  merge(ws, row, 1, row, 2);
  setCell(ws, row, 4, 'Signature & Cachet (Fournisseur)');
  merge(ws, row, 4, row, 5);
  styleRange(ws, row, 1, row, 5, { font: { bold: true }, alignment: { horizontal: 'center' } });
  row += 3;
  styleRange(ws, row, 1, row, 2, { border: { bottom: { style: 'dashed', color: { rgb: '888888' } } } });
  styleRange(ws, row, 4, row, 5, { border: { bottom: { style: 'dashed', color: { rgb: '888888' } } } });
  return row + 2;
}

export function partitionBillItems(items: BillItem[], type: BillDocumentType): BillItem[][] {
  const firstPage = type === 'livraison' ? 17 : 12;
  const otherPage = type === 'livraison' ? 24 : 19;
  if (items.length <= firstPage) return [items];
  const pages: BillItem[][] = [items.slice(0, firstPage)];
  for (let index = firstPage; index < items.length; index += otherPage) {
    pages.push(items.slice(index, index + otherPage));
  }
  return pages;
}

export function buildSingleBillWorkbook({ bill, items, settings }: BillExportInput): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const worksheet: XLSX.WorkSheet = {};
  const pages = partitionBillItems(items, bill.type);
  const lastColumn = bill.type === 'livraison' ? 5 : 6;
  let row = 1;
  let itemOffset = 0;
  const pageBreaks: number[] = [];

  pages.forEach((pageItems, pageIndex) => {
    const pageStart = row;
    row = addMetadataBlock(worksheet, row, bill, settings, pageIndex, pages.length, pageIndex > 0);
    row = addTableHeader(worksheet, row, bill.type);
    row = addItemRows(worksheet, row, pageItems, itemOffset, bill.type);
    itemOffset += pageItems.length;

    if (pageIndex === pages.length - 1) {
      row += 1;
      row = bill.type === 'livraison' ? addDeliveryFooter(worksheet, row, bill) : addFinancialFooter(worksheet, row, bill);
    }

    pageBreaks.push(row - 1);
    if (pageIndex < pages.length - 1) {
      row += 2;
    }
    if (row - pageStart > 48) {
      setRowHeight(worksheet, pageStart, 24);
    }
  });

  worksheet['!ref'] = `A1:${XLSX.utils.encode_col(lastColumn - 1)}${row - 1}`;
  worksheet['!cols'] = bill.type === 'livraison'
    ? [{ wch: 7 }, { wch: 68 }, { wch: 12 }, { wch: 4 }, { wch: 12 }, { wch: 2 }]
    : [{ wch: 7 }, { wch: 56 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 17 }];
  worksheet['!freeze'] = { xSplit: 0, ySplit: 0 };
  worksheet['!printArea'] = `A1:${XLSX.utils.encode_col(lastColumn - 1)}${row - 1}`;
  worksheet['!margins'] = { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 };
  worksheet['!pageSetup'] = { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, scale: 100 };
  (worksheet as XLSX.WorkSheet & { '!rowBreaks'?: Array<{ id: number }> })['!rowBreaks'] = pageBreaks.map((id) => ({ id }));

  XLSX.utils.book_append_sheet(workbook, worksheet, bill.bill_number.slice(0, 31) || 'Document');
  return workbook;
}
