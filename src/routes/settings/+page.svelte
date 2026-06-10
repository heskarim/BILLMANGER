<script lang="ts">
  import { enhance } from '$app/forms';
  import { Save, Building, Image as ImageIcon, CheckCircle, AlertCircle, Download } from '@lucide/svelte';

  // Load page data passed from server load
  let { data, form } = $props();
  
  // Reactive state for the company logo (base64 DataURL)
  let logo = $state(data.settings?.logo || '');
  let saving = $state(false);
  let showSuccess = $state(false);

  // Handle logo file uploads and convert them to Base64
  function handleLogoUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      
      // Limit logo size to 1MB to avoid bloated database entries
      if (file.size > 1024 * 1024) {
        alert("Image must be smaller than 1MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        logo = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function triggerSaveStart() {
    saving = true;
    showSuccess = false;
  }

  function handleSaveResult() {
    saving = false;
    if (form?.success || !form?.error) {
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
      }, 4000);
    }
  }
</script>

<div class="settings-container">
  <header class="page-header">
    <div class="header-icon">
      <Building size={28} />
    </div>
    <div>
      <h1>Company Profile</h1>
      <p class="text-secondary">Configure your corporate identity details and logo used on bills.</p>
    </div>
  </header>

  <!-- Notification Banner -->
  {#if form?.error}
    <div class="banner banner-error">
      <AlertCircle size={20} />
      <span>{form.error}</span>
    </div>
  {:else if showSuccess}
    <div class="banner banner-success">
      <CheckCircle size={20} />
      <span>Settings saved successfully!</span>
    </div>
  {/if}

  <form method="POST" action="?/saveSettings" use:enhance={({ submitter }) => {
    triggerSaveStart();
    return async ({ update }) => {
      await update();
      handleSaveResult();
    };
  }} class="card settings-form">
    
    <!-- Hidden input to bind base64 logo string -->
    <input type="hidden" name="logo" value={logo} />

    <div class="form-grid">
      <!-- Left Column: Settings Form -->
      <div class="fields-section">
        <div class="form-group">
          <label for="company_name">Company / Seller Name</label>
          <input 
            type="text" 
            id="company_name" 
            name="company_name" 
            class="input-field" 
            value={data.settings?.company_name || ''} 
            placeholder="e.g. Cloud Pi"
            required 
          />
        </div>

        <div class="form-group">
          <label for="address">Address</label>
          <textarea 
            id="address" 
            name="address" 
            class="input-field" 
            rows="3" 
            placeholder="Complete address details"
            required
          >{data.settings?.address || ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input 
              type="text" 
              id="phone" 
              name="phone" 
              class="input-field" 
              value={data.settings?.phone || ''} 
              placeholder="e.g. (+213) 5 52 06 78 07"
              required 
            />
          </div>
          <div class="form-group">
            <label for="email">Contact Email</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              class="input-field" 
              value={data.settings?.email || ''} 
              placeholder="e.g. cloud.pi.dz@gmail.com" 
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="rc">Registre du Commerce (RC)</label>
            <input 
              type="text" 
              id="rc" 
              name="rc" 
              class="input-field" 
              value={data.settings?.rc || ''} 
              placeholder="e.g. 18A1871316-01/23" 
            />
          </div>
          <div class="form-group">
            <label for="art">Article d'Imposition (ART)</label>
            <input 
              type="text" 
              id="art" 
              name="art" 
              class="input-field" 
              value={data.settings?.art || ''} 
              placeholder="e.g. 23112905611" 
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="nif">Identifiant Fiscal (NIF)</label>
            <input 
              type="text" 
              id="nif" 
              name="nif" 
              class="input-field" 
              value={data.settings?.nif || ''} 
              placeholder="e.g. 15436140176011402301" 
            />
          </div>
          <div class="form-group">
            <label for="nis">Identifiant Statistique (NIS)</label>
            <input 
              type="text" 
              id="nis" 
              name="nis" 
              class="input-field" 
              value={data.settings?.nis || ''} 
              placeholder="e.g. 195436140176035" 
            />
          </div>
        </div>

        <div class="form-group">
          <label for="rib">RIB (Bank Details)</label>
          <input 
            type="text" 
            id="rib" 
            name="rib" 
            class="input-field" 
            value={data.settings?.rib || ''} 
            placeholder="RIB details / bank code / beneficiary name" 
          />
        </div>
      </div>

      <!-- Right Column: Logo Upload Area -->
      <div class="logo-section">
        <span class="section-label">Company Logo</span>
        
        <div class="logo-uploader-card">
          {#if logo}
            <div class="logo-preview-wrapper">
              <img src={logo} alt="Company Logo" class="logo-preview" />
              <button 
                type="button" 
                class="remove-logo-btn" 
                onclick={() => logo = ''}
              >
                Remove Logo
              </button>
            </div>
          {:else}
            <div class="logo-dropzone">
              <ImageIcon size={40} color="var(--text-muted)" />
              <p class="dropzone-text">Click below to upload company logo</p>
              <span class="dropzone-sub">Max size 1MB (PNG, JPG, SVG)</span>
              
              <label for="logo_file" class="btn btn-secondary logo-select-btn">
                Select Image
              </label>
              <input 
                type="file" 
                id="logo_file" 
                accept="image/*" 
                class="hidden-file-input" 
                onchange={handleLogoUpload} 
              />
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="form-footer">
      <button 
        type="submit" 
        class="btn btn-primary btn-save" 
        disabled={saving}
      >
        <Save size={18} />
        <span>{saving ? 'Saving...' : 'Save Settings'}</span>
      </button>
    </div>

  </form>

  <!-- Database Utilities Section -->
  <div class="card settings-card-utility" style="margin-top: 2rem;">
    <h3 class="section-title" style="margin-bottom: 0.75rem;">Database Utilities</h3>
    <p class="text-secondary" style="margin-bottom: 1.5rem; font-size: 0.95rem;">
      Export a binary copy of your local SQLite database file (`billing.db`) to your PC for backup, security, or data transfer.
    </p>
    <div style="display: flex; gap: 1rem;">
      <a href="/api/backup" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.5rem;">
        <Download size={16} />
        <span>Export Database Backup</span>
      </a>
    </div>
  </div>
</div>

<style>
  .settings-container {
    max-width: 1000px;
    margin: 0 auto;
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

  .banner-success {
    background-color: var(--color-success-bg);
    border: 1px solid var(--color-success);
    color: hsl(142, 76%, 80%);
  }

  .banner-error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-danger);
    color: hsl(350, 80%, 80%);
  }

  /* Form Layout */
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 2.5rem;
  }

  @media (max-width: 850px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .fields-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  /* Logo Uploader */
  .logo-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-label {
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .logo-uploader-card {
    border: 2px dashed var(--border-color);
    background-color: var(--bg-input);
    border-radius: var(--border-radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    min-height: 250px;
    transition: border-color var(--transition-fast);
  }

  .logo-uploader-card:hover {
    border-color: var(--border-focus);
  }

  .logo-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .dropzone-text {
    margin-top: 1rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .dropzone-sub {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .logo-select-btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .hidden-file-input {
    display: none;
  }

  .logo-preview-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
  }

  .logo-preview {
    max-width: 180px;
    max-height: 180px;
    object-fit: contain;
    border-radius: var(--border-radius-md);
    background-color: white; /* contrast bg for logo */
    padding: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .remove-logo-btn {
    background: none;
    border: none;
    color: var(--color-danger);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  .remove-logo-btn:hover {
    opacity: 0.8;
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn-save {
    padding-left: 2rem;
    padding-right: 2rem;
  }
</style>
