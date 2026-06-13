/**
 * /api/bills/[id]/export
 * GET → returns a .xlsx file for a single bill, including header info and all line items.
 */

import * as XLSX from 'xlsx';
import { getBillById, getSettings } from '$lib/server/db';
import type { RequestHandler } from './$types';

const TYPE_LABEL: Record<string, string> = {
  facture: 'FACTURE',
  proforma: 'FACTURE PROFORMA',
  livraison: 'BON DE LIVRAISON',
};

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : iso;
}

function fmtNumber(n: number): string {
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid bill id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = getBillById(id);
  if (!result) {
    return new Response(JSON.stringify({ error: 'Bill not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const settings = getSettings();
  const { bill, items } = result;

  // Build header rows (a single block of metadata, then items table, then totals)
  const aoa: (string | number)[][] = [
    [settings.company_name || ''],
    [settings.address || ''],
    [`Tél: ${settings.phone || ''}  -  Email: ${settings.email || ''}`],
    [],
    [`${TYPE_LABEL[bill.type] || bill.type}  N° ${bill.bill_number}`],
    [],
    ['Date', fmtDate(bill.date), '', 'Contrat N°', bill.contract_number || ''],
    ['', '', '', 'du', bill.contract_date ? fmtDate(bill.contract_date) : ''],
    [],
    ['Client', bill.client_name_snapshot],
    ['Code Client', bill.client_code_snapshot || ''],
    ['Adresse', bill.client_address_snapshot || ''],
    [],
    ['N°', 'Désignation / Produit', 'Unité', 'P.U.', 'Qté.', 'Total'],
  ];

  items.forEach((item, idx) => {
    aoa.push([
      idx + 1,
      item.product_name,
      item.unit,
      Number(item.unit_price),
      Number(item.quantity),
      Number(item.total_price),
    ]);
  });

  // Totals
  aoa.push([]);
  if (bill.type !== 'livraison') {
    aoa.push(['', '', '', '', 'Montant HT', Number(bill.montant_ht)]);
    if (bill.tva_rate > 0) aoa.push(['', '', '', '', `TVA (${bill.tva_rate}%)`, '']);
    aoa.push(['', '', '', '', 'Montant TTC', Number(bill.montant_ttc)]);
    aoa.push([]);
    aoa.push(['Arrêtée à la somme de :', bill.amount_in_words || '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // N°
    { wch: 50 },  // Désignation
    { wch: 8 },   // Unité
    { wch: 14 },  // P.U.
    { wch: 10 },  // Qté.
    { wch: 16 },  // Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, bill.bill_number);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${bill.bill_number}.xlsx"`,
    },
  });
};
