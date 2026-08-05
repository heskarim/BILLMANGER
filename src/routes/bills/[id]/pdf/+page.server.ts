import { getBillById, getSettings } from '$lib/server/db';
import { parseDocumentTypes, parsePdfMode } from '$lib/server/pdf-renderer';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid bill ID');

  let mode;
  try {
    mode = parsePdfMode(url.searchParams.get('mode'));
  } catch {
    throw error(400, 'Unsupported PDF mode');
  }

  const result = getBillById(id);
  if (!result) throw error(404, 'Bill not found');

  let documentTypes;
  try {
    documentTypes = parseDocumentTypes(mode, url.searchParams.get('types'), result.bill.type);
  } catch (cause) {
    throw error(400, cause instanceof Error ? cause.message : 'Invalid document types');
  }

  return {
    bill: result.bill,
    items: result.items,
    settings: getSettings(),
    documentTypes
  };
};
