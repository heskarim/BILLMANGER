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

export function parseBillIds(value: string | null, max = 20): number[] {
  if (!value || !value.trim()) {
    throw new Error('Select at least one document');
  }

  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new Error('Select at least one document');
  if (unique.length > max) throw new Error(`You can download at most ${max} documents at once`);
  return unique;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (cause) {
    throw new Error(
      'Chromium could not start. Install the matching browser with "npx playwright install chromium".',
      { cause }
    );
  }
}

async function renderPdfWithBrowser(browser: Awaited<ReturnType<typeof chromium.launch>>, url: string): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`Printable bill page returned HTTP ${response?.status() ?? 'unknown'}`);
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
  } finally {
    await page.close();
  }
}

export async function renderPdf(url: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    return await renderPdfWithBrowser(browser, url);
  } finally {
    await browser.close();
  }
}

export async function renderPdfs(urls: string[]): Promise<Buffer[]> {
  if (urls.length === 0) return [];
  const browser = await launchBrowser();
  try {
    const buffers: Buffer[] = [];
    for (const url of urls) {
      buffers.push(await renderPdfWithBrowser(browser, url));
    }
    return buffers;
  } finally {
    await browser.close();
  }
}
