import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPdfFilename,
  parseDocumentTypes,
  parsePdfMode
} from './pdf-renderer';

test('sanitizes saved invoice PDF filenames', () => {
  assert.equal(buildPdfFilename('facture', '2025/0009', 'saved'), 'Facture_2025-0009.pdf');
});

test('uses the saved delivery-note filename prefix', () => {
  assert.equal(
    buildPdfFilename('livraison', '2025/0009', 'saved'),
    'Bon-de-Livraison_2025-0009.pdf'
  );
});

test('uses bundle filename in bundle mode', () => {
  assert.equal(buildPdfFilename('facture', '2025/0009', 'bundle'), 'Bundle_2025-0009.pdf');
});

test('sanitizes unsafe filename characters and trims separators', () => {
  assert.equal(buildPdfFilename('proforma', '../../ 2025/0009 ', 'saved'), 'Proforma_2025-0009.pdf');
});

test('rejects unsupported modes', () => {
  assert.throws(() => parsePdfMode('other'), /Unsupported PDF mode/);
});

test('defaults dashboard bundles to all three document types', () => {
  assert.deepEqual(parseDocumentTypes('bundle', null, 'facture'), [
    'facture',
    'proforma',
    'livraison'
  ]);
});

test('canonicalizes and de-duplicates selected detail bundle types', () => {
  assert.deepEqual(parseDocumentTypes('bundle', 'livraison,facture,livraison', 'proforma'), [
    'facture',
    'livraison'
  ]);
});

test('saved mode ignores selected types', () => {
  assert.deepEqual(parseDocumentTypes('saved', 'livraison', 'proforma'), ['proforma']);
});

test('rejects a bundle with no valid selected type', () => {
  assert.throws(
    () => parseDocumentTypes('bundle', 'unknown', 'facture'),
    /Select at least one document type/
  );
});

test('parses unique positive bill ids and rejects empty or oversized selections', async () => {
  const { parseBillIds } = await import('./pdf-renderer.js');
  assert.deepEqual(parseBillIds('3,1,3,2'), [3, 1, 2]);
  assert.throws(() => parseBillIds(''), /Select at least one document/);
  assert.throws(() => parseBillIds('a,b'), /Select at least one document/);
  assert.throws(
    () => parseBillIds(Array.from({ length: 21 }, (_, i) => i + 1).join(',')),
    /at most 20/
  );
});
