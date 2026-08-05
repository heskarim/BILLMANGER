<script lang="ts">
  import { enhance } from '$app/forms';
  import { FileText, RotateCcw, Trash2 } from '@lucide/svelte';
  import type { DraftSummary } from '$lib/bill-drafts';

  let { drafts }: { drafts: DraftSummary[] } = $props();

  function typeLabel(type: DraftSummary['type']): string {
    if (type === 'facture') return 'Facture';
    if (type === 'proforma') return 'Proforma';
    return 'Livraison';
  }

  function formatSavedAt(value: string): string {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }
</script>

<section class="draft-section" aria-labelledby="saved-drafts-heading">
  <div class="draft-heading">
    <div>
      <h2 id="saved-drafts-heading">Saved Drafts <span>{drafts.length}</span></h2>
      <p>Unfinished documents are kept separate from issued billing records.</p>
    </div>
  </div>

  <div class="draft-grid">
    {#each drafts as draft (draft.draftKey)}
      <article class="draft-card">
        <div class="draft-icon"><FileText size={20} /></div>
        <div class="draft-details">
          <div class="draft-badges">
            <span class="draft-badge">Draft</span>
            <span class="type-label">{typeLabel(draft.type)}</span>
          </div>
          <h3>{draft.clientLabel}</h3>
          <p>{draft.numberLabel}</p>
          <small>{draft.itemCount} {draft.itemCount === 1 ? 'item' : 'items'} · Saved {formatSavedAt(draft.updatedAt)}</small>
        </div>
        <div class="draft-actions">
          <a class="btn btn-secondary" href="/bills/new?draft={encodeURIComponent(draft.draftKey)}">
            <RotateCcw size={16} />
            <span>Resume</span>
          </a>
          <form
            method="POST"
            action="?/deleteDraft"
            use:enhance
            onsubmit={(event) => {
              if (!confirm(`Delete the saved draft for “${draft.clientLabel}”?`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="draftKey" value={draft.draftKey} />
            <button class="btn btn-secondary delete-draft" type="submit">
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </form>
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .draft-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .draft-heading h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .draft-heading h2 span {
    display: inline-flex;
    min-width: 1.5rem;
    justify-content: center;
    margin-left: var(--space-2);
    padding: 2px 7px;
    border-radius: var(--border-radius-pill);
    background: var(--color-warning-bg);
    color: var(--color-warning);
    font-size: var(--text-xs);
  }

  .draft-heading p {
    margin-top: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .draft-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 390px), 1fr));
    gap: var(--space-4);
  }

  .draft-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--color-warning);
    border-radius: var(--border-radius-lg);
    background: linear-gradient(135deg, var(--color-warning-bg), var(--bg-card));
  }

  .draft-icon {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--border-radius-md);
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }

  .draft-details { min-width: 0; }
  .draft-details h3 { margin-top: var(--space-2); font-size: var(--text-base); }
  .draft-details p, .draft-details small { color: var(--text-secondary); }
  .draft-details p { margin-top: 2px; }
  .draft-details small { display: block; margin-top: var(--space-2); }

  .draft-badges { display: flex; align-items: center; gap: var(--space-2); }
  .draft-badge {
    padding: 3px 9px;
    border-radius: var(--border-radius-pill);
    background: var(--color-warning);
    color: var(--bg-app);
    font-size: var(--text-xs);
    font-weight: 800;
  }
  .type-label { color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; }

  .draft-actions { display: flex; align-items: center; gap: var(--space-2); }
  .draft-actions .btn { min-height: 2.75rem; padding: var(--space-2) var(--space-3); }
  .delete-draft:hover { color: var(--color-danger); border-color: var(--color-danger); }

  @media (max-width: 784px) {
    .draft-card { grid-template-columns: auto minmax(0, 1fr); }
    .draft-actions { grid-column: 1 / -1; flex-wrap: wrap; }
    .draft-actions a, .draft-actions form, .draft-actions button { flex: 1; }
    .draft-actions button { width: 100%; }
  }
</style>
