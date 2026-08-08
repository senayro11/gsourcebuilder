// ============================================================
//  BUDGET-CONFIG.JS — GitHub settings for the Budget system's own folder
// ============================================================

const GITHUB_CONFIG = {
  owner: 'senayro11',
  repo:  'gsourcebuilder',
  branch: 'main',
  token: '',
  dbPath: 'budget/db'
};

// System definitions -- same file paths as the root's own copy (js/config.js)
// so the sidebar/dashboard-card links stay identical regardless of which
// page's copy of this map happens to be in effect. Paths are root-relative;
// budget-core.js's buildSidebar()/buildNavbar() prefix them with '../'
// since this page always lives one folder deep.
const SYSTEMS = {
  pos:        { name: 'Point of Sale',        icon: '🛒', file: 'pos/pos.html',        color: '#6366f1' },
  inventory:  { name: 'Inventory',            icon: '📦', file: 'inventory/inventory.html',  color: '#0ea5e9' },
  attendance: { name: 'HR Management',        icon: '🕐', file: 'hr/attendance.html', color: '#10b981' },
  budget:     { name: 'Budget & Finance',     icon: '💰', file: 'budget/budget.html',     color: '#f59e0b' },
  pm:         { name: 'Project Management',   icon: '📁', file: 'pm/pm.html',          color: '#14b8a6' },
  preventive: { name: 'Preventive Maintenance', icon: '🧯', file: 'preventive/preventive.html', color: '#ef4444' }
};

// Superadmin-only system (not in SYSTEMS to hide from normal users)
const SUPERADMIN_SYSTEM = { name: 'SuperAdmin Panel', icon: '⚙️', file: 'superadmin.html', color: '#8b5cf6' };

// Role hierarchy
const ROLE_LEVELS = { guest: 1, ojt: 2, staff: 3, admin: 4, superadmin: 5 };

// Permissions per role per system
// 'manage_users' = can add/edit/delete users WITHIN their own system only
const PERMISSIONS = {
  pos: {
    admin:  ['view','create','edit','delete','reports','settings','adjust','manage_users','timein'],
    staff:  ['view','create','timein'],
    ojt:    ['view','timein'],
    guest:  ['view']
  },
  inventory: {
    admin:  ['view','create','edit','delete','reports','settings','adjust','manage_users'],
    staff:  ['view','create','adjust'],
    ojt:    ['view'],
    guest:  ['view']
  },
  attendance: {
    admin:  ['view','create','edit','delete','reports','settings','payroll','manage_users','timein'],
    staff:  ['view','timein','own_records'],
    ojt:    ['view','timein','own_records'],
    guest:  []
  },
  budget: {
    admin:  ['view','create','edit','delete','reports','settings','approve','manage_users'],
    staff:  ['view','create'],
    ojt:    ['view'],
    guest:  []
  },
  pm: {
    admin:  ['view','create','edit','delete','reports','settings','manage_users'],
    staff:  ['view','create','edit'],
    ojt:    ['view'],
    guest:  ['view']
  },
  preventive: {
    admin:  ['view','create','edit','delete','reports','settings','manage_users'],
    staff:  ['view','create','edit'],
    ojt:    ['view'],
    guest:  ['view']
  }
};
