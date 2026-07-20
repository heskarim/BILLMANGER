<script lang="ts">
  import type { DraftSaveState } from '$lib/bill-drafts';

  let {
    state,
    onRetry,
    onReload
  }: {
    state: DraftSaveState;
    onRetry: () => void;
    onReload: () => void;
  } = $props();
</script>

<div class="draft-status" class:is-error={state.kind === 'failed' || state.kind === 'conflict'} aria-live="polite">
  {#if state.kind === 'dirty'}
    <span>Unsaved changes</span>
  {:else if state.kind === 'saving'}
    <span>Saving…</span>
  {:else if state.kind === 'saved'}
    <span>Draft saved</span>
  {:else if state.kind === 'failed'}
    <span>Save failed —</span>
    <button type="button" onclick={onRetry}>Retry</button>
  {:else if state.kind === 'conflict'}
    <span>Draft changed in another tab —</span>
    <button type="button" onclick={onReload}>Reload to continue</button>
  {/if}
</div>

<style>
  .draft-status {
    min-height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .draft-status.is-error {
    color: var(--color-danger);
  }

  button {
    border: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    text-decoration: underline;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
