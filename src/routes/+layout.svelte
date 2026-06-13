<script lang="ts">
  import { page } from '$app/stores';
  import './global.css';
  import {
    LayoutDashboard,
    PlusCircle,
    Settings,
    Receipt,
    TrendingUp,
    Zap,
    Menu,
    ChevronLeft,
    Sun,
    Moon
  } from '@lucide/svelte';

  let { children } = $props();

  let sidebarCollapsed = $state(false);

  // Theme: 'light' (white, default) or 'dark'. Initialised from the
  // attribute that app.html already set before paint.
  let theme = $state<'light' | 'dark'>('light');

  $effect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    theme = current === 'dark' ? 'dark' : 'light';
  });

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // localStorage unavailable — ignore, theme still applies for this session
    }
  }

  // Helper to determine if a route is currently active
  function isActive(path: string): boolean {
    if (path === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(path);
  }
</script>

<svelte:head>
  <title>TECH IP - Billing Management</title>
</svelte:head>

<div class="app-container" class:sidebar-collapsed={sidebarCollapsed}>
  <!-- Sidebar Navigation Panel (Hidden during Print) -->
  <aside class="sidebar no-print">
    <!-- Brand -->
    <div class="sidebar-brand">
      <div class="brand-icon">
        <Zap size={20} />
      </div>
      <div class="brand-text">
        <h2>TECH IP</h2>
        <span>Billing</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <span class="nav-section-label">Main</span>
      
      <a href="/" class="nav-item" class:active={isActive('/')}>
        <span class="nav-icon-wrap">
          <LayoutDashboard size={18} />
        </span>
        <span>Dashboard</span>
      </a>
      
      <a href="/bills/new" class="nav-item" class:active={isActive('/bills/new')}>
        <span class="nav-icon-wrap">
          <PlusCircle size={18} />
        </span>
        <span>Create Bill</span>
      </a>

      <span class="nav-section-label">System</span>
      
      <a href="/settings" class="nav-item" class:active={isActive('/settings')}>
        <span class="nav-icon-wrap">
          <Settings size={18} />
        </span>
        <span>Settings</span>
      </a>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span>Database Connected</span>
      </div>
      <span class="version-badge">v0.1.0</span>
    </div>
  </aside>

  <!-- Sidebar Toggle Trigger when collapsed (floating) or inside layout -->
  <button 
    class="sidebar-toggle-btn no-print" 
    class:collapsed={sidebarCollapsed}
    onclick={() => sidebarCollapsed = !sidebarCollapsed}
    aria-label="Toggle Navigation Sidebar"
  >
    {#if sidebarCollapsed}
      <Menu size={18} />
    {:else}
      <ChevronLeft size={18} />
    {/if}
  </button>

  <!-- Theme Toggle (floating, top-right corner) -->
  <button
    class="theme-toggle-btn no-print"
    onclick={toggleTheme}
    aria-label="Toggle light / dark theme"
    title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    {#if theme === 'light'}
      <Moon size={18} />
    {:else}
      <Sun size={18} />
    {/if}
  </button>

  <!-- Main Content Area -->
  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  /* ============================================================
     SIDEBAR
     ============================================================ */
  .sidebar {
    width: 250px;
    background: var(--bg-sidebar);
    backdrop-filter: blur(20px) saturate(1.2);
    -webkit-backdrop-filter: blur(20px) saturate(1.2);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-5);
    position: sticky;
    top: 0;
    height: 100vh;
    flex-shrink: 0;
    transition: transform var(--duration-normal) var(--ease-spring),
                width var(--duration-normal) var(--ease-spring),
                margin-left var(--duration-normal) var(--ease-spring),
                padding var(--duration-normal) var(--ease-spring),
                opacity var(--duration-normal) var(--ease-spring),
                border-color var(--duration-normal) var(--ease-spring);
  }

  /* Collapsed Sidebar overrides */
  .app-container.sidebar-collapsed .sidebar {
    transform: translateX(-100%);
    margin-left: -250px;
    border-right-color: transparent;
    opacity: 0;
    pointer-events: none;
  }

  /* ---- Brand ---- */
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
    padding: 0 var(--space-2);
  }

  .brand-icon {
    width: 38px;
    height: 38px;
    border-radius: var(--border-radius-md);
    background: linear-gradient(135deg, var(--color-accent), oklch(0.68 0.14 230));
    display: flex;
    align-items: center;
    justify-content: center;
    color: oklch(0.13 0.015 250);
    box-shadow: 0 4px 12px var(--color-accent-glow);
    flex-shrink: 0;
  }

  .brand-text h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .brand-text span {
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ---- Navigation ---- */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .nav-section-label {
    font-family: var(--font-display);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: var(--space-4) var(--space-3) var(--space-2);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3);
    color: var(--text-secondary);
    border-radius: var(--border-radius-md);
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-base);
    transition: all var(--duration-normal) var(--ease-spring);
    position: relative;
    text-decoration: none;
  }

  .nav-icon-wrap {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    transition: all var(--duration-normal) var(--ease-spring);
    flex-shrink: 0;
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .nav-item:hover .nav-icon-wrap {
    background: var(--bg-hover);
  }

  .nav-item.active {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .nav-item.active .nav-icon-wrap {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 20%;
    height: 60%;
    width: 3px;
    background: var(--color-accent);
    border-radius: 0 var(--border-radius-pill) var(--border-radius-pill) 0;
    box-shadow: 0 0 8px var(--color-accent-glow);
    animation: fadeInUp 0.3s var(--ease-spring) both;
  }

  /* ---- Footer ---- */
  .sidebar-footer {
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: var(--color-success);
    animation: pulseRing 2.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  .version-badge {
    font-size: 0.6875rem;
    color: var(--text-muted);
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    padding: 2px 8px;
    border-radius: var(--border-radius-pill);
    font-family: var(--font-body);
    font-weight: 500;
  }

  /* ============================================================
     SIDEBAR TOGGLE BUTTON
     ============================================================ */
  .sidebar-toggle-btn {
    position: fixed;
    left: 270px;
    top: 25px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-elevated);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
    transition: all var(--duration-normal) var(--ease-spring);
    box-shadow: var(--shadow-md);
  }

  .sidebar-toggle-btn:hover {
    transform: scale(1.08);
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 0 12px var(--color-accent-glow);
  }

  .sidebar-toggle-btn.collapsed {
    left: 20px;
  }

  /* ============================================================
     THEME TOGGLE BUTTON (top-right corner)
     ============================================================ */
  .theme-toggle-btn {
    position: fixed;
    right: 24px;
    top: 25px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-elevated);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
    transition: all var(--duration-normal) var(--ease-spring);
    box-shadow: var(--shadow-md);
  }

  .theme-toggle-btn:hover {
    transform: scale(1.08);
    border-color: var(--color-accent);
    color: var(--color-accent);
    box-shadow: 0 0 12px var(--color-accent-glow);
  }
</style>
