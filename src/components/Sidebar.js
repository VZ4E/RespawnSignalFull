/**
 * Sidebar Component
 * Navigation sidebar with gradient background and styled nav items
 */
class Sidebar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.init();
  }

  init() {
    if (!this.container) return;
    
    this.container.className = 'sidebar w-64 h-screen bg-gradient-to-b from-primary-light to-white border-r border-gray-200 overflow-y-auto';
    
    const nav = document.createElement('nav');
    nav.className = 'flex flex-col';
    
    const items = [
      { label: 'Dashboard', href: '/', id: 'nav-dashboard', icon: '📊' },
      { label: 'Campaigns', href: '/campaigns', id: 'nav-campaigns', icon: '📢' },
      { label: 'Settings', href: '/settings', id: 'nav-settings', icon: '⚙️' },
    ];
    
    items.forEach(item => {
      const link = document.createElement('a');
      link.href = item.href;
      link.id = item.id;
      link.className = 'nav-item px-4 py-3 text-gray-700 hover:bg-primary-light hover:text-primary-text transition-colors flex items-center gap-3';
      link.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      nav.appendChild(link);
    });
    
    this.container.appendChild(nav);
  }

  setActive(itemId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active', 'bg-primary-light', 'text-primary-text', 'font-semibold', 'border-l-4', 'border-primary');
    });
    
    const activeItem = document.getElementById(itemId);
    if (activeItem) {
      activeItem.classList.add('active', 'bg-primary-light', 'text-primary-text', 'font-semibold', 'border-l-4', 'border-primary');
    }
  }
}
