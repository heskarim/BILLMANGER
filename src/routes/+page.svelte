<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    LayoutDashboard,
    Receipt,
    FileText,
    Truck,
    TrendingUp,
    Search,
    Eye,
    Edit3,
    Copy,
    Trash2,
    Plus,
    X,
    Filter,
    FileSpreadsheet,
    Download
  } from '@lucide/svelte';

  let { data } = $props();

  // ----------------------------------------------------
  // CLIENT-SIDE FILTERING STATE
  // ----------------------------------------------------
  let searchQuery = $state('');
  let typeFilter = $state('all');

  // Reactively filter bills based on search input and dropdown filter
  let filteredBills = $derived(
    data.bills.filter(bill => {
      const matchText = searchQuery.trim().toLowerCase();
      const matchesSearch = !matchText || 
        bill.bill_number.toLowerCase().includes(matchText) ||
        (bill.client_name_snapshot || '').toLowerCase().includes(matchText);
        
      const matchesType = typeFilter === 'all' || bill.type === typeFilter;
      
      return matchesSearch && matchesType;
    })
  );

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

  // Clear filters
  function clearFilters() {
    searchQuery = '';
    typeFilter = 'all';
  }
</script>

<div class="dashboard-container">
  
  <!-- Dashboard Header -->
  <header class="dashboard-header animate-in">
    <div class="header-text">
      <h1>Dashboard <span class="text-gradient">Overview</span></h1>
      <p class="text-secondary">Track, search, and generate corporate billing documents.</p>
    </div>
    
    <div class="header-actions">
      <a href="/api/bills/export" class="btn btn-secondary export-all-btn" title="Export all bills as Excel">
        <FileSpreadsheet size={18} />
        <span>Export All</span>
      </a>

      <a href="/bills/new" class="btn btn-primary create-btn" id="create-document-btn">
        <Plus size={18} />
        <span>Create Document</span>
      </a>
    </div>
  </header>

  <!-- 1. METRICS CARDS GRID -->
  <div class="metrics-grid">
    <!-- Card: Total Revenue -->
    <div class="metric-card animate-in" style="animation-delay: 80ms;">
      <div class="metric-icon-wrap revenue-accent">
        <TrendingUp size={22} />
      </div>
      <div class="metric-body">
        <span class="metric-label">Total Revenue (HT)</span>
        <h2 class="metric-value">{data.stats.totalRevenue.toLocaleString()} <span class="metric-currency">DA</span></h2>
        <span class="metric-sub">Standard invoices subtotal</span>
      </div>
    </div>

    <!-- Card: Invoices -->
    <div class="metric-card animate-in" style="animation-delay: 160ms;">
      <div class="metric-icon-wrap facture-accent">
        <Receipt size={22} />
      </div>
      <div class="metric-body">
        <span class="metric-label">Invoices</span>
        <h2 class="metric-value">{data.stats.totalInvoices}</h2>
        <span class="metric-sub">Generated final invoices</span>
      </div>
    </div>

    <!-- Card: Proformas -->
    <div class="metric-card animate-in" style="animation-delay: 240ms;">
      <div class="metric-icon-wrap proforma-accent">
        <FileText size={22} />
      </div>
      <div class="metric-body">
        <span class="metric-label">Proforma Invoices</span>
        <h2 class="metric-value">{data.stats.totalProformas}</h2>
        <span class="metric-sub">Customer estimates & quotes</span>
      </div>
    </div>

    <!-- Card: Delivery Notes -->
    <div class="metric-card animate-in" style="animation-delay: 320ms;">
      <div class="metric-icon-wrap livraison-accent">
        <Truck size={22} />
      </div>
      <div class="metric-body">
        <span class="metric-label">Delivery Notes</span>
        <h2 class="metric-value">{data.stats.totalLivraisons}</h2>
        <span class="metric-sub">Shipments & transport slips</span>
      </div>
    </div>
  </div>

  <!-- 2. SEARCH AND FILTER TOOLS -->
  <div class="filter-bar animate-in" style="animation-delay: 380ms;">
    <div class="search-input-wrapper">
      <Search size={17} class="search-icon" />
      <input 
        type="text" 
        class="input-field search-input" 
        bind:value={searchQuery} 
        placeholder="Search by bill number or customer name..." 
        id="search-bills"
      />
      {#if searchQuery}
        <button onclick={() => searchQuery = ''} class="clear-search-btn" aria-label="Clear search">
          <X size={15} />
        </button>
      {/if}
    </div>

    <div class="filter-controls">
      <div class="select-wrapper">
        <Filter size={15} class="select-icon" />
        <select class="input-field select-input" bind:value={typeFilter} id="filter-type">
          <option value="all">All Document Types</option>
          <option value="facture">Facture (Invoices)</option>
          <option value="proforma">Proforma Invoices</option>
          <option value="livraison">Bon de Livraison</option>
        </select>
      </div>

      {#if searchQuery || typeFilter !== 'all'}
        <button onclick={clearFilters} class="btn btn-secondary btn-clear">
          <span>Reset</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- 3. DATABASE LOGS TABLE -->
  <div class="logs-section animate-in" style="animation-delay: 440ms;">
    <h3 class="section-title">Document History</h3>
    
    {#if filteredBills.length === 0}
      <div class="empty-state-box">
        <div class="empty-icon-wrap">
          <Receipt size={40} />
        </div>
        <h4>No documents found</h4>
        <p class="text-secondary">Try adjusting your search filters, or create a new document to get started.</p>
        <a href="/bills/new" class="btn btn-primary" style="margin-top: var(--space-4);">
          <Plus size={18} />
          <span>Create New Document</span>
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="logs-table">
          <thead>
            <tr>
              <th style="width: 120px;">N° Document</th>
              <th style="width: 130px;">Type</th>
              <th>Customer / Client</th>
              <th style="width: 120px;">Date</th>
              <th style="width: 150px; text-align: right;">Total Amount</th>
              <th style="width: 170px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredBills as bill, i (bill.id)}
              <tr class="log-row" style="animation: fadeInUp 0.4s var(--ease-spring) both; animation-delay: {Math.min(i * 40, 400)}ms;">
                <!-- Document ID -->
                <td class="doc-num-cell">
                  {bill.bill_number}
                </td>

                <!-- Document Type Badge -->
                <td>
                  {#if bill.type === 'facture'}
                    <span class="badge badge-facture">Facture</span>
                  {:else if bill.type === 'proforma'}
                    <span class="badge badge-proforma">Proforma</span>
                  {:else}
                    <span class="badge badge-livraison">Livraison</span>
                  {/if}
                </td>

                <!-- Client Name -->
                <td class="client-cell">
                  <span class="client-name">{bill.client_name_snapshot}</span>
                  {#if bill.client_code_snapshot}
                    <span class="client-code">{bill.client_code_snapshot}</span>
                  {/if}
                </td>

                <!-- Date created -->
                <td class="date-cell">
                  {formatDate(bill.date)}
                </td>

                <!-- Total Amount -->
                <td class="amount-cell">
                  {#if bill.type === 'livraison'}
                    <span class="text-muted">—</span>
                  {:else}
                    {bill.montant_ttc.toLocaleString()} DA
                  {/if}
                </td>

                <!-- Table Row Actions -->
                <td>
                  <div class="action-buttons-cell">
                    <a href="/bills/{bill.id}" class="action-btn view-btn" title="View & Print">
                      <Eye size={15} />
                    </a>

                    <a href="/bills/{bill.id}/edit" class="action-btn edit-btn" title="Edit">
                      <Edit3 size={15} />
                    </a>

                    <form method="POST" action="?/duplicateBill" use:enhance>
                      <input type="hidden" name="id" value={bill.id} />
                      <button type="submit" class="action-btn duplicate-btn" title="Duplicate Document">
                        <Copy size={15} />
                      </button>
                    </form>

                    <form 
                      method="POST" 
                      action="?/deleteBill" 
                      use:enhance
                      onsubmit={(e) => {
                        if (!confirm(`Are you sure you want to permanently delete document "${bill.bill_number}"?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={bill.id} />
                      <button type="submit" class="action-btn delete-btn" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

</div>

<style>
  /* ============================================================
     DASHBOARD
     ============================================================ */
  .dashboard-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  /* ---- Header ---- */
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-6);
  }

  .header-text h1 {
    font-size: var(--text-3xl);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.1;
  }

  .header-text p {
    font-size: var(--text-md);
    margin-top: var(--space-2);
  }

  .create-btn {
    padding: var(--space-3) var(--space-6);
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .export-all-btn {
    padding: var(--space-3) var(--space-5);
  }

  /* ---- Metrics Grid ---- */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-5);
  }

  @media (max-width: 1024px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 550px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
    .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--space-6);
    display: flex;
    align-items: flex-start;
    gap: var(--space-5);
    transition: all var(--duration-normal) var(--ease-spring);
    position: relative;
    overflow: hidden;
  }

  .metric-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    transition: opacity var(--duration-normal) var(--ease-spring);
    pointer-events: none;
  }

  .metric-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
    border-color: var(--text-muted);
  }

  .metric-icon-wrap {
    width: 46px;
    height: 46px;
    border-radius: var(--border-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform var(--duration-normal) var(--ease-spring);
  }

  .metric-card:hover .metric-icon-wrap {
    transform: scale(1.08);
  }

  .revenue-accent {
    background: oklch(0.72 0.185 152 / 0.12);
    color: var(--color-success);
  }
  .facture-accent {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }
  .proforma-accent {
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }
  .livraison-accent {
    background: var(--color-info-bg);
    color: var(--color-info);
  }

  .metric-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .metric-label {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .metric-value {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 800;
    margin: var(--space-1) 0;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .metric-currency {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .metric-sub {
    font-size: var(--text-xs);
    color: var(--text-muted);
    line-height: 1.3;
  }

  /* ---- Filter Bar ---- */
  .filter-bar {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--space-4) var(--space-5);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
  }

  @media (max-width: 800px) {
    .filter-bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: var(--space-4);
    color: var(--text-muted);
    pointer-events: none;
    z-index: 1;
  }

  .search-input {
    padding-left: 2.75rem;
    padding-right: 2.5rem;
  }

  .clear-search-btn {
    position: absolute;
    right: var(--space-3);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    transition: all var(--duration-fast) var(--ease-spring);
  }

  .clear-search-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .filter-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  @media (max-width: 800px) {
    .filter-controls {
      display: grid;
      grid-template-columns: 1fr auto;
    }
  }

  .select-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 210px;
  }

  @media (max-width: 800px) {
    .select-wrapper {
      width: 100%;
    }
  }

  :global(.select-icon) {
    position: absolute;
    left: var(--space-3);
    pointer-events: none;
    color: var(--text-muted);
    z-index: 1;
  }

  .select-input {
    padding-left: 2.35rem;
    appearance: none;
    cursor: pointer;
  }

  .btn-clear {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
  }

  /* ---- Logs Section ---- */
  .logs-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--space-6);
    padding-bottom: var(--space-3);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--space-5);
    padding-left: var(--space-3);
    border-left: 3px solid var(--color-accent);
  }

  .table-responsive {
    overflow-x: auto;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .logs-table th {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .logs-table td {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .log-row {
    transition: all var(--duration-fast) var(--ease-spring);
    position: relative;
  }

  .log-row:hover {
    background-color: var(--bg-hover);
  }

  .doc-num-cell {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-base);
    color: var(--text-primary);
  }

  /* ---- Badges ---- */
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: var(--text-xs);
    font-weight: 700;
    padding: 3px 10px;
    border-radius: var(--border-radius-pill);
    letter-spacing: 0.02em;
  }

  .badge-facture {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .badge-proforma {
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }

  .badge-livraison {
    background: var(--color-info-bg);
    color: var(--color-info);
  }

  /* ---- Client Cell ---- */
  .client-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .client-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .client-code {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .date-cell {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .amount-cell {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-md);
    color: var(--text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Actions ---- */
  .action-buttons-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .action-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    padding: 6px;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-spring);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--border-color);
    transform: translateY(-1px);
  }

  .view-btn:hover {
    color: var(--color-accent);
    background: var(--color-accent-subtle);
    border-color: oklch(0.5 0.1 192 / 0.2);
  }

  .edit-btn:hover {
    color: var(--color-warning);
    background: var(--color-warning-bg);
    border-color: oklch(0.5 0.1 75 / 0.2);
  }

  .duplicate-btn:hover {
    color: var(--color-info);
    background: var(--color-info-bg);
    border-color: oklch(0.5 0.1 230 / 0.2);
  }

  .delete-btn:hover {
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-color: oklch(0.5 0.1 25 / 0.2);
  }

  /* ---- Empty State ---- */
  .empty-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-16) var(--space-8);
    gap: var(--space-3);
  }

  .empty-icon-wrap {
    width: 72px;
    height: 72px;
    border-radius: var(--border-radius-lg);
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    margin-bottom: var(--space-2);
  }

  .empty-state-box h4 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .empty-state-box p {
    font-size: var(--text-base);
    max-width: 380px;
  }
</style>
