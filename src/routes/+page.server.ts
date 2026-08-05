import { getBills, deleteBill, getBillById, getNextBillNumber, createBill } from '$lib/server/db';
import { toDraftSummary } from '$lib/bill-drafts';
import { assertDraftKey, draftStore, DraftValidationError } from '$lib/server/bill-drafts';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  const bills = getBills();

  // Compute overall business statistics
  const totalInvoices = bills.filter(b => b.type === 'facture').length;
  const totalProformas = bills.filter(b => b.type === 'proforma').length;
  const totalLivraisons = bills.filter(b => b.type === 'livraison').length;

  const totalRevenue = bills
    .filter(b => b.type === 'facture')
    .reduce((sum, b) => sum + b.montant_ttc, 0);

  return {
    bills,
    drafts: draftStore.listDrafts().map(toDraftSummary),
    stats: {
      totalInvoices,
      totalProformas,
      totalLivraisons,
      totalRevenue
    }
  };
};

export const actions: Actions = {
  deleteDraft: async ({ request }) => {
    const data = await request.formData();
    const draftKey = data.get('draftKey');
    if (typeof draftKey !== 'string') return fail(400, { error: 'Invalid draft key' });
    try {
      assertDraftKey(draftKey);
      if (!draftStore.deleteDraft(draftKey)) return fail(404, { error: 'Draft not found' });
      return { success: true };
    } catch (error) {
      if (error instanceof DraftValidationError) return fail(400, { error: 'Invalid draft key' });
      console.error('Failed to delete bill draft', { draftKey, error: error instanceof Error ? error.name : 'UnknownError' });
      return fail(500, { error: 'Failed to delete draft' });
    }
  },

  deleteBill: async ({ request }) => {
    const data = await request.formData();
    const id = parseInt(data.get('id') as string, 10);
    
    if (isNaN(id)) {
      return fail(400, { error: 'Invalid bill ID' });
    }

    try {
      deleteBill(id);
      return { success: true };
    } catch (err: any) {
      return fail(500, { error: `Failed to delete bill: ${err.message}` });
    }
  },

  duplicateBill: async ({ request }) => {
    const data = await request.formData();
    const id = parseInt(data.get('id') as string, 10);

    if (isNaN(id)) {
      return fail(400, { error: 'Invalid bill ID' });
    }

    const result = getBillById(id);
    if (!result) {
      return fail(404, { error: 'Original bill not found' });
    }

    try {
      const nextNumber = getNextBillNumber(result.bill.type);
      const newBill = createBill({
        ...result.bill,
        bill_number: nextNumber,
        date: new Date().toISOString().split('T')[0],
        source_draft_key: null,
      }, result.items.map(item => ({
        product_name: item.product_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        sort_order: item.sort_order
      })));

      return { success: true, duplicatedId: newBill.id };
    } catch (err: any) {
      console.error(err);
      return fail(500, { error: `Failed to duplicate bill: ${err.message}` });
    }
  }
};
