<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    Printer,
    Trash2,
    Copy,
    ArrowLeft,
    Edit,
    Receipt,
    FileText,
    Truck,
    FileSpreadsheet
  } from '@lucide/svelte';

  let { data } = $props();

  // Extract variables
  const bill = $derived(data.bill);
  const items = $derived(data.items);
  const settings = $derived(data.settings);

  // Print bundle selections (reactive)
  let printInvoice = $state(bill.type === 'facture');
  let printProforma = $state(bill.type === 'proforma');
  let printLivraison = $state(bill.type === 'livraison');

  // Compute a list of active document types to print
  let printBundle = $derived.by(() => {
    const list: ('facture' | 'proforma' | 'livraison')[] = [];
    if (printInvoice) list.push('facture');
    if (printProforma) list.push('proforma');
    if (printLivraison) list.push('livraison');
    return list;
  });

  // ----------------------------------------------------
  // PAGINATION CHUNKING LOGIC
  // ----------------------------------------------------
  function partitionItems(itemsList: typeof items, isLivraison: boolean) {
    const page1MaxWithFooter = 14;
    const page1MaxWithoutFooter = 20;
    const otherPageMaxWithFooter = 25;
    const otherPageMaxWithoutFooter = 33;

    if (itemsList.length <= page1MaxWithFooter) {
      return [itemsList];
    }

    const pages = [];
    if (itemsList.length <= page1MaxWithoutFooter) {
      pages.push(itemsList.slice(0, page1MaxWithFooter));
      pages.push(itemsList.slice(page1MaxWithFooter));
      return pages;
    }

    pages.push(itemsList.slice(0, page1MaxWithoutFooter));
    let idx = page1MaxWithoutFooter;

    while (idx < itemsList.length) {
      const remaining = itemsList.length - idx;
      if (remaining <= otherPageMaxWithFooter) {
        pages.push(itemsList.slice(idx));
        idx = itemsList.length;
      } else if (remaining <= otherPageMaxWithoutFooter) {
        pages.push(itemsList.slice(idx, idx + otherPageMaxWithFooter));
        idx += otherPageMaxWithFooter;
      } else {
        pages.push(itemsList.slice(idx, idx + otherPageMaxWithoutFooter));
        idx += otherPageMaxWithoutFooter;
      }
    }
    return pages;
  }

  // Calculate running totals for each page to display "Report" carryovers
  function getPageTotals(pagesList: typeof items[], pageIdx: number): { pageSum: number; runningSum: number } {
    let pageSum = 0;
    const pageItems = pagesList[pageIdx] || [];
    for (const item of pageItems) {
      pageSum += item.total_price;
    }

    let runningSum = 0;
    for (let i = 0; i <= pageIdx; i++) {
      const pItems = pagesList[i] || [];
      for (const item of pItems) {
        runningSum += item.total_price;
      }
    }

    return { pageSum, runningSum };
  }

  // Capitalize the first letter (display-only — saved email is untouched)
  function capitalizeFirst(str: string | null | undefined): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Helper to format date
  function formatDate(dStr: string): string {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
      }
      return dStr;
    } catch {
      return dStr;
    }
  }

  // Trigger browser print dialog
  function triggerPrint() {
    window.print();
  }
</script>

<!-- Screen Operations Bar (Hidden during Print) -->
<div class="actions-bar no-print animate-in">
  <div class="left-actions">
    <a href="/" class="btn btn-secondary">
      <ArrowLeft size={16} />
      <span>Back to Logs</span>
    </a>
  </div>

  <div class="bundle-selector no-print">
    <span class="bundle-label">Include in PDF Bundle:</span>
    <label class="bundle-checkbox">
      <input type="checkbox" bind:checked={printInvoice} />
      <span>Facture (Invoice)</span>
    </label>
    <label class="bundle-checkbox">
      <input type="checkbox" bind:checked={printProforma} />
      <span>Proforma</span>
    </label>
    <label class="bundle-checkbox">
      <input type="checkbox" bind:checked={printLivraison} />
      <span>Bon de Livraison</span>
    </label>
  </div>
  
  <div class="right-actions">
    <a href="/bills/{bill.id}/edit" class="btn btn-secondary">
      <Edit size={16} />
      <span>Edit</span>
    </a>

    <form method="POST" action="?/duplicateBill" use:enhance>
      <button type="submit" class="btn btn-secondary">
        <Copy size={16} />
        <span>Duplicate</span>
      </button>
    </form>

    <button onclick={triggerPrint} class="btn btn-primary print-btn" disabled={printBundle.length === 0}>
      <Printer size={16} />
      <span>{printBundle.length > 1 ? 'Print Bundle' : 'Print / PDF'}</span>
    </button>

    <a href="/api/bills/{bill.id}/export" class="btn btn-secondary export-btn" title="Export this bill as Excel">
      <FileSpreadsheet size={16} />
      <span>Export XLSX</span>
    </a>

    <form method="POST" action="?/deleteBill" use:enhance
      onsubmit={(e) => {
        if (!confirm('Are you sure you want to permanently delete this billing document?')) {
          e.preventDefault();
        }
      }}>
      <button type="submit" class="btn btn-danger">
        <Trash2 size={16} />
        <span>Delete</span>
      </button>
    </form>
  </div>
