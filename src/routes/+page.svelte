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
    Filter
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
  <header class="dashboard-header">
    <div>
      <h1>Dashboard Overview</h1>
      <p class="text-secondary">Welcome back. Track, search, and generate corporate billing documents.</p>
    </div>
    
    <a href="/bills/new" class="btn btn-primary">
      <Plus size={18} />
      <span>Create Document</span>
    </a>
  </header>

  <!-- 1. METRICS CARDS GRID -->
  <div class="metrics-grid">
    <!-- Card: Total Revenue -->
    <div class="card metric-card hover-glow">
      <div class="metric-icon-wrapper revenue-icon">
        <TrendingUp size={24} />
      </div>
      <div class="metric-info">
        <span class="metric-lbl">Total Revenue (HT)</span>
        <h2 class="metric-val">{data.stats.totalRevenue.toLocaleString()} DA</h2>
        <span class="metric-desc">Standard invoices subtotal</span>
      </div>
    </div>

    <!-- Card: Invoices -->
    <div class="card metric-card">
      <div class="metric-icon-wrapper facture-icon">
        <Receipt size={24} />
      </div>
      <div class="metric-info">
        <span class="metric-lbl">Invoices</span>
        <h2 class="metric-val">{data.stats.totalInvoices}</h2>
        <span class="metric-desc">Generated final invoices</span>
      </div>
    </div>

    <!-- Card: Proformas -->
    <div class="card metric-card">
      <div class="metric-icon-wrapper proforma-icon">
        <FileText size={24} />
      </div>
      <div class="metric-info">
        <span class="metric-lbl">Proforma Invoices</span>
        <h2 class="metric-val">{data.stats.totalProformas}</h2>
        <span class="metric-desc">Customer estimates & quotes</span>
      </div>
    </div>

    <!-- Card: Delivery Notes -->
    <div class="card metric-card">
      <div class="metric-icon-wrapper livraison-icon">
        <Truck size={24} />
      </div>
      <div class="metric-info">
        <span class="metric-lbl">Delivery Notes</span>
        <h2 class="metric-val">{data.stats.totalLivraisons}</h2>
        <span class="metric-desc">Shipments & transport slips</span>
      </div>
    </div>
  </div>

  <!-- 2. SEARCH AND FILTER TOOLS -->
  <div class="filter-bar card">
    <div class="search-input-wrapper">
      <Search size={18} color="var(--text-muted)" class="search-icon" />
      <input 
        type="text" 
        class="input-field search-input" 
        bind:value={searchQuery} 
        placeholder="Search logs by bill number or customer name..." 
      />
      {#if searchQuery}
        <button onclick={() => searchQuery = ''} class="clear-search-btn" aria-label="Clear search">
          <X size={16} />
        </button>
      {/if}
    </div>

    <div class="filter-controls">
      <div class="select-wrapper">
        <Filter size={16} color="var(--text-secondary)" class="select-icon" />
        <select class="input-field select-input" bind:value={typeFilter}>
          <option value="all">All Document Types</option>
          <option value="facture">Facture (Invoices)</option>
          <option value="proforma">Proforma Invoices</option>
          <option value="livraison">Bon de Livraison</option>
        </select>
      </div>

      {#if searchQuery || typeFilter !== 'all'}
        <button onclick={clearFilters} class="btn btn-secondary btn-clear">
          <span>Reset Filters</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- 3. DATABASE LOGS TABLE -->
  <div class="card logs-section">
    <h3 class="section-title">Document History Log</h3>
    
    {#if filteredBills.length === 0}
      <div class="empty-state-box">
        <Receipt size={48} color="var(--text-muted)" />
        <h4>No documents found</h4>
        <p class="text-secondary">Try adjusting your search filters, or create a new document to get started.</p>
        <a href="/bills/new" class="btn btn-primary" style="margin-top: 1rem;">
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
              <th style="width: 140px;">Type</th>
              <th>Customer / Client Name</th>
              <th style="width: 130px;">Date Created</th>
              <th style="width: 160px; text-align: right;">Total Amount</th>
              <th style="width: 180px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredBills as bill (bill.id)}
              <tr class="log-row">
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

                <!-- Client Name Snapshot -->
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
                    <!-- Link: View/Print -->
                    <a href="/bills/{bill.id}" class="action-btn view-btn" title="View & Print">
                      <Eye size={16} />
                    </a>

                    <!-- Link: Edit -->
                    <a href="/bills/{bill.id}/edit" class="action-btn edit-btn" title="Edit">
                      <Edit3 size={16} />
                    </a>

                    <!-- Form: Duplicate -->
                    <form method="POST" action="?/duplicateBill" use:enhance>
                      <input type="hidden" name="id" value={bill.id} />
                      <button type="submit" class="action-btn duplicate-btn" title="Duplicate Document">
                        <Copy size={16} />
                      </button>
                    </form>

                    <!-- Form: Delete -->
                    <form 
                      method="POST" 
                      action="?/deleteBill" 
                      use:enhance={() => {
                        return confirm(`Are you sure you want to permanently delete document "${bill.bill_number}"?`);
                      }}
                    >
                      <input type="hidden" name="id" value={bill.id} />
                      <button type="submit" class="action-btn delete-btn" title="Delete">
                        <Trash2 size={16} />
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
  .dashboard-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .dashboard-header h1 {
    font-size: 1.85rem;
    letter-spacing: -0.025em;
  }

  .dashboard-header p {
    font-size: 0.95rem;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
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
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
  }

  .metric-icon-wrapper {
    background-color: var(--bg-input);
    padding: 0.85rem;
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .revenue-icon { color: var(--color-success); }
  .facture-icon { color: var(--color-primary); }
  .proforma-icon { color: var(--color-warning); }
  .livraison-icon { color: var(--color-info); }

  .metric-info {
    display: flex;
    flex-direction: column;
  }

  .metric-lbl {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric-val {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 750;
    margin: 0.15rem 0 0.05rem 0;
    letter-spacing: -0.02em;
  }

  .metric-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* Glow Hover effect */
  .hover-glow:hover {
    box-shadow: 0 0 25px 2px rgba(34, 197, 94, 0.08);
    border-color: var(--color-success);
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
  }

  @media (max-width: 800px) {
    .filter-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
  }

  .search-input {
    padding-left: 2.75rem;
    padding-right: 2.5rem;
  }

  .clear-search-btn {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search-btn:hover {
    color: var(--text-primary);
  }

  .filter-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  .select-icon {
    position: absolute;
    left: 0.95rem;
    pointer-events: none;
  }

  .select-input {
    padding-left: 2.35rem;
    appearance: none;
    cursor: pointer;
  }

  .btn-clear {
    padding: 0.75rem 1rem;
  }

  /* Logs Section Table */
  .logs-section {
    padding-bottom: 1rem;
  }

  .logs-section .section-title {
    border-bottom: none;
    margin-bottom: 0.75rem;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .logs-table th {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .logs-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .log-row {
    transition: background-color var(--transition-fast);
  }

  .log-row:hover {
    background-color: var(--bg-input);
  }

  .doc-num-cell {
    font-family: var(--font-display);
    font-weight: bold;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: bold;
    padding: 0.25rem 0.65rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid transparent;
  }

  .badge-facture {
    background-color: hsla(210, 100%, 56%, 0.1);
    border-color: var(--color-primary);
    color: hsl(210, 100%, 75%);
  }

  .badge-proforma {
    background-color: hsla(38, 92%, 50%, 0.1);
    border-color: var(--color-warning);
    color: hsl(38, 92%, 75%);
  }

  .badge-livraison {
    background-color: hsla(199, 89%, 48%, 0.1);
    border-color: var(--color-info);
    color: hsl(199, 89%, 75%);
  }

  /* Client cell */
  .client-cell {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .client-name {
    font-weight: 550;
    color: var(--text-primary);
  }

  .client-code {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .date-cell {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .amount-cell {
    font-family: var(--font-display);
    font-weight: bold;
    font-size: 1rem;
    color: var(--text-primary);
    text-align: right;
  }

  /* Actions */
  .action-buttons-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .action-btn {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.45rem;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .view-btn:hover {
    color: var(--color-primary);
    background-color: rgba(59, 130, 246, 0.1);
  }

  .edit-btn:hover {
    color: var(--color-warning);
    background-color: rgba(245, 158, 11, 0.1);
  }

  .duplicate-btn:hover {
    color: var(--color-info);
    background-color: rgba(14, 165, 233, 0.1);
  }

  .delete-btn:hover {
    color: var(--color-danger);
    background-color: rgba(239, 68, 68, 0.1);
  }

  /* Empty state */
  .empty-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 2rem;
    gap: 0.75rem;
  }

  .empty-state-box h4 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 0.5rem;
  }

  .empty-state-box p {
    font-size: 0.95rem;
    max-width: 400px;
  }
</style>
