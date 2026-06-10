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
    Truck 
  } from '@lucide/svelte';

  let { data } = $props();

  // Extract variables
  const bill = data.bill;
  const items = data.items;
  const settings = data.settings;

  // ----------------------------------------------------
  // PAGINATION CHUNKING LOGIC
  // ----------------------------------------------------
  // We place up to 25 items on the first page, and 25 items on subsequent pages
  const PAGE_SIZE = 25;
  
  // Create chunks of items
  let pages = $derived.by(() => {
    const result = [];
    for (let i = 0; i < items.length; i += PAGE_SIZE) {
      result.push(items.slice(i, i + PAGE_SIZE));
    }
    // Ensure we have at least one page
    if (result.length === 0) {
      result.push([]);
    }
    return result;
  });

  // Calculate running totals for each page to display "Report" carryovers
  function getPageTotals(pageIdx: number): { pageSum: number; runningSum: number } {
    let pageSum = 0;
    const pageItems = pages[pageIdx] || [];
    for (const item of pageItems) {
      pageSum += item.total_price;
    }

    let runningSum = 0;
    for (let i = 0; i <= pageIdx; i++) {
      const pItems = pages[i] || [];
      for (const item of pItems) {
        runningSum += item.total_price;
      }
    }

    return { pageSum, runningSum };
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
<div class="actions-bar no-print">
  <div class="left-actions">
    <a href="/" class="btn btn-secondary">
      <ArrowLeft size={16} />
      <span>Back to Logs</span>
    </a>
  </div>
  
  <div class="right-actions">
    <button onclick={triggerPrint} class="btn btn-success">
      <Printer size={16} />
      <span>Print / Save PDF</span>
    </button>
    
    <form method="POST" action="?/duplicateBill" use:enhance>
      <button type="submit" class="btn btn-secondary">
        <Copy size={16} />
        <span>Duplicate</span>
      </button>
    </form>

    <form method="POST" action="?/deleteBill" use:enhance={() => {
      return confirm('Are you sure you want to permanently delete this billing document?');
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
  
  {#each pages as pageItems, pageIdx (pageIdx)}
    <!-- A4 Sheet wrapper -->
    <div class="a4-page">
      
      <!-- PAGE HEADER: Repeated on Page 1, minimal on subsequent pages -->
      {#if pageIdx === 0}
        <!-- Seller Info & Corporate identity -->
        <header class="document-header">
          <div class="seller-identity">
            {#if settings?.logo}
              <img src={settings.logo} alt="Company Logo" class="document-logo" />
            {/if}
            <div class="seller-details">
              <h1 class="company-name">{settings?.company_name || 'Cloud Pi'}</h1>
              <p class="company-address">{settings?.address || ''}</p>
              <p class="company-contact">
                {#if settings?.phone}Tel: {settings.phone}{/if}
                {#if settings?.email} - Email: {settings.email}{/if}
              </p>
              <p class="company-registry">
                {#if settings?.rc}RC: {settings.rc}{/if}
                {#if settings?.art} - ART: {settings.art}{/if}
              </p>
              <p class="company-tax">
                {#if settings?.nif}NIF: {settings.nif}{/if}
                {#if settings?.nis} - NIS: {settings.nis}{/if}
              </p>
              {#if settings?.rib}
                <p class="company-bank">RIB: {settings.rib}</p>
              {/if}
            </div>
          </div>
        </header>

        <!-- Document Details Bar -->
        <div class="document-details-bar">
          <div class="title-box">
            {#if bill.type === 'facture'}
              <h2>FACTURE N°: {bill.bill_number}</h2>
            {:else if bill.type === 'proforma'}
              <h2>FACTURE PROFORMA N°: {bill.bill_number}</h2>
            {:else}
              <h2>BON DE LIVRAISON N°: {bill.bill_number}</h2>
            {/if}
          </div>

          <div class="client-meta-box">
            <p><strong>Code du client:</strong> {bill.client_code_snapshot || '/'}</p>
            <p><strong>Nom:</strong> {bill.client_name_snapshot}</p>
            <p><strong>Adresse:</strong> {bill.client_address_snapshot || '/'}</p>
          </div>
        </div>

        <!-- Date & Contract Details -->
        <div class="date-contract-row">
          <p><strong>Date:</strong> {formatDate(bill.date)}</p>
          {#if bill.contract_number}
            <p><strong>Contrat N°:</strong> {bill.contract_number} {#if bill.contract_date}du {formatDate(bill.contract_date)}{/if}</p>
          {/if}
        </div>
      {:else}
        <!-- Subsequent Pages Header (Minimal carryover header) -->
        <header class="document-header-minimal">
          <div class="minimal-left">
            <span class="company-name-small">{settings?.company_name || 'Cloud Pi'}</span>
            <span class="doc-number-small">
              {bill.type === 'facture' ? 'Facture' : bill.type === 'proforma' ? 'Proforma' : 'Bon de livraison'} N°: {bill.bill_number}
            </span>
          </div>
          <div class="minimal-right">
            <span>Page {pageIdx + 1}/{pages.length}</span>
          </div>
        </header>
      {/if}

      <!-- Dynamic Page Pagination Tracker inside Document -->
      <div class="page-number-banner">
        {#if bill.type === 'facture'}
          <span>Page {pageIdx + 1}/{pages.length} de la facture N° {bill.bill_number}</span>
        {:else if bill.type === 'proforma'}
          <span>Page {pageIdx + 1}/{pages.length} de la facture proforma N° {bill.bill_number}</span>
        {:else}
          <span>Page {pageIdx + 1}/{pages.length} du bon de livraison N° {bill.bill_number}</span>
        {/if}
      </div>

      <!-- ITEMS TABLE FOR THIS CHUNK -->
      <div class="table-container">
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;">N°</th>
              <th style="width: 55%; text-align: left;">Désignation / Produit</th>
              <th style="width: 10%;">Unité</th>
              {#if bill.type !== 'livraison'}
                <th style="width: 10%; text-align: right;">P.U.</th>
              {/if}
              <th style="width: 10%; text-align: center;">Qté.</th>
              {#if bill.type !== 'livraison'}
                <th style="width: 10%; text-align: right;">Total</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            <!-- If page index > 0, show Report Carryover from previous page -->
            {#if pageIdx > 0}
              <tr class="carryover-row">
                <td></td>
                <td colspan={bill.type !== 'livraison' ? 4 : 2} style="text-align: left; font-weight: bold;">Report:</td>
                {#if bill.type !== 'livraison'}
                  <td style="text-align: right; font-weight: bold;">
                    {getPageTotals(pageIdx - 1).runningSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                {/if}
              </tr>
            {/if}

            <!-- Render current page chunk items -->
            {#each pageItems as item, idx}
              <tr class="item-row">
                <td style="text-align: center;">{pageIdx * PAGE_SIZE + idx + 1}</td>
                <td style="text-align: left;">{item.product_name}</td>
                <td style="text-align: center;">{item.unit}</td>
                {#if bill.type !== 'livraison'}
                  <td style="text-align: right;">{item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {/if}
                <td style="text-align: center;">{item.quantity}</td>
                {#if bill.type !== 'livraison'}
                  <td style="text-align: right;">{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {/if}
              </tr>
            {/each}

            <!-- Fill empty rows to keep the print page size uniform and professional -->
            {#if pageItems.length < PAGE_SIZE && pages.length > 1}
              {#each Array(PAGE_SIZE - pageItems.length - (pageIdx > 0 ? 1 : 0)) as _}
                <tr class="empty-row-fill">
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  {#if bill.type !== 'livraison'}<td>&nbsp;</td>{/if}
                  <td>&nbsp;</td>
                  {#if bill.type !== 'livraison'}<td>&nbsp;</td>{/if}
                </tr>
              {/each}
            {/if}

            <!-- If NOT last page, show Total Partiel subtotal -->
            {#if pageIdx < pages.length - 1}
              <tr class="carryover-row">
                <td></td>
                <td colspan={bill.type !== 'livraison' ? 4 : 2} style="text-align: left; font-weight: bold;">Total partiel:</td>
                {#if bill.type !== 'livraison'}
                  <td style="text-align: right; font-weight: bold;">
                    {getPageTotals(pageIdx).runningSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                {/if}
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- PAGE FOOTER: Show final totals on the LAST page only -->
      {#if pageIdx === pages.length - 1}
        {#if bill.type !== 'livraison'}
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
                    <td class="val">{(bill.montant_ttc - bill.montant_ht).toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                  </tr>
                {/if}
                <tr class="ttc-row-tr">
                  <td class="lbl font-bold">Montant TTC</td>
                  <td class="val font-bold">{bill.montant_ttc.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                </tr>
              </tbody>
            </table>
          </div>
        {/if}

        <!-- Signature/Stamp area -->
        <div class="signature-block">
          <div class="signature-box">
            <span>Accusé de réception (Client)</span>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <span>Signature & Cachet (Fournisseur)</span>
            <div class="signature-line"></div>
          </div>
        </div>
      {/if}

    </div>

    <!-- Inject page break between pages in print -->
    {#if pageIdx < pages.length - 1}
      <div class="page-break"></div>
    {/if}
  {/each}

</div>

<style>
  /* Screen styles for previewing */
  .actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius-lg);
    margin-bottom: 2rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .left-actions, .right-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .print-container {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* A4 page preview on screen */
  .a4-page {
    background-color: white;
    color: black;
    width: 21cm;
    min-height: 29.7cm;
    padding: 2cm;
    margin: 0 auto;
    box-shadow: var(--shadow-lg);
    border: 1px solid #ddd;
    border-radius: 4px;
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  /* Typography override for print blocks */
  .a4-page, .a4-page h1, .a4-page h2, .a4-page h3, .a4-page p, .a4-page td, .a4-page th {
    font-family: var(--font-sans);
    color: #000;
  }

  /* Document header details */
  .document-header {
    border-bottom: 1px solid #000;
    padding-bottom: 10px;
    margin-bottom: 15px;
  }

  .seller-identity {
    display: flex;
    align-items: start;
    gap: 1.5rem;
  }

  .document-logo {
    max-width: 70px;
    max-height: 70px;
    object-fit: contain;
    background-color: transparent;
  }

  .seller-details {
    flex: 1;
    font-size: 10px;
    line-height: 1.4;
  }

  .company-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    margin-bottom: 3px;
  }

  .document-details-bar {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    border: 1.5px solid #000;
    margin-bottom: 15px;
  }

  .title-box {
    flex: 1.2;
    border-right: 1.5px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    text-align: center;
    background-color: #f5f5f5;
  }

  .title-box h2 {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 0.02em;
  }

  .client-meta-box {
    flex: 1.5;
    padding: 8px 12px;
    font-size: 10px;
    line-height: 1.4;
  }

  .date-contract-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    margin-bottom: 12px;
    padding: 0 4px;
  }

  /* Subsequent pages minimal header */
  .document-header-minimal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #000;
    padding-bottom: 6px;
    margin-bottom: 12px;
    font-size: 9px;
  }

  .company-name-small {
    font-weight: bold;
    margin-right: 10px;
  }

  .doc-number-small {
    color: #444;
  }

  /* Page number banner */
  .page-number-banner {
    text-align: center;
    font-size: 9px;
    font-style: italic;
    color: #555;
    margin-bottom: 8px;
  }

  /* Table styles */
  .table-container {
    flex: 1; /* fills remaining space, pushing totals to bottom */
    margin-bottom: 15px;
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
  }

  .print-table th, .print-table td {
    border: 1px solid #000;
    padding: 5px 6px;
    line-height: 1.2;
  }

  .print-table th {
    background-color: #f5f5f5;
    font-weight: bold;
    text-align: center;
  }

  .carryover-row td {
    background-color: #fafafa;
    font-style: italic;
  }

  .empty-row-fill td {
    border-top: none;
    border-bottom: none;
  }

  /* Page totals and spelled block */
  .footer-summary-grid {
    display: grid;
    grid-template-columns: 1.5fr 1.1fr;
    gap: 15px;
    margin-top: 10px;
    border-top: 1.5px solid #000;
    padding-top: 10px;
  }

  .spelling-box {
    border: 1px solid #000;
    padding: 8px;
    font-size: 9.5px;
    min-height: 50px;
    line-height: 1.4;
  }

  .spelling-heading {
    font-weight: bold;
    display: block;
    margin-bottom: 4px;
    text-decoration: underline;
  }

  .spelling-body {
    font-style: italic;
  }

  .totals-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
  }

  .totals-table td {
    border: 1px solid #000;
    padding: 4px 8px;
  }

  .totals-table .lbl {
    text-align: left;
    width: 50%;
  }

  .totals-table .val {
    text-align: right;
    font-weight: bold;
  }

  .ttc-row-tr {
    background-color: #f5f5f5;
  }

  .font-bold { font-weight: bold !important; }

  /* Signatures */
  .signature-block {
    display: flex;
    justify-content: space-between;
    margin-top: 25px;
    padding: 0 10px;
  }

  .signature-box {
    width: 45%;
    font-size: 9.5px;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    gap: 35px;
  }

  .signature-line {
    border-bottom: 1px dashed #000;
    width: 100%;
    height: 1px;
  }

  /* PRINT DIRECTIVES */
  @media print {
    .actions-bar {
      display: none !important;
    }

    body {
      background-color: white !important;
    }

    .a4-page {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-height: 100% !important;
    }

    .page-break {
      page-break-before: always !important;
      break-before: page !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
  }
</style>
