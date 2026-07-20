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
<div class="detail-toolbar no-print animate-in">
  <div class="toolbar-top">
    <div class="toolbar-identity">
      <a href="/" class="back-link" aria-label="Back to logs">
        <ArrowLeft size={16} />
        <span>Back</span>
      </a>
      <div class="identity-copy">
        <div class="identity-kicker">Document</div>
        <div class="identity-title">
          <span class="identity-number">{bill.bill_number}</span>
          <span class="identity-type" data-type={bill.type}>
            {bill.type === 'facture' ? 'Facture' : bill.type === 'proforma' ? 'Proforma' : 'Livraison'}
          </span>
        </div>
      </div>
    </div>

    <div class="toolbar-manage">
      <a href="/bills/{bill.id}/edit" class="btn btn-secondary btn-compact">
        <Edit size={16} />
        <span>Edit</span>
      </a>

      <form method="POST" action="?/duplicateBill" use:enhance>
        <button type="submit" class="btn btn-secondary btn-compact">
          <Copy size={16} />
          <span>Duplicate</span>
        </button>
      </form>

      <form
        method="POST"
        action="?/deleteBill"
        use:enhance
        onsubmit={(e) => {
          if (!confirm('Are you sure you want to permanently delete this billing document?')) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" class="btn btn-danger btn-compact" title="Delete document">
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </form>
    </div>
  </div>

  <div class="toolbar-bottom">
    <div class="bundle-panel" role="group" aria-label="Include in PDF bundle">
      <div class="bundle-heading">
        <span class="bundle-label">Include in output</span>
        <span class="bundle-count">{printBundle.length} selected</span>
      </div>
      <div class="bundle-chips">
        <label class="bundle-chip" class:active={printInvoice}>
          <input type="checkbox" bind:checked={printInvoice} />
          <span>Facture</span>
        </label>
        <label class="bundle-chip" class:active={printProforma}>
          <input type="checkbox" bind:checked={printProforma} />
          <span>Proforma</span>
        </label>
        <label class="bundle-chip" class:active={printLivraison}>
          <input type="checkbox" bind:checked={printLivraison} />
          <span>Livraison</span>
        </label>
      </div>
    </div>

    <div class="toolbar-output">
      <button
        type="button"
        onclick={triggerPrint}
        class="btn btn-primary btn-compact"
        disabled={printBundle.length === 0}
      >
        <Printer size={16} />
        <span>{printBundle.length > 1 ? 'Print bundle' : 'Print'}</span>
      </button>

      <a
        href="/api/bills/{bill.id}/pdf?mode=saved"
        class="btn btn-secondary btn-compact"
        title="Download saved document as PDF"
      >
        <FileDown size={16} />
        <span>PDF</span>
      </a>

      <a
        href={`/api/bills/${bill.id}/pdf?mode=bundle&types=${encodeURIComponent(printBundle.join(','))}`}
        class="btn btn-secondary btn-compact"
        class:disabled={printBundle.length === 0}
        aria-disabled={printBundle.length === 0}
        onclick={(event) => {
          if (printBundle.length === 0) event.preventDefault();
        }}
        title="Download selected PDF bundle"
      >
        <Files size={16} />
        <span>Bundle</span>
      </a>

      <a
        href="/api/bills/{bill.id}/export"
        class="btn btn-secondary btn-compact"
        title="Export this bill as Excel"
      >
        <FileSpreadsheet size={16} />
        <span>XLSX</span>
      </a>
    </div>
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
  .detail-toolbar {
    max-width: 1000px;
    margin: 0 auto var(--space-6);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .toolbar-top,
  .toolbar-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
  }

  .toolbar-top {
    border-bottom: 1px solid var(--border-color);
  }

  .toolbar-bottom {
    background: color-mix(in oklab, var(--bg-input) 70%, transparent);
    align-items: stretch;
  }

  .toolbar-identity {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.5rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-input);
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition:
      background-color var(--duration-fast) var(--ease-spring),
      color var(--duration-fast) var(--ease-spring),
      border-color var(--duration-fast) var(--ease-spring);
  }

  .back-link:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: color-mix(in oklab, var(--color-accent) 30%, var(--border-color));
  }

  .identity-copy {
    min-width: 0;
  }

  .identity-kicker {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .identity-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .identity-number {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .identity-type {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .identity-type[data-type='proforma'] {
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }

  .identity-type[data-type='livraison'] {
    background: var(--color-info-bg);
    color: var(--color-info);
  }

  .toolbar-manage,
  .toolbar-output {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .btn-compact {
    min-height: 2.5rem;
    padding: 0.55rem 0.9rem;
  }

  .bundle-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
    min-width: 0;
    flex: 1;
  }

  .bundle-heading {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .bundle-label {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .bundle-count {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .bundle-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .bundle-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.25rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    transition:
      background-color var(--duration-fast) var(--ease-spring),
      border-color var(--duration-fast) var(--ease-spring),
      color var(--duration-fast) var(--ease-spring),
      box-shadow var(--duration-fast) var(--ease-spring);
  }

  .bundle-chip input {
    width: 0.95rem;
    height: 0.95rem;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .bundle-chip:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .bundle-chip.active {
    background: var(--color-accent-subtle);
    border-color: color-mix(in oklab, var(--color-accent) 35%, transparent);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-accent) 12%, transparent);
  }

  .toolbar-output .btn.disabled,
  .toolbar-output .btn:disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  @media (max-width: 900px) {
    .toolbar-top,
    .toolbar-bottom {
      flex-direction: column;
      align-items: stretch;
    }

    .toolbar-manage,
    .toolbar-output {
      justify-content: flex-start;
    }
  }

  @media (max-width: 640px) {
    .toolbar-top,
    .toolbar-bottom {
      padding: var(--space-4);
    }

    .toolbar-manage .btn span,
    .toolbar-output .btn span {
      display: none;
    }

    .toolbar-manage .btn,
    .toolbar-output .btn {
      min-width: 2.5rem;
      justify-content: center;
      padding-left: 0.7rem;
      padding-right: 0.7rem;
    }

    .back-link span {
      display: none;
    }
  }
</style>
