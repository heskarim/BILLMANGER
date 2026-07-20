import { getBillById } from '$lib/server/db';
import {
  buildPdfFilename,
  parseDocumentTypes,
  parsePdfMode,
  renderPdf
} from '$lib/server/pdf-renderer';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid bill ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let mode;
  try {
    mode = parsePdfMode(url.searchParams.get('mode'));
  } catch {
    return new Response(JSON.stringify({ error: 'Unsupported PDF mode' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const result = getBillById(id);
  if (!result) {
    return new Response(JSON.stringify({ error: 'Bill not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  let documentTypes;
  try {
    documentTypes = parseDocumentTypes(mode, url.searchParams.get('types'), result.bill.type);
  } catch (cause) {
    return new Response(JSON.stringify({ error: cause instanceof Error ? cause.message : 'Invalid document types' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const renderUrl = new URL(`/bills/${id}/pdf`, url.origin);
  renderUrl.searchParams.set('mode', mode);
  renderUrl.searchParams.set('types', documentTypes.join(','));

  try {
    const pdf = await renderPdf(renderUrl.toString());
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildPdfFilename(result.bill.type, result.bill.bill_number, mode)}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (cause) {
    console.error('Failed to render PDF', cause);
    return new Response(JSON.stringify({ error: 'Failed to render PDF' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
};
