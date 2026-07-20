/**
 * /api/bills/export
 * GET → returns a .xlsx file containing ALL bills.
 *       One row per line item; bill number / type / client / date are
 *       repeated for each item so a single sheet is filter-friendly.
 *       A second "Summary" sheet holds one row per bill with totals.
 */

import * as XLSX from 'xlsx';
import Database from 'better-sqlite3';
import { join } from 'path';
import type { RequestHandler } from './$types';

const TYPE_LABEL: Record<string, string> = {
  facture: 'Facture',
  proforma: 'Proforma',
  livraison: 'Bon de Livraison',
};

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
}

export const GET: RequestHandler = async () => {
  const db = new Database(join(process.cwd(), 'billing.db'));
  db.pragma('foreign_keys = ON');

  // Per-line-item detail
  const items = db.prepare(`
    SELECT b.bill_number, b.type, b.date,
           b.client_name_snapshot AS client, b.client_code_snapshot AS client_code,
           bi.sort_order AS line, bi.product_name, bi.unit,
           bi.quantity, bi.unit_price, bi.total_price,
           b.tva_rate, b.montant_ht, b.montant_ttc
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    ORDER BY b.created_at DESC, bi.sort_order ASC
  `).all() as any[];

  // Per-bill summary
  const bills = db.prepare(`
    SELECT id, bill_number, type, date, contract_number, contract_date,
           client_name_snapshot AS client, client_code_snapshot AS client_code,
           tva_rate, montant_ht, montant_ttc, created_at
    FROM bills
    ORDER BY created_at DESC
  `).all() as any[];

  db.close();

  // ---- Sheet 1: All line items ----
  const itemsHeader = [
    'N° Document', 'Type', 'Date', 'Client', 'Code Client',
    'Ligne', 'Désignation', 'Unité', 'Quantité', 'P.U.', 'Total ligne',
    'TVA %', 'Montant HT', 'Montant TTC',
  ];
  const itemsAoa: (string | number)[][] = [itemsHeader];
  for (const r of items) {
    itemsAoa.push([
      r.bill_number,
      TYPE_LABEL[r.type] || r.type,
      fmtDate(r.date),
      r.client || '',
      r.client_code || '',
      r.line,
      r.product_name || '',
      r.unit || '',
      Number(r.quantity),
      Number(r.unit_price),
      Number(r.total_price),
      Number(r.tva_rate),
      Number(r.montant_ht),
      Number(r.montant_ttc),
    ]);
  }
  const wsItems = XLSX.utils.aoa_to_sheet(itemsAoa);
  wsItems['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
    { wch: 6 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
    { wch: 8 }, { wch: 14 }, { wch: 16 },
  ];
  // Freeze the header row
  wsItems['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsItems['!autofilter'] = { ref: `A1:N${itemsAoa.length}` };

  // ---- Sheet 2: Summary (one row per bill) ----
  const sumHeader = [
    'N° Document', 'Type', 'Date', 'Client', 'Code Client',
    'Contrat N°', 'Date Contrat', 'TVA %', 'Montant HT', 'Montant TTC', 'Créé le',
  ];
  const sumAoa: (string | number)[][] = [sumHeader];
  for (const b of bills) {
    sumAoa.push([
      b.bill_number,
      TYPE_LABEL[b.type] || b.type,
      fmtDate(b.date),
      b.client || '',
      b.client_code || '',
      b.contract_number || '',
      b.contract_date ? fmtDate(b.contract_date) : '',
      Number(b.tva_rate),
      Number(b.montant_ht),
      Number(b.montant_ttc),
      b.created_at || '',
    ]);
  }
  const wsSum = XLSX.utils.aoa_to_sheet(sumAoa);
  wsSum['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
  ];
  wsSum['!freeze'] = { xSplit: 0, ySplit: 1 };
  wsSum['!autofilter'] = { ref: `A1:K${sumAoa.length}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsItems, 'Lignes');
  XLSX.utils.book_append_sheet(wb, wsSum, 'Résumé');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const stamp = new Date().toISOString().split('T')[0];

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bills_export_${stamp}.xlsx"`,
    },
  });
};
