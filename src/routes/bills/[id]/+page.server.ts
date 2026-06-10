import { getBillById, getSettings, deleteBill, createBill, getNextBillNumber } from '$lib/server/db';
import { error, redirect, fail } from '@sveltejs/kit';
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
  deleteBill: async ({ params }) => {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return fail(400, { error: 'Invalid bill ID' });
    }

    try {
      deleteBill(id);
    } catch (err: any) {
      return fail(500, { error: `Failed to delete bill: ${err.message}` });
    }

    throw redirect(303, '/');
  },

  duplicateBill: async ({ params }) => {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return fail(400, { error: 'Invalid bill ID' });
    }

    const result = getBillById(id);
    if (!result) {
      return fail(404, { error: 'Original bill not found' });
    }

    try {
      // 1. Determine next bill number for duplicate type
      const nextNumber = getNextBillNumber(result.bill.type);
      
      // 2. Clone it and save as a new bill
      const newBill = createBill({
        ...result.bill,
        bill_number: nextNumber,
        date: new Date().toISOString().split('T')[0],
      }, result.items.map(item => ({
        product_name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        sort_order: item.sort_order
      })));

      throw redirect(303, `/bills/${newBill.id}`);
    } catch (err: any) {
      if (err.status === 303) {
        throw err; // Allow redirect to happen
      }
      return fail(500, { error: `Failed to duplicate bill: ${err.message}` });
    }
  }
};