</div>

<!-- printable document wrapper -->
<div class="print-container">
  
  {#each printBundle as docType, bundleIdx}
    {@const currentPages = partitionItems(items, docType === 'livraison')}
    {#each currentPages as pageItems, pageIdx (pageIdx)}
      <!-- A4 Sheet wrapper -->
      <div class="a4-page">
        
        <!-- PAGE HEADER: Repeated on Page 1, minimal on subsequent pages -->
        {#if pageIdx === 0}
          <!-- ============================================= -->
          <!-- REDESIGNED A4 HEADER                         -->
          <!-- ============================================= -->
          <header class="doc-header">
            <div class="company-row-split">
              <div class="company-left">
                {#if settings?.logo}
                  <div class="logo-frame">
                    <img src={settings.logo} alt="Company Logo" class="document-logo" />
                  </div>
                {/if}
                <div class="company-identity">
                  <h1 class="company-title">{settings?.company_name || 'TECH IP'}</h1>
                  {#if settings?.address}
                    <p class="company-detail">{settings.address}</p>
                  {/if}
                  <p class="company-contact"><strong>Tél:</strong> {settings?.phone || '—'}</p>
                  {#if settings?.email}
                    <p class="company-contact"><strong>Email:</strong> {capitalizeFirst(settings.email)}</p>
                  {/if}
                </div>
              </div>
              <div class="company-right-reg">
                <div><strong>RC:</strong> {settings?.rc || '—'}</div>
                <div><strong>NIF:</strong> {settings?.nif || '—'}</div>
                <div><strong>NIS:</strong> {settings?.nis || '—'}</div>
                {#if settings?.art}<div><strong>ART:</strong> {settings.art}</div>{/if}
                <div class="company-rib"><strong>RIB:</strong> {settings?.rib || '—'}</div>
              </div>
            </div>
          </header>

          <!-- Unified Metadata & Client Table -->
          <table class="doc-meta-table">
            <thead>
              <tr>
                <th colspan="2" class="doc-title-th">
                  {#if docType === 'facture'}
                    FACTURE
                  {:else if docType === 'proforma'}
                    FACTURE PROFORMA
                  {:else}
                    BON DE LIVRAISON
                  {/if}
                  N° {bill.bill_number}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="width: 50%;"><strong>Date:</strong> {formatDate(bill.date) || '—'}</td>
                <td style="width: 50%;">
                  {#if bill.contract_number}
                    <strong>Contrat N°:</strong> {bill.contract_number} {#if bill.contract_date}du {formatDate(bill.contract_date)}{/if}
                  {:else}
                    <strong>Contrat:</strong> —
                  {/if}
                </td>
              </tr>
              <tr>
                <td><strong>Client:</strong> {bill.client_name_snapshot}</td>
                <td><strong>Code Client:</strong> {bill.client_code_snapshot || '—'}</td>
              </tr>
              {#if bill.client_address_snapshot}
                <tr>
                  <td colspan="2"><strong>Adresse:</strong> {bill.client_address_snapshot}</td>
                </tr>
              {/if}
            </tbody>
          </table>
        {:else}
          <!-- Subsequent Pages Header (Minimal carryover header) -->
          <header class="doc-header-minimal">
            <div class="minimal-left">
              <span class="company-name-small">{settings?.company_name || 'TECH IP'}</span>
              <span class="doc-ref-small">
                {docType === 'facture' ? 'Facture' : docType === 'proforma' ? 'Proforma' : 'Bon de livraison'} N°: {bill.bill_number}
              </span>
            </div>
            <div class="minimal-right">
              <span>Page {pageIdx + 1}/{currentPages.length}</span>
            </div>
          </header>
        {/if}

        <!-- Page Number Indicator -->
        <div class="page-indicator">
          <span class="page-indicator-line"></span>
          <span class="page-indicator-text">
            Page {pageIdx + 1} / {currentPages.length}
          </span>
          <span class="page-indicator-line"></span>
        </div>

        <!-- ITEMS TABLE FOR THIS CHUNK -->
        <div class="table-container">
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 5%;">N°</th>
                <th style="width: 55%; text-align: left;">Désignation / Produit</th>
                <th style="width: 10%;">Unité</th>
                {#if docType !== 'livraison'}
                  <th style="width: 10%; text-align: right;">P.U.</th>
                {/if}
                <th style="width: 10%; text-align: center;">Qté.</th>
                {#if docType !== 'livraison'}
                  <th style="width: 10%; text-align: right;">Total</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              <!-- If page index > 0, show Report Carryover from previous page -->
              {#if pageIdx > 0}
                <tr class="carryover-row">
                  <td></td>
                  <td colspan={docType !== 'livraison' ? 4 : 2} style="text-align: left; font-weight: bold;">Report:</td>
                  {#if docType !== 'livraison'}
                    <td style="text-align: right; font-weight: bold;">
                      {getPageTotals(currentPages, pageIdx - 1).runningSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  {/if}
                </tr>
              {/if}

              <!-- Render current page chunk items -->
              {#each pageItems as item, idx}
                <tr class="item-row">
                  <td style="text-align: center;">
                    {idx + 1 + (pageIdx === 0 ? 0 : currentPages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0))}
                  </td>
                  <td style="text-align: left;">{item.product_name}</td>
                  <td style="text-align: center;">{item.unit}</td>
                  {#if docType !== 'livraison'}
                    <td style="text-align: right;">{item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  {/if}
                  <td style="text-align: center;">{item.quantity}</td>
                  {#if docType !== 'livraison'}
                    <td style="text-align: right;">{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  {/if}
                </tr>
              {/each}



              <!-- If NOT last page, show Total Partiel subtotal -->
              {#if pageIdx < currentPages.length - 1}
                <tr class="carryover-row">
                  <td></td>
                  <td colspan={docType !== 'livraison' ? 4 : 2} style="text-align: left; font-weight: bold;">Total partiel:</td>
                  {#if docType !== 'livraison'}
                    <td style="text-align: right; font-weight: bold;">
                      {getPageTotals(currentPages, pageIdx).runningSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  {/if}
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        <!-- PAGE FOOTER: Show final totals on the LAST page only -->
        {#if pageIdx === currentPages.length - 1}
          {#if docType !== 'livraison'}
            <div class="footer-summary-grid">
              <div class="spelling-box">
                <span class="spelling-heading">Facture arrêtée à la somme de:</span>
                <p class="spelling-body">{bill.amount_in_words}</p>
              </div>

              <table class="totals-table">
                <tbody>
                  <tr>
                    <td class="lbl">Montant HT</td>
                    <td class="val">{bill.montant_ht.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                  </tr>
                  {#if bill.tva_rate > 0}
                    <tr>
                      <td class="lbl">TVA ({bill.tva_rate}%)</td>
                      <td class="val">&nbsp;</td>
                    </tr>
                  {/if}
                  <tr class="ttc-row-tr">
                    <td class="lbl font-bold">Montant TTC</td>
                    <td class="val font-bold">{bill.montant_ttc.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Stamp & Signature area (Facture / Proforma) -->
            <div class="stamp-block">
              <div class="stamp-box">
                <span class="stamp-label">Cachet &amp; Signature</span>
                <div class="stamp-space"></div>
              </div>
            </div>
          {/if}

          <!-- Notes (Bon de Livraison only) -->
          {#if docType === 'livraison' && bill.notes}
            <div class="notes-block">
              <span class="notes-heading">Observations / Remarques:</span>
              <p class="notes-body">{bill.notes}</p>
            </div>
          {/if}

          <!-- Signature/Stamp area — Bon de Livraison only -->
          {#if docType === 'livraison'}
            <div class="signature-block">
              <div class="signature-box">
                <span>Accusé de réception (Client)</span>
                <div class="signature-line"></div>
              </div>
              <div class="signature-box">
                <span>Signature &amp; Cachet (Fournisseur)</span>
                <div class="signature-line"></div>
              </div>
            </div>
          {/if}
        {/if}

      </div>

      <!-- Inject page break between pages in print or between documents -->
      {#if pageIdx < currentPages.length - 1 || bundleIdx < printBundle.length - 1}
        <div class="page-break"></div>
      {/if}
    {/each}
  {/each}

</div>

<style>
  /* ============================================================
     SCREEN-SIDE ACTIONS BAR
     ============================================================ */
  .actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-color);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--border-radius-lg);
    margin-bottom: var(--space-8);
    max-width: 1000px;
    margin-left: auto;
    margin-right: auto;
    gap: var(--space-4);
  }

  .left-actions, .right-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .right-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .print-btn {
    padding: var(--space-3) var(--space-5);
  }

  /* Bundle Selector Option styles */
  .bundle-selector {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    background: var(--bg-hover);
    border-radius: var(--border-radius-md);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-color);
  }

  .bundle-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bundle-checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
  }

  .bundle-checkbox input {
    cursor: pointer;
  }

  /* ============================================================
     PRINT CONTAINER
     ============================================================ */
  .print-container {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  /* ============================================================
     A4 PAGE
     ============================================================ */
  .a4-page {
    background-color: white;
    color: #1a1a2e;
    width: 21cm;
    min-height: 29.7cm;
    padding: 1.8cm 2cm;
    margin: 0 auto;
    box-shadow: var(--shadow-lg);
    border: 1px solid oklch(0.3 0.01 250 / 0.3);
    border-radius: var(--border-radius-sm);
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .a4-page, .a4-page h1, .a4-page p, .a4-page td, .a4-page th, .a4-page span {
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    color: #1a1a2e;
  }

  /* ============================================================
     REDESIGNED A4 HEADER (Page 1)
     ============================================================ */
  .doc-header {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid #1a1a2e;
  }

  .company-row-split {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 14px;
    font-size: 8.5px;
  }

  .company-left {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .logo-frame {
    width: 50px;
    height: 50px;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9f9f9;
    flex-shrink: 0;
  }

  .document-logo {
    max-width: 46px;
    max-height: 46px;
    object-fit: contain;
  }

  .company-identity {
    flex: 1;
  }

  .company-title {
    font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 800;
    margin: 0 0 2px 0;
    color: #1a1a2e;
    line-height: 1.2;
  }

  .company-detail {
    font-size: 8.5px;
    line-height: 1.3;
    color: #444;
    margin: 0 0 2px 0;
  }

  .company-contact {
    font-size: 8.5px;
    margin: 1px 0 0 0;
    color: #444;
  }

  .company-right-reg {
    border-left: 1.5px solid #1a1a2e;
    padding-left: 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: #333;
    line-height: 1.3;
    font-size: 8.5px;
  }

  .company-rib {
    font-size: 8px;
    word-break: normal;
    overflow-wrap: break-word;
    margin-top: 2px;
  }

  /* ============================================================
     UNIFIED METADATA & CLIENT TABLE
     ============================================================ */
  .doc-meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 8.5px;
  }

  .doc-meta-table th, .doc-meta-table td {
    border: 1px solid #1a1a2e;
    padding: 5px 8px;
    line-height: 1.3;
    text-align: left;
  }

  .doc-title-th {
    background: #1a1a2e;
    color: white !important;
    text-align: center !important;
    text-transform: uppercase;
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.03em;
  }

  /* ============================================================
     SUBSEQUENT PAGES HEADER
     ============================================================ */
  .doc-header-minimal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #1a1a2e;
    padding-bottom: 6px;
    margin-bottom: 10px;
    font-size: 8.5px;
  }

  .minimal-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .company-name-small {
    font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
    font-weight: 800;
    font-size: 10px;
    color: #1a1a2e;
  }

  .doc-ref-small {
    color: #666;
    font-weight: 500;
  }

  .minimal-right {
    font-weight: 600;
    color: #444;
  }

  /* ============================================================
     PAGE NUMBER INDICATOR
     ============================================================ */
  .page-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .page-indicator-line {
    flex: 1;
    height: 1px;
    background: #ddd;
  }

  .page-indicator-text {
    font-size: 8px;
    font-weight: 600;
    color: #888;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ============================================================
     TABLE STYLES
     ============================================================ */
  .table-container {
    margin-bottom: 12px;
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  .print-table th, .print-table td {
    border: 1px solid #1a1a2e;
    padding: 5px 6px;
    line-height: 1.3;
  }

  .print-table th {
    background-color: #f0f0f5;
    font-weight: 700;
    text-align: center;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1a1a2e;
  }

  .item-row td {
    color: #333;
  }

  .carryover-row td {
    background-color: #f7f7fa;
    font-style: italic;
    color: #555;
  }



  /* ============================================================
     PAGE TOTALS / SPELLING
     ============================================================ */
  .footer-summary-grid {
    display: grid;
    grid-template-columns: 1.5fr 1.1fr;
    gap: 12px;
    margin-top: 8px;
    border-top: 2px solid #1a1a2e;
    padding-top: 10px;
  }

  .spelling-box {
    border: 1px solid #1a1a2e;
    border-radius: 3px;
    padding: 8px 10px;
    font-size: 9px;
    min-height: 45px;
    line-height: 1.5;
  }

  .spelling-heading {
    font-weight: 700;
    display: block;
    margin-bottom: 3px;
    text-decoration: underline;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1a1a2e;
  }

  .spelling-body {
    font-style: italic;
    color: #444;
    font-size: 9px;
  }

  .totals-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  .totals-table td {
    border: 1px solid #1a1a2e;
    padding: 4px 8px;
  }

  .totals-table .lbl {
    text-align: left;
    width: 50%;
    font-weight: 500;
    color: #333;
  }

  .totals-table .val {
    text-align: right;
    font-weight: 600;
    color: #1a1a2e;
  }

  .ttc-row-tr {
    background-color: #f0f0f5;
  }

  .ttc-row-tr .lbl,
  .ttc-row-tr .val {
    font-weight: 800 !important;
    font-size: 10px;
    color: #1a1a2e;
  }

  .font-bold { font-weight: 800 !important; }

  /* ============================================================
     NOTES BLOCK (livraison only)
     ============================================================ */
  .notes-block {
    border: 1px solid #1a1a2e;
    border-radius: 3px;
    padding: 8px 10px;
    font-size: 9px;
    margin-top: 10px;
    min-height: 36px;
    line-height: 1.5;
  }

  .notes-heading {
    font-weight: 700;
    display: block;
    margin-bottom: 3px;
    text-decoration: underline;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1a1a2e;
  }

  .notes-body {
    color: #444;
    font-size: 9px;
    white-space: pre-wrap;
  }

  /* ============================================================
     STAMP & SIGNATURE (Facture / Proforma)
     ============================================================ */
  .stamp-block {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    padding: 0 8px;
  }

  .stamp-box {
    width: 45%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .stamp-label {
    font-size: 9px;
    font-weight: 700;
    color: #1a1a2e;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stamp-space {
    width: 100%;
    height: 70px;
    border: 1px dashed #aaa;
    border-radius: 3px;
  }

  /* ============================================================
     SIGNATURES
     ============================================================ */
  .signature-block {
    display: flex;
    justify-content: space-between;
    margin-top: 22px;
    padding: 0 8px;
  }

  .signature-box {
    width: 44%;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    gap: 32px;
    color: #1a1a2e;
  }

  .signature-line {
    border-bottom: 1px dashed #888;
    width: 100%;
    height: 1px;
  }

  /* ============================================================
     PRINT OVERRIDES
     ============================================================ */
  @media print {
    @page {
      margin: 0;
    }

    :global(body) {
      background-color: white !important;
      margin: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .actions-bar {
      display: none !important;
    }

    .a4-page {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      margin: 0 auto !important;
      padding: 1.8cm 2cm !important;
      width: 21cm !important;
      height: 29.7cm !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      page-break-inside: avoid !important;
    }

    .page-break {
      display: none !important;
    }

    .doc-title-th {
      background-color: #f0f0f5 !important;
      color: #1a1a2e !important;
    }
  }
</style>
