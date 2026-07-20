/**
 * /api/bills/[id]/export
 * GET → returns a document-shaped .xlsx file for a single bill.
 */

import XLSX from 'xlsx-js-style';
import { getBillById, getSettings } from '$lib/server/db';
import { buildSingleBillWorkbook } from '$lib/server/bill-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) {
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

  const workbook = buildSingleBillWorkbook({
    bill: result.bill,
    items: result.items,
    settings: getSettings(),
  });
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${result.bill.bill_number}.xlsx"`,
    },
  });
};
