import { json } from '@sveltejs/kit';
import { getNextBillNumber } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const type = url.searchParams.get('type') as 'facture' | 'proforma' | 'livraison' | null;
  
  if (!type || !['facture', 'proforma', 'livraison'].includes(type)) {
    return json({ error: 'Invalid or missing document type' }, { status: 400 });
  }

  try {
    const nextNumber = getNextBillNumber(type);
    return json({ number: nextNumber });
  } catch (err) {
    console.error('API next-bill-number error:', err);
    return json({ error: 'Failed to generate next number' }, { status: 500 });
  }
};
