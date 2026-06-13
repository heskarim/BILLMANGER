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
  <div class="card settings-card-utility">
    <h3 class="section-title">Database Utilities</h3>
    <p class="utility-desc">
      Export a binary copy of your local SQLite database file (`billing.db`) to your PC for backup, security, or data transfer.
    </p>
    <div class="utility-actions">
      <a href="/api/backup" class="btn btn-secondary utility-btn">
        <Download size={16} />
        <span>Export Database Backup</span>
      </a>
    </div>
  </div>
</div>

<style>
  /* ── Container ── */
  .settings-container {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* ── Page Header ── */
  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-bottom: var(--space-8);
    animation: fadeInUp 0.4s var(--ease-spring) both;
  }

  .header-icon {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-lg);
    background: var(--bg-card);
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .header-icon::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: calc(var(--border-radius-lg) + 2px);
    background: linear-gradient(
      135deg,
      var(--color-accent) 0%,
      var(--color-accent-hover) 50%,
      oklch(0.7 0.14 200) 100%
    );
    z-index: -1;
  }

  .header-icon::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: calc(var(--border-radius-lg) + 2px);
    background: linear-gradient(
      135deg,
      var(--color-accent) 0%,
      var(--color-accent-hover) 50%,
      oklch(0.7 0.14 200) 100%
    );
    z-index: -2;
    filter: blur(12px);
    opacity: 0.4;
    animation: breatheGlow 3s ease-in-out infinite;
  }

  .page-header h1 {
    font-size: var(--text-2xl);
    font-family: var(--font-display);
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .page-header p {
    font-size: var(--text-sm);
    margin: var(--space-1) 0 0;
  }

  /* ── Notification Banners ── */
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--space-6);
    font-weight: 500;
    font-size: var(--text-sm);
    animation: fadeInUp 0.3s var(--ease-spring) both;
  }

  .banner-success {
    background-color: var(--color-success-bg);
    border: 1px solid var(--color-success);
    color: oklch(0.85 0.15 152);
  }

  .banner-error {
    background-color: var(--color-danger-bg);
    border: 1px solid var(--color-danger);
    color: oklch(0.85 0.15 25);
  }

  /* ── Form Card ── */
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-8) !important;
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: 100ms;
  }

  .settings-form label {
    font-size: var(--text-sm);
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Form Grid ── */
  .form-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: var(--space-8);
  }

  @media (max-width: 850px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .fields-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  /* ── Logo Uploader ── */
  .logo-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-label {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    border-left: 3px solid var(--color-accent);
    padding-left: var(--space-3);
  }

  .logo-uploader-card {
    border: 2px dashed var(--border-color);
    background-color: var(--bg-input);
    border-radius: var(--border-radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    min-height: 250px;
    transition: border-color 0.3s var(--ease-spring), background-color 0.3s var(--ease-spring);
  }

  .logo-uploader-card:hover {
    border-color: var(--color-accent);
    background-color: var(--color-accent-subtle);
  }

  .logo-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-1);
  }

  .dropzone-text {
    margin-top: var(--space-3);
    font-weight: 500;
    color: var(--text-primary);
    font-size: var(--text-sm);
  }

  .dropzone-sub {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-5);
  }

  .logo-select-btn {
    padding: var(--space-2) var(--space-5);
    font-size: var(--text-sm);
  }

  .hidden-file-input {
    display: none;
  }

  .logo-preview-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    width: 100%;
  }

  .logo-preview {
    max-width: 180px;
    max-height: 180px;
    object-fit: contain;
    border-radius: var(--border-radius-md);
    background-color: white;
    padding: var(--space-2);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-md);
  }

  .remove-logo-btn {
    background: none;
    border: none;
    color: var(--color-danger);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: opacity 0.2s var(--ease-spring);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--border-radius-sm);
  }

  .remove-logo-btn:hover {
    opacity: 0.8;
    background: var(--color-danger-bg);
  }

  /* ── Form Footer ── */
  .form-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-6);
    border-top: 1px solid var(--border-color);
  }

  .btn-save {
    padding-left: var(--space-8);
    padding-right: var(--space-8);
    position: relative;
    transition: box-shadow 0.3s var(--ease-spring), transform 0.2s var(--ease-spring);
  }

  .btn-save:not(:disabled):hover {
    box-shadow: 0 0 20px oklch(0.7 0.15 185 / 0.35), var(--shadow-md);
    transform: translateY(-1px);
  }

  .btn-save:not(:disabled):active {
    transform: translateY(0px);
  }

  /* ── Database Utilities Card ── */
  .settings-card-utility {
    margin-top: var(--space-8);
    background: oklch(0.19 0.02 75 / 0.15) !important;
    border-color: oklch(0.4 0.06 75 / 0.3) !important;
    padding: var(--space-8) !important;
    animation: fadeInUp 0.5s var(--ease-spring) both;
    animation-delay: 200ms;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-3) 0;
    letter-spacing: -0.02em;
  }

  .utility-desc {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-6) 0;
    line-height: 1.6;
  }

  .utility-actions {
    display: flex;
    gap: var(--space-4);
  }

  .utility-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
