import { getBillById, getSettings, updateBill } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(400, 'Invalid bill ID');
  }

  const result = getBillById(id);
  if (!result) {
    throw error(404, 'Bill not found');
  }

  const settings = getSettings();

  return {
    bill: result.bill,
    items: result.items,
    settings
  };
};

export const actions: Actions = {
  updateBill: async ({ params, request }) => {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return fail(400, { error: 'Invalid bill ID' });
    }

    const data = await request.formData();
    
    const bill_number = data.get('bill_number') as string;
    const type = data.get('type') as 'facture' | 'proforma' | 'livraison';
    const date = data.get('date') as string;
    const contract_number = data.get('contract_number') as string || '';
    const contract_date = data.get('contract_date') as string || '';
    
    const client_code = data.get('client_code') as string || '';
    const client_name = data.get('client_name') as string || '';
    const client_address = data.get('client_address') as string || '';
    
    const tva_rate = parseFloat(data.get('tva_rate') as string || '0');
    const montant_ht = parseFloat(data.get('montant_ht') as string || '0');
    const montant_ttc = parseFloat(data.get('montant_ttc') as string || '0');
    const amount_in_words = data.get('amount_in_words') as string || '';
    const notes = data.get('notes') as string || '';
    
    const itemsJson = data.get('items') as string;

    // Validation checks
    if (!bill_number || !type || !client_name) {
      return fail(400, {
        error: 'Bill Number, Document Type, and Client Name are required.',
        values: { bill_number, type, date, client_name }
      });
    }

    let items = [];
    try {
      items = JSON.parse(itemsJson);
      if (!Array.isArray(items) || items.length === 0) {
        return fail(400, {
          error: 'At least one line item is required.',
          values: { bill_number, type, date, client_name }
        });
      }
    } catch (e) {
      return fail(400, {
        error: 'Invalid items formatting.',
        values: { bill_number, type, date, client_name }
      });
    }

    try {
      updateBill(id, {
        bill_number,
        type,
        date,
        contract_number,
        contract_date,
        client_name_snapshot: client_name,
        client_address_snapshot: client_address,
        client_code_snapshot: client_code,
        tva_rate,
        montant_ht,
        montant_ttc,
        amount_in_words,
        notes: type === 'livraison' ? notes : ''
      }, items.map((item: any, idx: number) => ({
        product_name: item.product_name,
        unit: item.unit || 'UN',
        quantity: parseFloat(item.quantity) || 0,
        unit_price: type === 'livraison' ? 0 : (parseFloat(item.unit_price) || 0),
        total_price: type === 'livraison' ? 0 : (parseFloat(item.total_price) || 0),
        sort_order: idx + 1
      })));
    } catch (err: any) {
      console.error('Error updating bill in db:', err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return fail(400, {
          error: `Document number "${bill_number}" already exists. Please choose a unique number.`,
          values: { bill_number, type, date, client_name }
        });
      }
      return fail(500, {
        error: `Failed to save changes: ${err.message}`,
        values: { bill_number, type, date, client_name }
      });
    }

    // Redirect back to print preview page on success
    throw redirect(303, `/bills/${id}`);
  }
};
