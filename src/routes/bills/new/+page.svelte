<script lang="ts">
  import { enhance } from '$app/forms';
  import { numberToWordsFrench } from '$lib/utils/frenchWords';
  import { 
    Plus, 
    Trash2, 
    ChevronDown, 
    Receipt, 
    FileText, 
    Truck, 
    AlertCircle,
    User,
    Calendar,
    Hash
  } from '@lucide/svelte';

  let { data, form } = $props();

  // ----------------------------------------------------
  // FORM BINDINGS & REACTIVE STATE
  // ----------------------------------------------------
  let type = $state<'facture' | 'proforma' | 'livraison'>('facture');
  let billNumber = $state(data.defaultNumber || '');
  let date = $state(new Date().toISOString().split('T')[0]);
  let contractNumber = $state('');
  let contractDate = $state('');

  // Client Details
  let clientName = $state('');
  let clientCode = $state('');
  let clientAddress = $state('');

  // Client suggestions
  let clientSuggestions = $state<any[]>([]);
  let activeClientIndex = $state(-1);
  let showClientDropdown = $state(false);

  // Line Items Table
  interface LineItem {
    id: string;
    product_name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }

  let items = $state<LineItem[]>([
    { id: Math.random().toString(), product_name: '', unit: 'UN', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  // Product Autocomplete
  let productSuggestions = $state<any[]>([]);
  let activeProductIndex = $state(-1);
  let focusedRowIndex = $state<number | null>(null);

  // TVA controls
  let hasTva = $state(false); // Exempted by default in Cloud Pi template
  let tvaRate = $state(19);

  // Calculations
  let subtotalHT = $derived(
    items.reduce((sum, item) => sum + (parseFloat(item.total_price.toString()) || 0), 0)
  );
  let tvaAmount = $derived(
    hasTva ? (subtotalHT * (tvaRate / 100)) : 0
  );
  let totalTTC = $derived(
    subtotalHT + tvaAmount
  );
  
  // Dynamic spelling in French words
  let spelledAmount = $derived(
    numberToWordsFrench(type === 'livraison' ? 0 : totalTTC)
  );

  let saving = $state(false);

  // ----------------------------------------------------
  // SWITCH BILL TYPE NUMBER AUTO-FETCH
  // ----------------------------------------------------
  async function handleTypeChange(newType: 'facture' | 'proforma' | 'livraison') {
    type = newType;
    try {
      const response = await fetch(`/api/next-bill-number?type=${newType}`);
      const result = await response.json();
      if (result.number) {
        billNumber = result.number;
      }
    } catch (err) {
      console.error('Failed to fetch next number:', err);
    }
  }

  // ----------------------------------------------------
  // CLIENT AUTOCOMPLETE LOGIC
  // ----------------------------------------------------
  async function searchClientsQuery(query: string) {
    if (query.trim().length < 2) {
      clientSuggestions = [];
      showClientDropdown = false;
      return;
    }

    try {
      const response = await fetch(`/api/clients?q=${encodeURIComponent(query)}`);
      clientSuggestions = await response.json();
      showClientDropdown = clientSuggestions.length > 0;
      activeClientIndex = -1;
    } catch (err) {
      console.error(err);
    }
  }

  function selectClient(client: any) {
    clientName = client.name;
    clientCode = client.code;
    clientAddress = client.address;
    clientSuggestions = [];
    showClientDropdown = false;
  }

  function handleClientKeydown(e: KeyboardEvent) {
    if (!showClientDropdown || clientSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeClientIndex = (activeClientIndex + 1) % clientSuggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeClientIndex = (activeClientIndex - 1 + clientSuggestions.length) % clientSuggestions.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeClientIndex >= 0 && activeClientIndex < clientSuggestions.length) {
        selectClient(clientSuggestions[activeClientIndex]);
      }
    } else if (e.key === 'Escape') {
      showClientDropdown = false;
    }
  }

  // ----------------------------------------------------
  // PRODUCT AUTOCOMPLETE LOGIC
  // ----------------------------------------------------
  async function searchProductsQuery(query: string, rowIndex: number) {
    focusedRowIndex = rowIndex;
    if (query.trim().length < 1) {
      productSuggestions = [];
      return;
    }

    try {
      const response = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
      productSuggestions = await response.json();
      activeProductIndex = -1;
    } catch (err) {
      console.error(err);
    }
  }

  function selectProduct(product: any, rowIndex: number) {
    items[rowIndex].product_name = product.name;
    items[rowIndex].unit = product.unit;
    items[rowIndex].unit_price = product.default_price;
    updateRowTotal(rowIndex);
    
    productSuggestions = [];
    focusedRowIndex = null;
  }

  function handleProductKeydown(e: KeyboardEvent, rowIndex: number) {
    if (productSuggestions.length === 0 || focusedRowIndex !== rowIndex) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeProductIndex = (activeProductIndex + 1) % productSuggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeProductIndex = (activeProductIndex - 1 + productSuggestions.length) % productSuggestions.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeProductIndex >= 0 && activeProductIndex < productSuggestions.length) {
        selectProduct(productSuggestions[activeProductIndex], rowIndex);
      }
    } else if (e.key === 'Escape') {
      focusedRowIndex = null;
    }
  }

  // ----------------------------------------------------
  // ITEMS LIST MANAGEMENT
  // ----------------------------------------------------
  function addRow() {
    items = [
      ...items,
      { id: Math.random().toString(), product_name: '', unit: 'UN', quantity: 1, unit_price: 0, total_price: 0 }
    ];
  }

  function removeRow(index: number) {
    if (items.length > 1) {
      items = items.filter((_, i) => i !== index);
    } else {
      items = [{ id: Math.random().toString(), product_name: '', unit: 'UN', quantity: 1, unit_price: 0, total_price: 0 }];
    }
  }

  function updateRowTotal(index: number) {
    const qty = parseFloat(items[index].quantity.toString()) || 0;
    const price = parseFloat(items[index].unit_price.toString()) || 0;
    items[index].total_price = Number((qty * price).toFixed(2));
  }
