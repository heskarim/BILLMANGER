<script lang="ts">
  import { page } from '$app/stores';
  import './global.css';
  import { 
    LayoutDashboard, 
    PlusCircle, 
    Settings, 
    Receipt, 
    TrendingUp 
  } from '@lucide/svelte';

  let { children } = $props();

  // Helper to determine if a route is currently active
  function isActive(path: string): boolean {
    if (path === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(path);
  }
</script>

<svelte:head>
  <title>Cloud Pi - Billing Management</title>
</svelte:head>

<div class="app-container">
  <!-- Sidebar Navigation Panel (Hidden during Print) -->
  <aside class="sidebar no-print">
    <div class="sidebar-brand">
      <div class="brand-logo">
        <Receipt size={24} color="var(--color-primary)" />
      </div>
      <div class="brand-text">
        <h2>Cloud Pi</h2>
        <span>Billing System</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <a href="/" class="nav-item" class:active={isActive('/')}>
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </a>
      
      <a href="/bills/new" class="nav-item" class:active={isActive('/bills/new')}>
        <PlusCircle size={20} />
        <span>Create Bill</span>
      </a>
      
      <a href="/settings" class="nav-item" class:active={isActive('/settings')}>
        <Settings size={20} />
        <span>Settings</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="status-indicator">
        <span class="dot online"></span>
        <span>Local Database Connected</span>
      </div>
    </div>
  </aside>

  <!-- Main Content Area -->
  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  /* Sidebar Styles */
  .sidebar {
    width: 260px;
    background-color: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    position: sticky;
    top: 0;
    height: 100vh;
    flex-shrink: 0;
    transition: transform var(--transition-normal);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 2.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .brand-logo {
    background: var(--bg-input);
    padding: 0.5rem;
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-text h2 {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .brand-text span {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.8rem 1rem;
    color: var(--text-secondary);
    border-radius: var(--border-radius-md);
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 0.95rem;
    transition: all var(--transition-fast);
    position: relative;
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .nav-item.active {
    color: var(--text-primary);
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 25%;
    height: 50%;
    width: 3px;
    background-color: var(--color-primary);
    border-radius: 0 4px 4px 0;
  }

  .sidebar-footer {
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.online {
    background-color: var(--color-success);
    box-shadow: 0 0 8px var(--color-success);
  }
</style>
