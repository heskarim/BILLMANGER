import { chromium } from 'playwright';

export const DOCUMENT_TYPES = ['facture', 'proforma', 'livraison'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type PdfMode = 'saved' | 'bundle';

export function parsePdfMode(value: string | null): PdfMode {
  if (value === 'saved' || value === 'bundle') return value;
  throw new Error('Unsupported PDF mode');
}

export function parseDocumentTypes(
  mode: PdfMode,
  value: string | null,
  savedType: DocumentType
): DocumentType[] {
  if (mode === 'saved') return [savedType];
  if (value === null) return [...DOCUMENT_TYPES];

  const selected = new Set(value.split(','));
  const ordered = DOCUMENT_TYPES.filter((type) => selected.has(type));
  if (ordered.length === 0) {
    throw new Error('Select at least one document type');
  }

  return ordered;
}

export function buildPdfFilename(
  type: DocumentType,
  billNumber: string,
  mode: PdfMode
): string {
  const safeNumber = billNumber
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '') || 'document';
  const prefix = mode === 'bundle'
    ? 'Bundle'
    : type === 'facture'
      ? 'Facture'
      : type === 'proforma'
        ? 'Proforma'
        : 'Bon-de-Livraison';

  return `${prefix}_${safeNumber}.pdf`;
}

export async function renderPdf(url: string): Promise<Buffer> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (cause) {
    throw new Error(
      'Chromium could not start. Install the matching browser with "npx playwright install chromium".',
      { cause }
    );
  }

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`Printable bill page returned HTTP ${response?.status() ?? 'unknown'}`);
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    return buffer;
  } finally {
    await browser.close();
  }
}
