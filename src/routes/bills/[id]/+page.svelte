<script lang="ts">
  import { enhance } from '$app/forms';
  import BillPrintDocument from '$lib/components/BillPrintDocument.svelte';
  import {
    Printer,
    Trash2,
    Copy,
    ArrowLeft,
    Edit,
    FileSpreadsheet,
    FileDown,
    Files
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

    <a href="/api/bills/{bill.id}/pdf?mode=saved" class="btn btn-primary" title="Download saved document as PDF">
      <FileDown size={16} />
      <span>Download PDF</span>
    </a>

    <a
      href={`/api/bills/${bill.id}/pdf?mode=bundle&types=${encodeURIComponent(printBundle.join(','))}`}
      class="btn btn-secondary"
      class:disabled={printBundle.length === 0}
      aria-disabled={printBundle.length === 0}
      onclick={(event) => { if (printBundle.length === 0) event.preventDefault(); }}
      title="Download selected PDF bundle"
    >
      <Files size={16} />
      <span>Download Full Bundle</span>
    </a>

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
<BillPrintDocument
  bill={bill}
  items={items}
  settings={settings}
  documentTypes={printBundle}
/>

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

</style>
