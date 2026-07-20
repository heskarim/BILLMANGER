<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { numberToWordsFrench } from '$lib/utils/frenchWords';
  import type { BillDraftPayloadV1, DraftSaveState } from '$lib/bill-drafts';
  import {
    createBillDraftAutosave,
    DraftTransportConflict,
    DraftTransportPermanent,
    DraftTransportTransient,
    type DraftTransport
  } from '$lib/bill-draft-autosave';
  import DraftSaveStatus from '$lib/components/DraftSaveStatus.svelte';
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

  let { data } = $props();

  // ----------------------------------------------------
  // FORM BINDINGS & REACTIVE STATE
  // ----------------------------------------------------
  const restoredDraft = data.draft;
  const restoredPayload = restoredDraft?.payload;
  let type = $state<'facture' | 'proforma' | 'livraison'>(restoredPayload?.type ?? 'facture');
  let billNumber = $state(restoredPayload?.requestedBillNumber ?? data.defaultNumber ?? '');
  let date = $state(restoredPayload?.date ?? '');
  let contractNumber = $state(restoredPayload?.contractNumber ?? '');
  let contractDate = $state(restoredPayload?.contractDate ?? '');

  let showPreview = $state(false);

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

  // Client Details
  let clientName = $state(restoredPayload?.clientName ?? '');
  let clientCode = $state(restoredPayload?.clientCode ?? '');
  let clientAddress = $state(restoredPayload?.clientAddress ?? '');

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

  function createBlankItem(): LineItem {
    return { id: crypto.randomUUID(), product_name: '', unit: 'UN', quantity: 1, unit_price: 0, total_price: 0 };
  }

  let items = $state<LineItem[]>(restoredPayload
    ? restoredPayload.items.map((item) => ({
        id: item.rowKey,
        product_name: item.productName,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: Number((item.quantity * item.unitPrice).toFixed(2))
      }))
    : [createBlankItem()]);

  // Product Autocomplete
  let productSuggestions = $state<any[]>([]);
  let activeProductIndex = $state(-1);
  let focusedRowIndex = $state<number | null>(null);

  // TVA controls
  let hasTva = $state(restoredPayload?.hasTva ?? true);
  let tvaRate = $state(restoredPayload?.tvaRate ?? 19);

  // Calculations
  let subtotalHT = $derived(
    items.reduce((sum, item) => sum + (parseFloat(item.total_price.toString()) || 0), 0)
  );
  let tvaAmount = $derived(
    hasTva ? (subtotalHT * (tvaRate / 100)) : 0
  );
  let totalTTC = $derived(
    subtotalHT
  );
  
  // Dynamic spelling in French words
  let spelledAmount = $derived(
    numberToWordsFrench(type === 'livraison' ? 0 : totalTTC)
  );

  let saving = $state(false);
  let notes = $state(restoredPayload?.notes ?? '');
  let draftState = $state<DraftSaveState>(restoredDraft
    ? { kind: 'saved', updatedAt: restoredDraft.updatedAt }
    : { kind: 'idle' });
  let finalError = $state('');
  let fieldErrors = $state<Record<string, string>>({});
  let createdBillId = $state<number | null>(null);

  function payloadFromForm(): BillDraftPayloadV1 {
    return {
      version: 1,
      type,
      requestedBillNumber: billNumber,
      date,
      contractNumber,
      contractDate,
      clientName,
      clientCode,
      clientAddress,
      hasTva,
      tvaRate: Number(tvaRate),
      notes,
      items: items.map((item) => ({
        rowKey: item.id,
        productName: item.product_name,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price)
      }))
    };
  }

  const draftTransport: DraftTransport = {
    async save({ draftKey, expectedRevision, payload, keepalive }) {
      let response: Response;
      try {
        response = await fetch(`/api/bill-drafts/${encodeURIComponent(draftKey)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedRevision, payload }),
          keepalive
        });
      } catch {
        throw new DraftTransportTransient('Draft save failed');
      }
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) throw new DraftTransportConflict(body.serverRevision ?? expectedRevision);
      if (response.status >= 500 || response.status === 429) throw new DraftTransportTransient('Draft save failed');
      if (!response.ok) throw new DraftTransportPermanent(body.message ?? 'Draft data is invalid');
      return body;
    }
  };

  const autosave = createBillDraftAutosave({
    initialDraftKey: restoredDraft?.draftKey,
    initialRevision: restoredDraft?.revision,
    getPayload: payloadFromForm,
    transport: draftTransport,
    onState: (state) => { draftState = state; },
    onDraftCreated: (draftKey) => {
      const url = new URL(window.location.href);
      url.searchParams.set('draft', draftKey);
      history.replaceState(history.state, '', `${url.pathname}${url.search}`);
    }
  });

  function markMeaningfulChange(): void {
    finalError = '';
    fieldErrors = {};
    autosave.markMeaningfulChange();
  }

  let resumedNavigation = false;
  beforeNavigate((navigation) => {
    if (resumedNavigation || !autosave.hasPendingChanges() || !navigation.to?.url) return;
    const destination = `${navigation.to.url.pathname}${navigation.to.url.search}${navigation.to.url.hash}`;
    navigation.cancel();
    void autosave.flush().then(async () => {
      resumedNavigation = true;
      try {
        await goto(destination);
      } finally {
        resumedNavigation = false;
      }
    }).catch(() => {});
  });

  function handlePageHide(): void {
    autosave.bestEffortKeepalive();
  }

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!autosave.hasPendingChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handleBeforeUnload);
  onDestroy(() => {
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    autosave.dispose();
  });

  async function finalizeDraft(): Promise<void> {
    if (saving) return;
    saving = true;
    finalError = '';
    fieldErrors = {};
    createdBillId = null;
    try {
      if (!autosave.getDraftKey()) autosave.markMeaningfulChange();
      await autosave.flush();
      const draftKey = autosave.getDraftKey();
      if (!draftKey) throw new Error('Draft could not be created');
      const response = await fetch(`/api/bill-drafts/${encodeURIComponent(draftKey)}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: autosave.getRevision() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        fieldErrors = body.fields ?? {};
        if (body.latestSuggestedNumber) {
          finalError = `${body.message ?? 'Document number already exists'}. Latest suggestion: ${body.latestSuggestedNumber}`;
        } else {
          finalError = body.message ?? (response.status === 409 ? 'Draft changed in another tab.' : 'Document could not be created.');
        }
        return;
      }
      createdBillId = body.billId;
      resumedNavigation = true;
      try {
        await goto(`/bills/${body.billId}`);
      } catch {
        finalError = 'Document created. Use the link below to open it.';
      }
    } catch (error) {
      finalError = error instanceof Error ? error.message : 'Document could not be created.';
    } finally {
      saving = false;
    }
  }

  // ----------------------------------------------------
  // SWITCH BILL TYPE NUMBER AUTO-FETCH
  // ----------------------------------------------------
  async function handleTypeChange(newType: 'facture' | 'proforma' | 'livraison') {
    if (newType === type) return;
    type = newType;
    try {
      const response = await fetch(`/api/next-bill-number?type=${newType}`);
      const result = await response.json();
      if (result.number) billNumber = result.number;
    } catch (err) {
      console.error('Failed to fetch next number:', err);
    } finally {
      markMeaningfulChange();
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
    markMeaningfulChange();
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
    markMeaningfulChange();
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
    items = [...items, createBlankItem()];
    markMeaningfulChange();
  }

  function removeRow(index: number) {
    if (items.length > 1) {
      items = items.filter((_, i) => i !== index);
    } else {
      items = [createBlankItem()];
    }
    markMeaningfulChange();
  }

  function updateRowTotal(index: number) {
    const qty = parseFloat(items[index].quantity.toString()) || 0;
    const price = parseFloat(items[index].unit_price.toString()) || 0;
    items[index].total_price = Number((qty * price).toFixed(2));
  }
</script>

<div class="editor-container" class:with-preview={showPreview}>
  
  <!-- Form Header -->
  <header class="page-header animate-in">
    <div class="header-icon">
      <Receipt size={28} />
    </div>
    <div class="header-text">
      <h1>Create New Billing Document</h1>
      <p class="text-secondary">Draft standard invoices, proforma documents, or delivery shipment sheets.</p>
    </div>
    <div class="header-actions no-print">
      <button 
        type="button" 
        class="btn btn-secondary" 
        onclick={() => showPreview = !showPreview}
      >
        {#if showPreview}
          Hide Live Preview
        {:else}
          Show Live Preview
        {/if}
      </button>
    </div>
  </header>

  {#if finalError}
    <div class="banner banner-error" role="alert">
      <AlertCircle size={20} />
      <span>{finalError}</span>
      {#if createdBillId}<a href="/bills/{createdBillId}">Open document</a>{/if}
    </div>
  {/if}

  <div class="editor-workspace">
    <form onsubmit={(event) => { event.preventDefault(); void finalizeDraft(); }} class="editor-form">
    
    <!-- 1. DOCUMENT TYPE SELECTOR CARDS -->
    <div class="type-selector-grid">
      <button 
        type="button" 
        class="type-card" 
        class:active={type === 'facture'} 
        onclick={() => handleTypeChange('facture')}
        style="--i: 0"
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
        style="--i: 1"
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
        style="--i: 2"
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
    <input type="hidden" name="notes" value={notes} />

    <!-- 2. DOCUMENT METADATA -->
    <div class="card form-section" style="animation: fadeInUp 0.5s var(--ease-spring) both; animation-delay: 120ms;">
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
            oninput={markMeaningfulChange}
            aria-invalid={Boolean(fieldErrors.requestedBillNumber)}
            placeholder="e.g. 2025-0009"
            required 
          />
          {#if fieldErrors.requestedBillNumber}<span class="field-error">{fieldErrors.requestedBillNumber}</span>{/if}
        </div>

        <div class="form-group">
          <label for="date"><Calendar size={14} /> Date</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            class="input-field" 
            bind:value={date}
            oninput={markMeaningfulChange}
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
            oninput={markMeaningfulChange}
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
            oninput={markMeaningfulChange}
          />
        </div>
      </div>
    </div>

    <!-- 3. CLIENT INFO (WITH AUTOCOMPLETE) -->
    <div class="card form-section client-section" style="animation: fadeInUp 0.5s var(--ease-spring) both; animation-delay: 200ms;">
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
            oninput={() => { markMeaningfulChange(); void searchClientsQuery(clientName); }}
            onkeydown={handleClientKeydown}
            onfocus={() => { if (clientSuggestions.length > 0) showClientDropdown = true; }}
            onblur={() => setTimeout(() => showClientDropdown = false, 200)}
            placeholder="Type customer name..."
            autocomplete="off"
            aria-invalid={Boolean(fieldErrors.clientName)}
            required 
          />
          {#if fieldErrors.clientName}<span class="field-error">{fieldErrors.clientName}</span>{/if}
          
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
            oninput={markMeaningfulChange}
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
            oninput={markMeaningfulChange}
            placeholder="e.g. Tamenrasset, 10000, Algérie"
          />
        </div>
      </div>
    </div>

    <!-- 4. DYNAMIC LINE ITEMS TABLE -->
    <div class="card form-section items-section" style="animation: fadeInUp 0.5s var(--ease-spring) both; animation-delay: 280ms;">
      <div class="items-header items-header-sticky">
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
                    oninput={() => { markMeaningfulChange(); void searchProductsQuery(item.product_name, index); }}
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
                    oninput={markMeaningfulChange}
                    placeholder="UN" 
                  />
                </td>

                <td>
                  <input 
                    type="number" 
                    step="any"
                    class="input-field table-input text-right" 
                    bind:value={item.quantity}
                    oninput={() => { updateRowTotal(index); markMeaningfulChange(); }}
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
                      oninput={() => { updateRowTotal(index); markMeaningfulChange(); }}
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
      <div class="card calculation-layout" style="animation: fadeInUp 0.5s var(--ease-spring) both; animation-delay: 360ms;">
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
              <input type="checkbox" bind:checked={hasTva} onchange={markMeaningfulChange} />
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

    <!-- 6. NOTES (Bon de Livraison only) -->
    {#if type === 'livraison'}
      <div class="card form-section" style="animation: fadeInUp 0.5s var(--ease-spring) both; animation-delay: 380ms;">
        <h3 class="section-title">Observations / Remarques <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 400;">(Optionnel)</span></h3>
        <div class="form-group">
          <textarea
            id="notes_field"
            class="input-field notes-textarea"
            bind:value={notes}
            oninput={markMeaningfulChange}
            placeholder="Ex: Livraison effectuée dans les délais convenus. Matériel en bon état..."
            rows="3"
          ></textarea>
        </div>
      </div>
    {/if}

    <!-- 7. SUBMIT BUTTONS -->
    <div class="form-actions">
      <DraftSaveStatus
        state={draftState}
        onRetry={() => autosave.retry()}
        onReload={() => location.reload()}
      />
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

    <button
      type="button"
      class="btn btn-primary floating-add-row no-print"
      onclick={addRow}
      aria-label="Add another line item"
    >
      <Plus size={18} />
      <span>Add Row</span>
    </button>

    {#if showPreview}
      <!-- Live Preview Panel on the Right (inside workspace flex) -->
      <aside class="live-preview-panel no-print">
        <div class="preview-label">Live Preview</div>
        <div class="preview-zoom-container">
          <div class="preview-a4">
            <!-- Header -->
            <div style="border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 14px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; font-size: 8px;">
              <div style="display: flex; gap: 10px; align-items: start;">
                {#if data.settings?.logo}
                  <div style="width: 44px; height: 44px; border: 1px solid #ddd; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9f9f9; flex-shrink: 0;">
                    <img src={data.settings.logo} alt="" style="max-width: 40px; max-height: 40px; object-fit: contain;" />
                  </div>
                {/if}
                <div>
                  <h2 style="font-size: 14px; font-weight: 800; margin: 0; color: #1a1a2e; font-family: 'Plus Jakarta Sans', sans-serif;">{data.settings?.company_name || 'TECH IP'}</h2>
                  <p style="font-size: 8px; margin: 2px 0 0; color: #444; line-height: 1.3;">{data.settings?.address || ''}</p>
                  <p style="font-size: 8px; margin: 2px 0 0; color: #444;"><strong>Tél:</strong> {data.settings?.phone || '—'}</p>
                  <p style="font-size: 8px; margin: 2px 0 0; color: #444;"><strong>Email:</strong> {data.settings?.email || '—'}</p>
                </div>
              </div>
              <div style="border-left: 1.5px solid #1a1a2e; padding-left: 10px; display: flex; flex-direction: column; gap: 2px; color: #333; line-height: 1.3; font-size: 8px;">
                <div><strong>RC:</strong> {data.settings?.rc || '—'}</div>
                <div><strong>NIF:</strong> {data.settings?.nif || '—'}</div>
                <div><strong>NIS:</strong> {data.settings?.nis || '—'}</div>
                {#if data.settings?.art}<div><strong>ART:</strong> {data.settings.art}</div>{/if}
                <div style="font-size: 7.5px; word-break: break-all;"><strong>RIB:</strong> {data.settings?.rib || '—'}</div>
              </div>
            </div>

            <!-- Unified Metadata & Client Table -->
            <table class="doc-meta-table-preview" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.5px;">
              <thead>
                <tr>
                  <th colspan="2" style="border: 1px solid #1a1a2e; padding: 4px 6px; background: #1a1a2e; color: #1a1a2e; text-align: center; text-transform: uppercase; font-weight: 800; font-size: 9.5px; letter-spacing: 0.03em;">
                    <span style="color: white;">{#if type === 'facture'}FACTURE{:else if type === 'proforma'}FACTURE PROFORMA{:else}BON DE LIVRAISON{/if} N° {billNumber || '----'}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #1a1a2e; padding: 4px 6px; width: 50%;"><strong>Date:</strong> {type === 'facture' ? '' : (date ? formatDate(date) : '—')}</td>
                  <td style="border: 1px solid #1a1a2e; padding: 4px 6px; width: 50%;">
                    {#if contractNumber}
                      <strong>Contrat N°:</strong> {contractNumber} {#if contractDate}du {formatDate(contractDate)}{/if}
                    {:else}
                      <strong>Contrat:</strong> —
                    {/if}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #1a1a2e; padding: 3px 6px; background: #f0f0f5; color: #1a1a2e; font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: 0.02em;">Client</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #1a1a2e; padding: 4px 6px;"><strong>Client:</strong> {clientName || '—'}</td>
                  <td style="border: 1px solid #1a1a2e; padding: 4px 6px;"><strong>Code Client:</strong> {clientCode || '—'}</td>
                </tr>
                {#if clientAddress}
                  <tr>
                    <td colspan="2" style="border: 1px solid #1a1a2e; padding: 4px 6px;"><strong>Adresse:</strong> {clientAddress}</td>
                  </tr>
                {/if}
              </tbody>
            </table>

            <!-- Items Table -->
            <div style="flex: 1; margin-bottom: 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
                <thead>
                  <tr style="background: #f0f0f5;">
                    <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: center; width: 6%;">N°</th>
                    <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: left; width: 54%;">Désignation</th>
                    <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: center; width: 10%;">Unité</th>
                    {#if type !== 'livraison'}
                      <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: right; width: 10%;">P.U.</th>
                    {/if}
                    <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: center; width: 10%;">Qté</th>
                    {#if type !== 'livraison'}
                      <th style="border: 1px solid #1a1a2e; padding: 4px; text-align: right; width: 10%;">Total</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each items as item, idx}
                    <tr>
                      <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: center;">{idx + 1}</td>
                      <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: left;">{item.product_name || '...'}</td>
                      <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: center;">{item.unit || 'UN'}</td>
                      {#if type !== 'livraison'}
                        <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: right;">{(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      {/if}
                      <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: center;">{item.quantity || 0}</td>
                      {#if type !== 'livraison'}
                        <td style="border: 1px solid #1a1a2e; padding: 4px; text-align: right;">{(item.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Totals / Spelling / Signatures -->
            {#if type !== 'livraison'}
              <div style="display: grid; grid-template-columns: 1.5fr 1.1fr; gap: 10px; margin-top: 8px; border-top: 1.5px solid #1a1a2e; padding-top: 8px;">
                <div style="border: 1px solid #1a1a2e; border-radius: 3px; padding: 6px; font-size: 8px;">
                  <strong style="text-decoration: underline; display: block; margin-bottom: 2px;">Facture arrêtée à la somme de:</strong>
                  <span style="font-style: italic; color: #444;">{spelledAmount}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 8px;">
                  <tbody>
                    <tr>
                      <td style="border: 1px solid #1a1a2e; padding: 3px; text-align: left;">Montant HT</td>
                      <td style="border: 1px solid #1a1a2e; padding: 3px; text-align: right;">{subtotalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                    </tr>
                    {#if hasTva}
                      <tr>
                        <td style="border: 1px solid #1a1a2e; padding: 3px; text-align: left;">TVA ({tvaRate}%)</td>
                        <td style="border: 1px solid #1a1a2e; padding: 3px; text-align: right;">&nbsp;</td>
                      </tr>
                    {/if}
                    <tr style="background: #f0f0f5; font-weight: 800;">
                      <td style="border: 1px solid #1a1a2e; padding: 3.5px; text-align: left;">Montant TTC</td>
                      <td style="border: 1px solid #1a1a2e; padding: 3.5px; text-align: right;">{totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            {/if}

            {#if type === 'livraison'}
              {#if notes}
                <div style="border: 1px solid #1a1a2e; border-radius: 2px; padding: 5px 7px; margin-top: 10px; font-size: 7.5px;">
                  <strong style="display: block; text-decoration: underline; margin-bottom: 2px; text-transform: uppercase; font-size: 7px;">Observations / Remarques:</strong>
                  <span style="color: #444; white-space: pre-wrap;">{notes}</span>
                </div>
              {/if}
            {/if}
            {#if type !== 'livraison'}
              <div style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 18px; font-size: 8px; font-weight: 700;">
                <div style="text-align: right;">
                  <div>Signature &amp; Cachet (Fournisseur)</div>
                  <div style="height: 50px;"></div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </aside>
    {/if}
  </div>
</div>

<style>
  /* =================================================== */
  .editor-container {
    max-width: 1100px;
    margin: 0 auto;
    transition: max-width var(--duration-normal) var(--ease-spring);
  }

  .editor-container.with-preview {
    max-width: 1600px;
  }

  .editor-workspace {
    display: flex;
    gap: var(--space-6);
    align-items: flex-start;
    width: 100%;
  }

  .editor-form {
    flex: 1;
    min-width: 0;
  }

  .client-section {
    position: relative;
    z-index: 3;
  }

  .live-preview-panel {
    width: 600px;
    position: sticky;
    top: var(--space-6);
    height: calc(100vh - 120px);
    overflow-y: auto;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: inset 0 2px 8px oklch(0 0 0 / 0.4), var(--shadow-sm);
  }

  .preview-zoom-container {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .preview-a4 {
    background: white;
    color: #1a1a2e;
    width: 21cm;
    min-height: 29.7cm;
    padding: 1.5cm;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15);
    transform: scale(0.62);
    transform-origin: top center;
    margin-bottom: calc(-29.7cm * 0.38);
    box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 2px;
  }

  .preview-a4, .preview-a4 h2, .preview-a4 p, .preview-a4 td, .preview-a4 th, .preview-a4 span {
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    color: #1a1a2e;
  }

  .preview-label {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    align-self: center;
  }

  .preview-label::before,
  .preview-label::after {
    content: '';
    height: 1px;
    width: 30px;
    background: var(--border-color);
    display: inline-block;
  }

  .autocomplete-dropdown {
    overflow-x: hidden;
    z-index: 9999 !important;
  }

  .item-row:focus-within {
    position: relative;
    z-index: 20 !important;
  }

  /* ... (remaining styles) */
  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-8);
    animation: fadeInUp 0.5s var(--ease-spring) both;
  }

  .header-icon {
    background: linear-gradient(135deg, var(--color-accent), oklch(0.68 0.14 230));
    color: oklch(0.13 0.015 250);
    padding: var(--space-4);
    border-radius: var(--border-radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px var(--color-accent-glow);
    flex-shrink: 0;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .page-header h1 {
    font-size: var(--text-2xl);
    font-family: var(--font-display);
    letter-spacing: -0.03em;
    font-weight: 700;
    color: var(--text-primary);
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: 60ms;
  }

  .page-header p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: 120ms;
  }

  /* ===================================================
     ERROR BANNER
     =================================================== */
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--space-6);
    font-weight: 500;
  }

  .banner-error {
    background-color: var(--color-danger-bg);
    border: 1px solid var(--color-danger);
    color: oklch(0.85 0.15 25);
  }

  /* ===================================================
     EDITOR FORM LAYOUT
     =================================================== */
  .editor-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ===================================================
     TYPE SELECTOR CARDS
     =================================================== */
  .type-selector-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
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
    padding: var(--space-5) var(--space-6);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    text-align: left;
    transition: all var(--duration-fast) var(--ease-spring);
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: calc(var(--i, 0) * 60ms);
  }

  .type-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
    border-color: var(--text-muted);
  }

  .type-card.active {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);
    box-shadow: var(--shadow-glow);
  }

  .type-icon-wrapper {
    background-color: var(--bg-input);
    padding: var(--space-3);
    border-radius: var(--border-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) var(--ease-spring);
  }

  .type-card.active .type-icon-wrapper {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .facture-icon { color: var(--color-accent); }
  .proforma-icon { color: var(--color-warning); }
  .livraison-icon { color: var(--color-info); }

  .type-meta h3 {
    font-size: 1rem;
    font-family: var(--font-display);
    font-weight: 600;
    margin-bottom: 0.15rem;
    color: var(--text-primary);
  }

  .type-meta p {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* ===================================================
     FORM SECTIONS
     =================================================== */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-6);
  }

  .section-title {
    font-size: 1.15rem;
    font-family: var(--font-display);
    color: var(--text-primary);
    font-weight: 600;
    border-left: 3px solid var(--color-accent);
    padding-left: var(--space-3);
    margin-bottom: var(--space-1);
  }

  /* ===================================================
     METADATA & CLIENT GRIDS
     =================================================== */
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
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
    gap: var(--space-4);
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

  /* ===================================================
     AUTOCOMPLETE DROPDOWNS (glass-panel)
     =================================================== */
  .relative {
    position: relative;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    list-style: none;
    margin-top: var(--space-1);
  }

  .dropdown-item {
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    transition: background-color var(--transition-fast);
  }

  .dropdown-item:hover, .dropdown-item.highlight {
    background-color: var(--bg-hover);
  }

  .client-code-tag {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: var(--text-xs);
    font-weight: bold;
    padding: 0.2rem 0.5rem;
    border-radius: var(--border-radius-sm);
    border: none;
  }

  .client-name-text {
    font-weight: 500;
    color: var(--text-primary);
  }

  /* ===================================================
     LINE ITEMS TABLE
     =================================================== */
  .items-section {
    padding-bottom: var(--space-4);
    position: relative;
    z-index: 2;
  }

  .items-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .items-header-sticky {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: calc(-1 * var(--space-5)) calc(-1 * var(--space-5)) var(--space-4);
    padding: var(--space-3) var(--space-5);
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
    box-shadow: 0 8px 18px oklch(0 0 0 / 0.08);
  }

  .floating-add-row {
    display: inline-flex;
    position: fixed;
    right: var(--space-6);
    bottom: var(--space-6);
    z-index: 120;
    border-radius: var(--border-radius-pill);
    box-shadow: var(--shadow-lg), 0 0 0 4px var(--color-accent-glow);
  }


  .items-header .section-title {
    border-left: 3px solid var(--color-accent);
    padding-left: var(--space-3);
    margin-bottom: 0;
  }

  .btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: var(--text-sm);
  }

  .table-responsive {
    overflow-x: visible;
    margin-top: var(--space-2);
  }

  @media (max-width: 900px) {
    .floating-add-row {
      right: var(--space-4);
      bottom: var(--space-4);
    }

    .items-header-sticky {
      top: 0;
      margin-left: calc(-1 * var(--space-3));
      margin-right: calc(-1 * var(--space-3));
      padding-left: var(--space-3);
      padding-right: var(--space-3);
      gap: var(--space-2);
    }

    .items-header-sticky .section-title {
      min-width: 0;
      font-size: 1rem;
    }

    .items-header-sticky .btn {
      min-height: 2.5rem;
      flex-shrink: 0;
    }

    .items-header-sticky .btn span {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .table-responsive {
      overflow-x: auto;
    }
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .items-table th {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-muted);
    padding: var(--space-3) var(--space-2);
    border-bottom: 2px solid var(--border-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .items-table td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .item-row {
    transition: background-color var(--transition-fast);
  }

  .item-row:hover {
    background-color: var(--bg-hover);
  }

  .row-num-cell {
    text-align: center;
    color: var(--text-muted);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .table-input {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    border-radius: var(--border-radius-sm);
    transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
  }

  .table-input:focus {
    box-shadow: 0 0 0 2px var(--color-accent-glow);
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }

  .val-cell {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.95rem;
    padding-right: var(--space-4) !important;
    color: var(--text-primary);
  }

  .delete-row-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color var(--transition-fast), transform var(--duration-fast) var(--ease-spring);
    padding: var(--space-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
  }

  .delete-row-btn:hover {
    color: var(--color-danger);
    transform: scale(1.15);
  }

  /* Product dropdown specific */
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
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  .prod-price-lbl {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: bold;
    color: var(--color-accent);
  }

  /* ===================================================
     CALCULATION BLOCK
     =================================================== */
  .calculation-layout {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: var(--space-8);
    align-items: start;
    padding: var(--space-6);
    position: relative;
    z-index: 1;
  }

  @media (max-width: 768px) {
    .calculation-layout {
      grid-template-columns: 1fr;
    }
  }

  .spelling-block {
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-accent-glow);
    padding: var(--space-5);
    border-radius: var(--border-radius-md);
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .spelling-title {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-2);
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
    gap: var(--space-3);
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
    padding-bottom: var(--space-3);
  }

  .tva-label-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-secondary);
    user-select: none;
  }

  .tva-label-toggle input {
    cursor: pointer;
  }

  .ttc-row {
    margin-top: var(--space-1);
    padding-top: var(--space-2);
  }

  .ttc-row .lbl {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: bold;
    color: var(--text-primary);
  }

  .ttc-row .val {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 800;
    color: var(--color-accent);
    text-shadow: 0 0 20px var(--color-accent-glow);
  }

  /* ===================================================
     FORM ACTIONS (submit / cancel)
     =================================================== */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: 440ms;
  }

  .form-actions .btn {
    padding: var(--space-3) var(--space-8);
  }

  .form-actions .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--color-accent-glow);
  }

  /* ===================================================
     NOTES TEXTAREA (livraison only)
     =================================================== */
  .notes-textarea {
    width: 100%;
    resize: vertical;
    min-height: 70px;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

</style>
