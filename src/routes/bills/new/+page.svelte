<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
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

  onMount(() => {
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => autosave.dispose());

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
        if (response.status === 409 && typeof body.serverRevision === 'number') {
          draftState = { kind: 'conflict', serverRevision: body.serverRevision };
        }
        if (body.latestSuggestedNumber) {
          finalError = `${body.message ?? 'Document number already exists'}. Latest suggestion: ${body.latestSuggestedNumber}`;
        } else {
          finalError = body.message ?? (response.status === 409 ? 'Draft changed in another tab.' : 'Document could not be created.');
        }
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField === 'requestedBillNumber') document.getElementById('bill_number')?.focus();
        if (firstField === 'clientName') document.getElementById('client_name')?.focus();
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
  <header class="editor-topbar">
    <div class="topbar-title">
      <div class="topbar-kicker">New document</div>
      <h1>Create billing document</h1>
      <p>Choose a type, fill the details, and save a draft as you work.</p>
    </div>
    <div class="topbar-actions no-print">
      <DraftSaveStatus
        state={draftState}
        onRetry={() => autosave.retry()}
        onReload={() => location.reload()}
      />
      <button
        type="button"
        class="btn btn-secondary btn-compact"
        onclick={() => (showPreview = !showPreview)}
      >
        {showPreview ? 'Hide preview' : 'Show preview'}
      </button>
    </div>
  </header>

  {#if finalError}
    <div class="banner banner-error" role="alert">
      <AlertCircle size={18} />
      <div>
        <span>{finalError}</span>
        {#if Object.keys(fieldErrors).length > 0}
          <ul class="field-error-list">
            {#each [...new Set(Object.values(fieldErrors))] as message}
              <li>{message}</li>
            {/each}
          </ul>
        {/if}
        {#if createdBillId}<a href="/bills/{createdBillId}">Open document</a>{/if}
      </div>
    </div>
  {/if}

  <div class="editor-workspace">
    <form
      class="editor-form"
      onsubmit={(event) => {
        event.preventDefault();
        void finalizeDraft();
      }}
    >
      <section class="type-switch" aria-label="Document type">
        <button
          type="button"
          class="type-option"
          class:active={type === 'facture'}
          onclick={() => handleTypeChange('facture')}
        >
          <span class="type-option-icon facture-icon"><Receipt size={18} /></span>
          <span class="type-option-copy">
            <strong>Facture</strong>
            <small>Tax invoice</small>
          </span>
        </button>
        <button
          type="button"
          class="type-option"
          class:active={type === 'proforma'}
          onclick={() => handleTypeChange('proforma')}
        >
          <span class="type-option-icon proforma-icon"><FileText size={18} /></span>
          <span class="type-option-copy">
            <strong>Proforma</strong>
            <small>Estimate / quote</small>
          </span>
        </button>
        <button
          type="button"
          class="type-option"
          class:active={type === 'livraison'}
          onclick={() => handleTypeChange('livraison')}
        >
          <span class="type-option-icon livraison-icon"><Truck size={18} /></span>
          <span class="type-option-copy">
            <strong>Livraison</strong>
            <small>Delivery note</small>
          </span>
        </button>
      </section>

      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="montant_ht" value={type === 'livraison' ? 0 : subtotalHT} />
      <input type="hidden" name="montant_ttc" value={type === 'livraison' ? 0 : totalTTC} />
      <input type="hidden" name="tva_rate" value={hasTva ? tvaRate : 0} />
      <input type="hidden" name="amount_in_words" value={spelledAmount} />
      <input type="hidden" name="notes" value={notes} />

      <div class="form-panel">
        <section class="panel-section">
          <div class="panel-heading">
            <h2>Document details</h2>
            <p>Number, date, and optional contract references.</p>
          </div>
          <div class="field-grid metadata-grid">
            <div class="form-group">
              <label for="bill_number"><Hash size={14} /> Document number</label>
              <input
                type="text"
                id="bill_number"
                name="bill_number"
                class="input-field"
                bind:value={billNumber}
                oninput={markMeaningfulChange}
                aria-invalid={Boolean(fieldErrors.requestedBillNumber)}
                placeholder="e.g. 2026-0009"
                required
              />
              {#if fieldErrors.requestedBillNumber}
                <span class="field-error">{fieldErrors.requestedBillNumber}</span>
              {/if}
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
              <label for="contract_number">Contract N° <span class="optional">optional</span></label>
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
              <label for="contract_date">Contract date <span class="optional">optional</span></label>
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
        </section>

        <section class="panel-section client-section">
          <div class="panel-heading">
            <h2>Client</h2>
            <p>Search the catalog or enter a new client.</p>
          </div>
          <div class="field-grid client-grid">
            <div class="form-group relative">
              <label for="client_name"><User size={14} /> Client name</label>
              <input
                type="text"
                id="client_name"
                name="client_name"
                class="input-field"
                bind:value={clientName}
                oninput={() => {
                  markMeaningfulChange();
                  void searchClientsQuery(clientName);
                }}
                onkeydown={handleClientKeydown}
                onfocus={() => {
                  if (clientSuggestions.length > 0) showClientDropdown = true;
                }}
                onblur={() => setTimeout(() => (showClientDropdown = false), 200)}
                placeholder="Type customer name..."
                autocomplete="off"
                aria-invalid={Boolean(fieldErrors.clientName)}
                required
              />
              {#if fieldErrors.clientName}
                <span class="field-error">{fieldErrors.clientName}</span>
              {/if}

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
              <label for="client_code">Client code <span class="optional">optional</span></label>
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
              <label for="client_address">Client address</label>
              <input
                type="text"
                id="client_address"
                name="client_address"
                class="input-field"
                bind:value={clientAddress}
                oninput={markMeaningfulChange}
                placeholder="Street, city, postal code"
              />
            </div>
          </div>
        </section>

        <section class="panel-section items-section">
          <div class="items-header items-header-sticky">
            <div class="panel-heading compact">
              <h2>Line items</h2>
              <p>{items.length} line{items.length === 1 ? '' : 's'}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-compact" onclick={addRow}>
              <Plus size={16} />
              <span>Add row</span>
            </button>
          </div>

          <div class="table-responsive">
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-num">N°</th>
                  <th>Product / description</th>
                  <th class="col-unit">Unit</th>
                  <th class="col-qty">Qty</th>
                  {#if type !== 'livraison'}
                    <th class="col-price">Unit price</th>
                    <th class="col-total">Total</th>
                  {/if}
                  <th class="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {#each items as item, index (item.id)}
                  <tr class="item-row">
                    <td class="row-num-cell">{index + 1}</td>
                    <td class="relative product-cell">
                      <input
                        type="text"
                        class="input-field table-input"
                        bind:value={item.product_name}
                        oninput={() => {
                          markMeaningfulChange();
                          void searchProductsQuery(item.product_name, index);
                        }}
                        onkeydown={(e) => handleProductKeydown(e, index)}
                        onfocus={() => searchProductsQuery(item.product_name, index)}
                        onblur={() =>
                          setTimeout(() => {
                            if (focusedRowIndex === index) focusedRowIndex = null;
                          }, 200)}
                        placeholder="Product or catalog item"
                        autocomplete="off"
                        required
                      />

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
                        oninput={() => {
                          updateRowTotal(index);
                          markMeaningfulChange();
                        }}
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
                          oninput={() => {
                            updateRowTotal(index);
                            markMeaningfulChange();
                          }}
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
        </section>

        {#if type !== 'livraison'}
          <section class="panel-section totals-section">
            <div class="panel-heading">
              <h2>Totals</h2>
              <p>Amount in words updates automatically.</p>
            </div>
            <div class="calculation-layout">
              <div class="spelling-block">
                <span class="spelling-title">Montant en lettres</span>
                <p class="spelling-content">{spelledAmount}</p>
              </div>
              <div class="totals-block">
                <div class="total-row">
                  <span class="lbl">Montant HT</span>
                  <span class="val">{subtotalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
                </div>
                <div class="total-row border-row">
                  <label class="tva-label-toggle">
                    <input type="checkbox" bind:checked={hasTva} onchange={markMeaningfulChange} />
                    <span>Apply TVA (19%)</span>
                  </label>
                  {#if hasTva}
                    <span class="val">{tvaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
                  {:else}
                    <span class="val text-muted">Exempted</span>
                  {/if}
                </div>
                <div class="total-row ttc-row">
                  <span class="lbl">Montant TTC</span>
                  <span class="val">{totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2 })} DZD</span>
                </div>
              </div>
            </div>
          </section>
        {:else}
          <section class="panel-section">
            <div class="panel-heading">
              <h2>Observations</h2>
              <p>Optional remarks for the delivery note.</p>
            </div>
            <div class="form-group">
              <textarea
                id="notes_field"
                class="input-field notes-textarea"
                bind:value={notes}
                oninput={markMeaningfulChange}
                placeholder="Ex: Livraison effectuée dans les délais convenus..."
                rows="3"
              ></textarea>
            </div>
          </section>
        {/if}
      </div>

      <div class="editor-submit-bar">
        <a href="/" class="btn btn-secondary">Cancel</a>
        <button type="submit" class="btn btn-primary" disabled={saving}>
          <span>{saving ? 'Creating document…' : 'Create document'}</span>
        </button>
      </div>
    </form>

    {#if showPreview}
      <aside class="live-preview-panel no-print">
        <div class="preview-label">Live preview</div>
        <div class="preview-zoom-container">
          <div class="preview-a4">
            <div style="border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 14px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; font-size: 8px;">
              <div style="display: flex; gap: 10px; align-items: start;">
                {#if data.settings?.logo}
                  <div style="width: 44px; height: 44px; border: 1px solid #ddd; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9f9f9; flex-shrink: 0;">
                    <img src={data.settings.logo} alt="" style="max-width: 40px; max-height: 40px; object-fit: contain;" />
                  </div>
                {/if}
                <div>
                  <div style="font-weight: 800; font-size: 13px; margin-bottom: 2px;">{data.settings?.company_name || 'TECH IP'}</div>
                  {#if data.settings?.address}<div style="color: #444; line-height: 1.3;">{data.settings.address}</div>{/if}
                  <div style="color: #444; margin-top: 1px;"><strong>Tél:</strong> {data.settings?.phone || '—'}</div>
                  {#if data.settings?.email}<div style="color: #444;"><strong>Email:</strong> {data.settings.email}</div>{/if}
                </div>
              </div>
              <div style="border-left: 1.5px solid #1a1a2e; padding-left: 12px; display: flex; flex-direction: column; gap: 3px; color: #333;">
                <div><strong>RC:</strong> {data.settings?.rc || '—'}</div>
                <div><strong>NIF:</strong> {data.settings?.nif || '—'}</div>
                <div><strong>NIS:</strong> {data.settings?.nis || '—'}</div>
                {#if data.settings?.art}<div><strong>ART:</strong> {data.settings.art}</div>{/if}
                <div style="font-size: 7.5px;"><strong>RIB:</strong> {data.settings?.rib || '—'}</div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.5px;">
              <thead>
                <tr>
                  <th colspan="2" style="background: #1a1a2e; color: white; text-align: center; padding: 6px 8px; text-transform: uppercase; font-weight: 800; font-size: 9.5px; border: 1px solid #1a1a2e;">
                    {#if type === 'facture'}FACTURE{:else if type === 'proforma'}FACTURE PROFORMA{:else}BON DE LIVRAISON{/if}
                    N° {billNumber || '—'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="width: 50%; border: 1px solid #1a1a2e; padding: 5px 8px;"><strong>Date:</strong> {type === 'facture' ? '' : (formatDate(date) || '—')}</td>
                  <td style="width: 50%; border: 1px solid #1a1a2e; padding: 5px 8px;">
                    {#if contractNumber}
                      <strong>Contrat N°:</strong> {contractNumber}{#if contractDate} du {formatDate(contractDate)}{/if}
                    {:else}
                      <strong>Contrat:</strong> —
                    {/if}
                  </td>
                </tr>
                <tr>
                  <td style="border: 1px solid #1a1a2e; padding: 5px 8px;"><strong>Client:</strong> {clientName || '—'}</td>
                  <td style="border: 1px solid #1a1a2e; padding: 5px 8px;"><strong>Code Client:</strong> {clientCode || '—'}</td>
                </tr>
                {#if clientAddress}
                  <tr>
                    <td colspan="2" style="border: 1px solid #1a1a2e; padding: 5px 8px;"><strong>Adresse:</strong> {clientAddress}</td>
                  </tr>
                {/if}
              </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 12px;">
              <thead>
                <tr style="background: #f0f0f5;">
                  <th style="border: 1px solid #1a1a2e; padding: 4px 5px; width: 5%;">N°</th>
                  <th style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: left;">Désignation</th>
                  <th style="border: 1px solid #1a1a2e; padding: 4px 5px; width: 10%;">Unité</th>
                  {#if type !== 'livraison'}
                    <th style="border: 1px solid #1a1a2e; padding: 4px 5px; width: 12%; text-align: right;">P.U.</th>
                  {/if}
                  <th style="border: 1px solid #1a1a2e; padding: 4px 5px; width: 10%; text-align: center;">Qté.</th>
                  {#if type !== 'livraison'}
                    <th style="border: 1px solid #1a1a2e; padding: 4px 5px; width: 14%; text-align: right;">Total</th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each items as item, idx}
                  <tr>
                    <td style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: center;">{idx + 1}</td>
                    <td style="border: 1px solid #1a1a2e; padding: 4px 5px;">{item.product_name || '—'}</td>
                    <td style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: center;">{item.unit || 'UN'}</td>
                    {#if type !== 'livraison'}
                      <td style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: right;">{Number(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {/if}
                    <td style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: center;">{item.quantity}</td>
                    {#if type !== 'livraison'}
                      <td style="border: 1px solid #1a1a2e; padding: 4px 5px; text-align: right;">{Number(item.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>

            {#if type !== 'livraison'}
              <div style="display: grid; grid-template-columns: 1.5fr 1.1fr; gap: 12px; border-top: 2px solid #1a1a2e; padding-top: 10px;">
                <div style="border: 1px solid #1a1a2e; border-radius: 3px; padding: 8px 10px; font-size: 8.5px;">
                  <div style="font-weight: 700; text-decoration: underline; margin-bottom: 3px; text-transform: uppercase;">Facture arrêtée à la somme de:</div>
                  <div style="font-style: italic; color: #444;">{spelledAmount}</div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
                  <tbody>
                    <tr>
                      <td style="border: 1px solid #1a1a2e; padding: 4px 8px;">Montant HT</td>
                      <td style="border: 1px solid #1a1a2e; padding: 4px 8px; text-align: right; font-weight: 600;">{subtotalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                    </tr>
                    {#if hasTva}
                      <tr>
                        <td style="border: 1px solid #1a1a2e; padding: 4px 8px;">TVA ({tvaRate}%)</td>
                        <td style="border: 1px solid #1a1a2e; padding: 4px 8px; text-align: right;">&nbsp;</td>
                      </tr>
                    {/if}
                    <tr style="background: #f0f0f5;">
                      <td style="border: 1px solid #1a1a2e; padding: 4px 8px; font-weight: 800;">Montant TTC</td>
                      <td style="border: 1px solid #1a1a2e; padding: 4px 8px; text-align: right; font-weight: 800;">{totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2 })} DA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            {:else if notes}
              <div style="border: 1px solid #1a1a2e; border-radius: 3px; padding: 8px 10px; font-size: 8.5px; margin-top: 8px;">
                <div style="font-weight: 700; text-decoration: underline; margin-bottom: 3px; text-transform: uppercase;">Observations / Remarques:</div>
                <div style="color: #444; white-space: pre-wrap;">{notes}</div>
              </div>
            {/if}
          </div>
        </div>
      </aside>
    {/if}
  </div>
</div>

<style>
  .editor-container {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding-top: var(--space-2);
    transition: max-width var(--duration-normal) var(--ease-spring);
  }

  .editor-container.with-preview {
    max-width: 1640px;
  }

  .editor-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
    padding: var(--space-2) 0 var(--space-2) var(--space-10);
  }

  .topbar-kicker {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-1);
  }

  .topbar-title h1 {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: var(--text-primary);
  }

  .topbar-title p {
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    max-width: 42rem;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .btn-compact {
    padding: 0.55rem 0.95rem;
    min-height: 2.5rem;
  }

  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--border-radius-md);
    font-weight: 500;
  }

  .banner-error {
    background-color: var(--color-danger-bg);
    border: 1px solid color-mix(in oklab, var(--color-danger) 35%, transparent);
    color: var(--color-danger);
  }

  .field-error,
  .field-error-list {
    color: var(--color-danger);
    font-size: var(--text-xs);
  }

  .field-error-list {
    margin: var(--space-2) 0 0 var(--space-4);
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
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .type-switch {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
  }

  .type-option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-spring),
      border-color var(--duration-fast) var(--ease-spring),
      color var(--duration-fast) var(--ease-spring),
      box-shadow var(--duration-fast) var(--ease-spring);
  }

  .type-option:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .type-option.active {
    background: var(--color-accent-subtle);
    border-color: color-mix(in oklab, var(--color-accent) 35%, transparent);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-accent) 18%, transparent);
  }

  .type-option-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .type-option.active .type-option-icon {
    border-color: color-mix(in oklab, var(--color-accent) 30%, transparent);
    background: color-mix(in oklab, var(--color-accent-subtle) 70%, white);
  }

  .facture-icon { color: var(--color-accent); }
  .proforma-icon { color: var(--color-warning); }
  .livraison-icon { color: var(--color-info); }

  .type-option-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .type-option-copy strong {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.2;
  }

  .type-option-copy small {
    color: var(--text-muted);
    font-size: var(--text-xs);
    line-height: 1.3;
  }

  .form-panel {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: var(--shadow-sm);
    overflow: visible;
  }

  .panel-section {
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--border-color);
  }

  .panel-section:last-child {
    border-bottom: none;
  }

  .panel-heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--space-4);
  }

  .panel-heading.compact {
    margin-bottom: 0;
  }

  .panel-heading h2 {
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .panel-heading p {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .optional {
    color: var(--text-muted);
    font-weight: 500;
    text-transform: lowercase;
  }

  .field-grid {
    display: grid;
    gap: var(--space-4);
  }

  .metadata-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .client-grid {
    grid-template-columns: 1.5fr 1fr;
  }

  .client-address-group {
    grid-column: 1 / -1;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .form-group label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .client-section {
    position: relative;
    z-index: 3;
  }

  .items-section {
    position: relative;
    z-index: 2;
    padding-top: 0;
  }

  .items-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .items-header-sticky {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0 calc(-1 * var(--space-6));
    padding: var(--space-4) var(--space-6);
    background: color-mix(in oklab, var(--bg-card) 92%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
  }

  .table-responsive {
    overflow-x: auto;
    margin: 0 calc(-1 * var(--space-2));
    padding: 0 var(--space-2);
  }

  .items-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
  }

  .items-table th {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    padding: var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .items-table td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .col-num { width: 48px; }
  .col-unit { width: 88px; }
  .col-qty { width: 100px; }
  .col-price { width: 130px; }
  .col-total { width: 120px; }
  .col-actions { width: 48px; }

  .item-row:hover {
    background: var(--bg-hover);
  }

  .item-row:focus-within {
    position: relative;
    z-index: 20;
    background: color-mix(in oklab, var(--color-accent-subtle) 55%, transparent);
  }

  .row-num-cell {
    text-align: center;
    color: var(--text-muted);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .table-input {
    padding: 0.55rem 0.7rem;
    font-size: var(--text-sm);
    border-radius: var(--border-radius-sm);
  }

  .table-input:focus {
    box-shadow: 0 0 0 2px var(--color-accent-glow);
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }

  .val-cell {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-sm);
    color: var(--text-primary);
    white-space: nowrap;
  }

  .delete-row-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color var(--transition-fast), background-color var(--transition-fast);
    padding: var(--space-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
  }

  .delete-row-btn:hover {
    color: var(--color-danger);
    background: var(--color-danger-bg);
  }

  .relative {
    position: relative;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    max-height: 220px;
    overflow-y: auto;
    list-style: none;
  }

  .product-dropdown {
    min-width: min(420px, 70vw);
  }

  .dropdown-item {
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    transition: background-color var(--transition-fast);
  }

  .dropdown-item:hover,
  .dropdown-item.highlight {
    background-color: var(--bg-hover);
  }

  .client-code-tag {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: var(--text-xs);
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: var(--border-radius-sm);
  }

  .client-name-text {
    font-weight: 500;
    color: var(--text-primary);
  }

  .prod-dropdown-meta {
    display: flex;
    flex-direction: column;
    flex: 1;
    text-align: left;
    min-width: 0;
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
    font-weight: 700;
    color: var(--color-accent);
    white-space: nowrap;
  }

  .calculation-layout {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: var(--space-5);
    align-items: stretch;
  }

  .spelling-block {
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    padding: var(--space-5);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
  }

  .spelling-title {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spelling-content {
    font-size: var(--text-md);
    font-weight: 600;
    font-style: italic;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .totals-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-input);
  }

  .total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .total-row .lbl {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .total-row .val {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
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
    color: var(--text-secondary);
    user-select: none;
  }

  .ttc-row {
    margin-top: var(--space-1);
    padding-top: var(--space-2);
  }

  .ttc-row .lbl,
  .ttc-row .val {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 800;
  }

  .ttc-row .val {
    color: var(--color-accent);
  }

  .notes-textarea {
    width: 100%;
    resize: vertical;
    min-height: 88px;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .editor-submit-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) 0 var(--space-2);
    position: static;
  }

  .editor-submit-bar .btn {
    min-height: 2.75rem;
    padding: 0.7rem 1.25rem;
  }

  .live-preview-panel {
    width: 560px;
    position: sticky;
    top: var(--space-4);
    height: calc(100vh - 120px);
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: var(--space-5) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: var(--shadow-sm);
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
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
    transform: scale(0.58);
    transform-origin: top center;
    margin-bottom: calc(-29.7cm * 0.42);
    box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 2px;
  }

  .preview-a4,
  .preview-a4 td,
  .preview-a4 th {
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    color: #1a1a2e;
  }

  .preview-label {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--space-4);
  }

  @media (max-width: 1180px) {
    .editor-container.with-preview {
      max-width: 1120px;
    }

    .editor-workspace {
      flex-direction: column;
    }

    .live-preview-panel {
      width: 100%;
      height: auto;
      position: static;
    }
  }

  @media (max-width: 900px) {
    .metadata-grid {
      grid-template-columns: 1fr 1fr;
    }

    .type-switch {
      grid-template-columns: 1fr;
    }

    .type-option {
      min-height: 56px;
    }

    .items-header-sticky {
      margin-left: calc(-1 * var(--space-4));
      margin-right: calc(-1 * var(--space-4));
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }

    .panel-section {
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }
  }

  @media (max-width: 700px) {
    .editor-topbar {
      flex-direction: column;
      align-items: stretch;
      padding-left: var(--space-8);
    }

    .topbar-actions {
      justify-content: space-between;
    }

    .metadata-grid,
    .client-grid,
    .calculation-layout {
      grid-template-columns: 1fr;
    }

    .editor-submit-bar {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .editor-submit-bar .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
