<script lang="ts">
  import BillPrintDocument from '$lib/components/BillPrintDocument.svelte';
  let { data } = $props();
</script>

<svelte:head><title>PDF {data.bill.bill_number}</title></svelte:head>

<BillPrintDocument
  bill={data.bill}
  items={data.items}
  settings={data.settings}
  documentTypes={data.documentTypes}
/>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    background: white;
  }
  :global(.app-container), :global(.main-content) {
    display: block;
    min-height: 0;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  :global(.sidebar), :global(.sidebar-toggle-btn), :global(.theme-toggle-btn) {
    display: none !important;
  }
</style>
