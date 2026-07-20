import JSZip from 'jszip';
import { getBillById } from '$lib/server/db';
import {
  buildPdfFilename,
  parseBillIds,
  parseDocumentTypes,
  parsePdfMode,
  renderPdfs,
  type DocumentType
} from '$lib/server/pdf-renderer';
import type { RequestHandler } from './$types';

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const GET: RequestHandler = async ({ url }) => {
  let mode;
  let ids: number[];

  try {
    mode = parsePdfMode(url.searchParams.get('mode') ?? 'saved');
    ids = parseBillIds(url.searchParams.get('ids'));
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : 'Invalid bulk download request', 400);
  }

  const bills: Array<{
    id: number;
    type: DocumentType;
    billNumber: string;
    documentTypes: DocumentType[];
  }> = [];

  for (const id of ids) {
    const result = getBillById(id);
    if (!result) return jsonError(`Bill ${id} was not found`, 404);

    let documentTypes: DocumentType[];
    try {
      documentTypes = parseDocumentTypes(mode, mode === 'bundle' ? null : null, result.bill.type);
    } catch (cause) {
      return jsonError(cause instanceof Error ? cause.message : 'Invalid document types', 400);
    }

    bills.push({
      id,
      type: result.bill.type,
      billNumber: result.bill.bill_number,
      documentTypes
    });
  }

  const renderUrls = bills.map((bill) => {
    const renderUrl = new URL(`/bills/${bill.id}/pdf`, url.origin);
    renderUrl.searchParams.set('mode', mode);
    renderUrl.searchParams.set('types', bill.documentTypes.join(','));
    return renderUrl.toString();
  });

  try {
    const pdfs = await renderPdfs(renderUrls);
    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    bills.forEach((bill, index) => {
      let filename = buildPdfFilename(bill.type, bill.billNumber, mode);
      const count = usedNames.get(filename) ?? 0;
      usedNames.set(filename, count + 1);
      if (count > 0) {
        filename = filename.replace(/\.pdf$/i, `-${count + 1}.pdf`);
      }
      zip.file(filename, pdfs[index]);
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const stamp = new Date().toISOString().slice(0, 10);
    const zipName =
      mode === 'bundle'
        ? `bill-bundles_${stamp}.zip`
        : `bill-pdfs_${stamp}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (cause) {
    console.error('Failed to render bulk PDFs', cause);
    return jsonError('Failed to render selected PDFs', 500);
  }
};