</script>

<div class="editor-container">
  
  <!-- Form Header -->
  <header class="page-header">
    <div class="header-icon">
      <Receipt size={28} />
    </div>
    <div>
      <h1>Create New Billing Document</h1>
      <p class="text-secondary">Draft standard invoices, proforma documents, or delivery shipment sheets.</p>
    </div>
  </header>

  {#if form?.error}
    <div class="banner banner-error">
      <AlertCircle size={20} />
      <span>{form.error}</span>
    </div>
  {/if}

  <form method="POST" action="?/createBill" use:enhance={() => {
    saving = true;
    return async ({ update }) => {
      await update();
      saving = false;
    };
  }} class="editor-form">
    
    <!-- 1. DOCUMENT TYPE SELECTOR CARDS -->
    <div class="type-selector-grid">
      <button 
        type="button" 
        class="type-card" 
        class:active={type === 'facture'} 
        onclick={() => handleTypeChange('facture')}
      >
        <div class="type-icon-wrapper facture-icon">
          <Receipt size={24} />
        </div>
        <div class="type-meta">
          <h3>Facture</h3>
          <p>Standard Tax Invoice</p>
        </div>
      </button>

      <button 
        type="button" 
        class="type-card" 
        class:active={type === 'proforma'} 
        onclick={() => handleTypeChange('proforma')}
      >
        <div class="type-icon-wrapper proforma-icon">
          <FileText size={24} />
        </div>
        <div class="type-meta">
          <h3>Facture Proforma</h3>
          <p>Estimate / Client Quote</p>
        </div>
      </button>

      <button 
        type="button" 
        class="type-card" 
        class:active={type === 'livraison'} 
        onclick={() => handleTypeChange('livraison')}
      >
        <div class="type-icon-wrapper livraison-icon">
          <Truck size={24} />
        </div>
        <div class="type-meta">
          <h3>Bon de Livraison</h3>
          <p>Delivery & Shipment Note</p>
        </div>
      </button>
    </div>

    <!-- Hidden bindings for nested items and type -->
    <input type="hidden" name="type" value={type} />
    <input type="hidden" name="items" value={JSON.stringify(items)} />
    <input type="hidden" name="montant_ht" value={type === 'livraison' ? 0 : subtotalHT} />
    <input type="hidden" name="montant_ttc" value={type === 'livraison' ? 0 : totalTTC} />
    <input type="hidden" name="tva_rate" value={hasTva ? tvaRate : 0} />
    <input type="hidden" name="amount_in_words" value={spelledAmount} />

    <!-- 2. DOCUMENT METADATA -->
    <div class="card form-section">
      <h3 class="section-title">Document Metadata</h3>
      <div class="metadata-grid">
        <div class="form-group">
          <label for="bill_number"><Hash size={14} /> Document Number</label>
          <input 
            type="text" 
            id="bill_number" 
            name="bill_number" 
            class="input-field" 
            bind:value={billNumber} 
            placeholder="e.g. 2025-0009"
            required 
          />
        </div>

        <div class="form-group">
          <label for="date"><Calendar size={14} /> Date</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            class="input-field" 
            bind:value={date} 
            required 
          />
        </div>

        <div class="form-group">
          <label for="contract_number">Contract N° (Optional)</label>
          <input 
            type="text" 
            id="contract_number" 
            name="contract_number" 
            class="input-field" 
            bind:value={contractNumber} 
            placeholder="e.g. 16"
          />
        </div>

        <div class="form-group">
          <label for="contract_date">Contract Date (Optional)</label>
          <input 
            type="date" 
            id="contract_date" 
            name="contract_date" 
            class="input-field" 
            bind:value={contractDate} 
          />
        </div>
      </div>
    </div>

    <!-- 3. CLIENT INFO (WITH AUTOCOMPLETE) -->
    <div class="card form-section">
      <h3 class="section-title">Client Details</h3>
      <div class="client-grid">
        <div class="form-group relative">
          <label for="client_name"><User size={14} /> Client Name</label>
          <input 
            type="text" 
            id="client_name" 
            name="client_name" 
            class="input-field" 
            bind:value={clientName} 
            oninput={() => searchClientsQuery(clientName)}
            onkeydown={handleClientKeydown}
            onfocus={() => { if (clientSuggestions.length > 0) showClientDropdown = true; }}
            onblur={() => setTimeout(() => showClientDropdown = false, 200)}
            placeholder="Type customer name..."
            autocomplete="off"
            required 
          />
          
          <!-- Client Autocomplete Dropdown -->
          {#if showClientDropdown && clientSuggestions.length > 0}
            <ul class="autocomplete-dropdown">
              {#each clientSuggestions as client, idx}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
                <li 
                  class="dropdown-item" 
                  class:highlight={idx === activeClientIndex}
                  onclick={() => selectClient(client)}
                  role="option"
                  aria-selected={idx === activeClientIndex}
                >
                  <span class="client-code-tag">{client.code}</span>
                  <span class="client-name-text">{client.name}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="form-group">
          <label for="client_code">Client Code (Optional)</label>
          <input 
            type="text" 
            id="client_code" 
            name="client_code" 
            class="input-field" 
            bind:value={clientCode} 
            placeholder="e.g. C001"
          />
        </div>

        <div class="form-group client-address-group">
          <label for="client_address">Client Address</label>
          <input 
            type="text" 
            id="client_address" 
            name="client_address" 
            class="input-field" 
            bind:value={clientAddress} 
            placeholder="e.g. Tamenrasset, 10000, Algérie"
          />
        </div>
      </div>
    </div>

    <!-- 4. DYNAMIC LINE ITEMS TABLE -->
    <div class="card form-section items-section">
      <div class="items-header">
        <h3 class="section-title">Line Items</h3>
        <button type="button" class="btn btn-secondary btn-sm" onclick={addRow}>
          <Plus size={16} />
          <span>Add Row</span>
        </button>
      </div>

      <div class="table-responsive">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 60px;">N°</th>
              <th>Product / Description</th>
              <th style="width: 100px;">Unit</th>
              <th style="width: 120px;">Qty.</th>
              {#if type !== 'livraison'}
                <th style="width: 150px;">Unit Price (DZD)</th>
                <th style="width: 150px;">Total (DZD)</th>
              {/if}
              <th style="width: 60px;"></th>
            </tr>
          </thead>
          <tbody>
            {#each items as item, index (item.id)}
              <tr class="item-row">
                <td class="row-num-cell">{index + 1}</td>
                
                <!-- Product Autocomplete Cell -->
                <td class="relative">
                  <input 
                    type="text" 
                    class="input-field table-input" 
                    bind:value={item.product_name} 
                    oninput={() => searchProductsQuery(item.product_name, index)}
                    onkeydown={(e) => handleProductKeydown(e, index)}
                    onfocus={() => searchProductsQuery(item.product_name, index)}
                    onblur={() => setTimeout(() => { if (focusedRowIndex === index) focusedRowIndex = null; }, 200)}
                    placeholder="Enter product or catalog item name..."
                    autocomplete="off"
                    required
                  />

                  <!-- Product dropdown suggestions -->
                  {#if focusedRowIndex === index && productSuggestions.length > 0}
                    <ul class="autocomplete-dropdown product-dropdown">
                      {#each productSuggestions as prod, idx}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
                        <li 
                          class="dropdown-item" 
                          class:highlight={idx === activeProductIndex}
                          onclick={() => selectProduct(prod, index)}
                          role="option"
                          aria-selected={idx === activeProductIndex}
                        >
                          <div class="prod-dropdown-meta">
                            <span class="prod-name-lbl">{prod.name}</span>
                            {#if prod.description}
                              <span class="prod-desc-lbl">{prod.description.substring(0, 70)}...</span>
                            {/if}
                          </div>
                          {#if type !== 'livraison'}
                            <span class="prod-price-lbl">{prod.default_price.toLocaleString()} DZD</span>
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </td>

                <td>
                  <input 
                    type="text" 
                    class="input-field table-input text-center" 
                    bind:value={item.unit} 
                    placeholder="UN" 
                  />
                </td>

                <td>
                  <input 
                    type="number" 
                    step="any"
                    class="input-field table-input text-right" 
                    bind:value={item.quantity} 
                    oninput={() => updateRowTotal(index)}
                    min="0.0001"
                    required 
                  />
                </td>

                {#if type !== 'livraison'}
                  <td>
                    <input 
                      type="number" 
                      step="any"
                      class="input-field table-input text-right" 
                      bind:value={item.unit_price} 
                      oninput={() => updateRowTotal(index)}
                      min="0"
                      required 
                    />
                  </td>
                  <td class="text-right val-cell">
                    {(item.total_price || 0).toLocaleString()}
                  </td>
                {/if}

                <td class="text-center">
                  <button 
                    type="button" 
                    class="delete-row-btn" 
                    onclick={() => removeRow(index)}
                    aria-label="Delete row"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 5. CALCULATIONS & SPELLED WORDS -->
    {#if type !== 'livraison'}
      <div class="card calculation-layout">
        <div class="spelling-block">
          <span class="spelling-title">Montant en Lettres (French Words)</span>
          <p class="spelling-content">{spelledAmount}</p>
        </div>

        <div class="totals-block">
          <!-- Subtotal HT -->
          <div class="total-row">
            <span class="lbl">Montant HT</span>
            <span class="val">{subtotalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
          </div>

          <!-- TVA Toggler -->
          <div class="total-row border-row">
            <label class="tva-label-toggle">
              <input type="checkbox" bind:checked={hasTva} />
              <span>Apply TVA (19%)</span>
            </label>
            {#if hasTva}
              <span class="val">{tvaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
            {:else}
              <span class="val text-muted">Exempted (0.00)</span>
            {/if}
          </div>

          <!-- Montant TTC -->
          <div class="total-row ttc-row">
            <span class="lbl">Montant TTC</span>
            <span class="val">{totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 6. SUBMIT BUTTONS -->
    <div class="form-actions">
      <a href="/" class="btn btn-secondary">Cancel</a>
      <button 
        type="submit" 
        class="btn btn-primary" 
        disabled={saving}
      >
        <span>{saving ? 'Creating Document...' : 'Create Document'}</span>
      </button>
    </div>

  </form>
</div>

<style>
  .editor-container {
    max-width: 1100px;
    margin: 0 auto;
    padding-bottom: 3rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .header-icon {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    border-radius: var(--border-radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
  }

  .page-header h1 {
    font-size: 1.75rem;
    letter-spacing: -0.02em;
  }

  .page-header p {
    font-size: 0.95rem;
  }

  /* Notifications */
  .banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: var(--border-radius-md);
    margin-bottom: 1.5rem;
    font-weight: 500;
  }

  .banner-error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-danger);
    color: hsl(350, 80%, 80%);
  }

  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Document Type Selector */
  .type-selector-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .type-selector-grid {
      grid-template-columns: 1fr;
    }
  }

  .type-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .type-card:hover {
    transform: translateY(-2px);
    border-color: var(--text-muted);
  }

  .type-card.active {
    border-color: var(--color-primary);
    background: var(--bg-hover);
    box-shadow: var(--shadow-glow);
  }

  .type-icon-wrapper {
    background-color: var(--bg-input);
    padding: 0.75rem;
    border-radius: var(--border-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .facture-icon { color: var(--color-primary); }
  .proforma-icon { color: var(--color-warning); }
  .livraison-icon { color: var(--color-info); }

  .type-meta h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.15rem;
  }

  .type-meta p {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  /* Form Sections */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-title {
    font-size: 1.15rem;
    font-family: var(--font-display);
    color: var(--text-primary);
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  @media (max-width: 900px) {
    .metadata-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 500px) {
    .metadata-grid {
      grid-template-columns: 1fr;
    }
  }

  .metadata-grid label, .client-grid label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .client-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1rem;
  }

  .client-address-group {
    grid-column: span 2;
  }

  @media (max-width: 768px) {
    .client-grid {
      grid-template-columns: 1fr;
    }
    .client-address-group {
      grid-column: span 1;
    }
  }

  /* Autocomplete Dropdown list */
  .relative {
    position: relative;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    list-style: none;
    margin-top: 0.25rem;
  }

  .dropdown-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: background-color var(--transition-fast);
  }

  .dropdown-item:hover, .dropdown-item.highlight {
    background-color: var(--bg-hover);
  }

  .client-code-tag {
    background-color: var(--bg-input);
    color: var(--color-primary);
    font-size: 0.75rem;
    font-weight: bold;
    padding: 0.2rem 0.5rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .client-name-text {
    font-weight: 500;
    color: var(--text-primary);
  }

  /* Table Items */
  .items-section {
    padding-bottom: 1rem;
  }

  .items-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .items-header .section-title {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }

  .table-responsive {
    overflow-x: auto;
    margin-top: 0.5rem;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .items-table th {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 0.75rem 0.5rem;
    border-bottom: 2px solid var(--border-color);
  }

  .items-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .row-num-cell {
    text-align: center;
    color: var(--text-muted);
    font-weight: 600;
  }

  .table-input {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    border-radius: var(--border-radius-sm);
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }

  .val-cell {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.95rem;
    padding-right: 1rem !important;
  }

  .delete-row-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color var(--transition-fast);
    padding: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .delete-row-btn:hover {
    color: var(--color-danger);
  }

  /* Product Dropdown specific styling */
  .product-dropdown {
    max-height: 185px;
  }

  .prod-dropdown-meta {
    display: flex;
    flex-direction: column;
    flex: 1;
    text-align: left;
  }

  .prod-name-lbl {
    font-weight: 600;
    color: var(--text-primary);
  }

  .prod-desc-lbl {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  .prod-price-lbl {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: bold;
    color: var(--color-primary);
  }

  /* Calculation block */
  .calculation-layout {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 2rem;
    align-items: start;
  }

  @media (max-width: 768px) {
    .calculation-layout {
      grid-template-columns: 1fr;
    }
  }

  .spelling-block {
    background-color: var(--bg-input);
    border: 1px solid var(--border-color);
    padding: 1.25rem;
    border-radius: var(--border-radius-md);
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .spelling-title {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: bold;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .spelling-content {
    font-size: 1rem;
    font-weight: 550;
    font-style: italic;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .totals-block {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.95rem;
  }

  .total-row .lbl {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .total-row .val {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--text-primary);
  }

  .border-row {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.85rem;
  }

  .tva-label-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-secondary);
    user-select: none;
  }

  .tva-label-toggle input {
    cursor: pointer;
  }

  .ttc-row {
    margin-top: 0.25rem;
  }

  .ttc-row .lbl {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: bold;
    color: var(--text-primary);
  }

  .ttc-row .val {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--color-primary);
    text-shadow: 0 0 15px var(--color-primary-glow);
  }

  /* Form actions */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .form-actions .btn {
    padding-left: 2rem;
    padding-right: 2rem;
  }
</style>
